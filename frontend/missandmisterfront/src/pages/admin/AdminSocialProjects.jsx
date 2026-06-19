import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { adminAPI } from '../../services/api';
import Loader from '../../components/Loader';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import { NO_AUTO_REFRESH_INTERVAL_MS, broadcastLiveUpdate, useAutoRefresh } from '../../utils/liveUpdates';
import './admin-theme.css';
import './AdminSocialProjects.css';

const emptyForm = {
  name: '',
  candidate1_id: '',
  candidate2_id: '',
  theme: '',
};

const FeedbackBanner = ({ type = 'info', message, onClose }) => (
  <div className={`asocial-banner asocial-banner-${type}`}>
    <span>{message}</span>
    <button type="button" className="asocial-banner-close" onClick={onClose}>×</button>
  </div>
);

const ConfirmModal = ({ message, onConfirm, onCancel }) => (
  <motion.div className="asocial-confirm-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onCancel}>
    <motion.div className="asocial-confirm-modal" initial={{ scale: 0.94, y: 18 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.94, y: 18 }} onClick={(event) => event.stopPropagation()}>
      <div className="asocial-confirm-icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="#F4D03F" strokeWidth="2" />
          <path d="M12 9v4M12 17h.01" stroke="#F4D03F" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
      <p>{message}</p>
      <div className="asocial-confirm-actions">
        <button type="button" className="ag-btn ag-btn-ghost" onClick={onCancel}>Annuler</button>
        <button type="button" className="ag-btn ag-btn-danger" onClick={onConfirm}>Confirmer</button>
      </div>
    </motion.div>
  </motion.div>
);

const normalizeProject = (item) => ({
  id: item.id,
  name: item.name || '',
  theme: item.theme || '',
  candidate1PhotoUrl: resolveMediaUrl(item.candidate1_photo_url || null),
  candidate2PhotoUrl: resolveMediaUrl(item.candidate2_photo_url || null),
  candidate1: item.candidate1 || null,
  candidate2: item.candidate2 || null,
  createdBy: item.created_by || null,
  createdAt: item.created_at || null,
  updatedAt: item.updated_at || null,
});

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
};

const AdminSocialProjects = () => {
  const [projects, setProjects] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailProject, setDetailProject] = useState(null);
  const [uploadingPhotoFor, setUploadingPhotoFor] = useState(null); // '1' | '2' | null
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [feedback, setFeedback] = useState(null);
  const [errors, setErrors] = useState({});
  const [confirm, setConfirm] = useState(null);
  const hasLoadedRef = useRef(false);

  const canDelete = (() => {
    try {
      return JSON.parse(localStorage.getItem('adminUser') || 'null')?.role === 'superadmin';
    } catch {
      return false;
    }
  })();

  const fetchData = async () => {
    const isInitial = !hasLoadedRef.current;
    try {
      if (isInitial) setLoading(true);
      const [projectsRes, candidatesRes] = await Promise.all([
        adminAPI.getSocialProjects(),
        adminAPI.getAvailableCandidates(),
      ]);
      setProjects((projectsRes?.data || []).map(normalizeProject));
      setCandidates(candidatesRes?.data || []);
      hasLoadedRef.current = true;
    } catch (err) {
      if (err?.isSessionExpired) return;
      if (isInitial) {
        setFeedback({ type: 'error', message: err.message || 'Impossible de charger les données.' });
      }
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  useAutoRefresh(fetchData, {
    intervalMs: NO_AUTO_REFRESH_INTERVAL_MS,
    enabled: true,
    refreshOnFocus: false,
    refreshOnLiveUpdate: false,
    refreshOnStorage: false,
  });

  const stats = useMemo(() => ({
    total: projects.length,
  }), [projects]);

  const getCandidateName = (id) => {
    const c = candidates.find((cc) => cc.id === id);
    return c ? c.full_name : 'Candidat inconnu';
  };

  const closePanel = () => {
    setPanelOpen(false);
    setEditing(null);
    setForm(emptyForm);
    setErrors({});
  };

  const openCreate = () => {
    setFeedback(null);
    setEditing(null);
    setForm({ ...emptyForm });
    setErrors({});
    setPanelOpen(true);
  };

  const openEdit = (project) => {
    setFeedback(null);
    setEditing(project);
    setForm({
      name: project.name || '',
      candidate1_id: project.candidate1?.id || '',
      candidate2_id: project.candidate2?.id || '',
      theme: project.theme || '',
    });
    setErrors({});
    setPanelOpen(true);
  };

  const handlePhotoUpload = async (projectId, candidateNum, file) => {
    setUploadingPhotoFor(candidateNum);
    try {
      const response = await adminAPI.uploadSocialProjectCandidatePhoto(projectId, candidateNum, file);
      setFeedback({ type: 'success', message: response?.message || 'Photo mise à jour.' });
      broadcastLiveUpdate('social-projects');
      await fetchData();
    } catch (err) {
      if (err?.isSessionExpired) return;
      setFeedback({ type: 'error', message: err.message || 'Échec de l\'upload.' });
    } finally {
      setUploadingPhotoFor(null);
    }
  };

  const handlePhotoDelete = async (projectId, candidateNum) => {
    setConfirm({
      message: `Supprimer la photo du candidat ${candidateNum} ?`,
      onConfirm: async () => {
        try {
          await adminAPI.deleteSocialProjectCandidatePhoto(projectId, candidateNum);
          setFeedback({ type: 'success', message: 'Photo supprimée.' });
          broadcastLiveUpdate('social-projects');
          await fetchData();
        } catch (err) {
          if (err?.isSessionExpired) return;
          setFeedback({ type: 'error', message: err.message || 'Échec de la suppression.' });
        } finally {
          setConfirm(null);
        }
      },
    });
  };

  const openDetail = (project) => {
    setDetailProject(project);
    setDetailOpen(true);
  };

  const updateField = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const validateForm = () => {
    const next = {};
    if (!form.name.trim()) next.name = 'Le nom du binôme est requis.';
    if (!form.candidate1_id) next.candidate1_id = 'Veuillez sélectionner le premier candidat.';
    if (!form.candidate2_id) next.candidate2_id = 'Veuillez sélectionner le second candidat.';
    if (form.candidate1_id && form.candidate2_id && form.candidate1_id === form.candidate2_id) {
      next.candidate2_id = 'Les deux candidats doivent être différents.';
    }
    if (!form.theme.trim()) next.theme = 'Le thème du projet social est requis.';
    return next;
  };

  const normalizeServerErrors = (apiError) => {
    const source = apiError?.errors || apiError?.payload?.errors;
    if (!source || typeof source !== 'object') return {};
    return Object.entries(source).reduce((acc, [key, value]) => {
      const msg = Array.isArray(value) ? value[0] : value;
      if (!msg) return acc;
      acc[key] = msg;
      return acc;
    }, {});
  };

  const saveProject = async (event) => {
    event.preventDefault();
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setFeedback({ type: 'error', message: 'Veuillez corriger les champs signalés.' });
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      const payload = {
        name: form.name.trim(),
        candidate1_id: Number(form.candidate1_id),
        candidate2_id: Number(form.candidate2_id),
        theme: form.theme.trim(),
      };
      const response = editing
        ? await adminAPI.updateSocialProject(editing.id, payload)
        : await adminAPI.createSocialProject(payload);
      setFeedback({
        type: 'success',
        message: response?.message || (editing ? 'Binôme mis à jour avec succès.' : 'Binôme créé avec succès.'),
      });
      closePanel();
      broadcastLiveUpdate('social-projects');
      await fetchData();
    } catch (saveError) {
      if (saveError?.isSessionExpired) return;
      const mapped = normalizeServerErrors(saveError);
      if (Object.keys(mapped).length > 0) setErrors(mapped);
      setFeedback({ type: 'error', message: saveError.message || 'Impossible d\'enregistrer le binôme.' });
    } finally {
      setSaving(false);
    }
  };

  const askDelete = (project) => {
    setConfirm({
      message: `Supprimer le binôme "${project.name}" ? Cette action est irréversible.`,
      onConfirm: async () => {
        try {
          await adminAPI.deleteSocialProject(project.id);
          setFeedback({ type: 'success', message: `Le binôme "${project.name}" a été supprimé.` });
          broadcastLiveUpdate('social-projects');
          await fetchData();
        } catch (deleteError) {
          if (deleteError?.isSessionExpired) return;
          setFeedback({ type: 'error', message: deleteError.message || 'La suppression a échoué.' });
        } finally {
          setConfirm(null);
        }
      },
    });
  };

  const candidateOptions = useMemo(() => {
    if (editing) {
      return candidates;
    }
    return candidates.filter((c) => !c.already_assigned);
  }, [candidates, editing]);

  if (loading) {
    return (
      <div className="admin-page asocial">
        <div className="loading-container"><Loader /><p>Chargement des projets sociaux...</p></div>
      </div>
    );
  }

  return (
    <div className="admin-page asocial">
      <AnimatePresence>
        {confirm && <ConfirmModal message={confirm.message} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)} />}
      </AnimatePresence>

      <div className="asocial-header">
        <div className="asocial-header-copy">
          <span className="ag-badge ag-badge-gold">Projets Sociaux</span>
          <h1>Gestion des binômes</h1>
          <p>Créez, modifiez et gérez les binômes de candidats autour de projets sociaux. Chaque binôme est composé de deux candidats existants.</p>
        </div>
        <div className="asocial-header-actions">
          <button type="button" className="ag-btn ag-btn-primary" onClick={openCreate}>
            Nouveau binôme
          </button>
        </div>
      </div>

      {feedback && <FeedbackBanner type={feedback.type} message={feedback.message} onClose={() => setFeedback(null)} />}

      {projects.length === 0 ? (
        <div className="asocial-empty">
          <div className="asocial-empty-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" stroke="#D4AF37" strokeWidth="1.8"/>
              <path d="M12 6v6l4 2" stroke="#D4AF37" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </div>
          <h3>Aucun binôme pour le moment</h3>
          <p>Créez un premier binôme en sélectionnant deux candidats et en renseignant le thème du projet social.</p>
          <button type="button" className="ag-btn ag-btn-primary" onClick={openCreate}>Créer un binôme</button>
        </div>
      ) : (
        <>
          <div className="asocial-stats">
            <div className="asocial-stat-card">
              <strong>{stats.total}</strong>
              <span>Total binômes</span>
            </div>
          </div>

          <div className="asocial-table-wrap">
            <table className="asocial-table">
              <thead>
                <tr>
                  <th>Nom du binôme</th>
                  <th>Candidat 1</th>
                  <th>Candidat 2</th>
                  <th>Thème</th>
                  <th>Date de création</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => (
                  <tr key={project.id}>
                    <td data-label="Nom du binôme"><strong>{project.name}</strong></td>
                    <td data-label="Candidat 1">
                      <div className="asocial-cell-candidate">
                        {project.candidate1?.photo_url && (
                          <img src={project.candidate1.photo_url} alt="" className="asocial-cell-avatar" />
                        )}
                        <span>{project.candidate1?.full_name || '—'}</span>
                      </div>
                    </td>
                    <td data-label="Candidat 2">
                      <div className="asocial-cell-candidate">
                        {project.candidate2?.photo_url && (
                          <img src={project.candidate2.photo_url} alt="" className="asocial-cell-avatar" />
                        )}
                        <span>{project.candidate2?.full_name || '—'}</span>
                      </div>
                    </td>
                    <td data-label="Thème" className="asocial-cell-theme">{project.theme}</td>
                    <td data-label="Date de création">{formatDate(project.createdAt)}</td>
                    <td data-label="Actions">
                      <div className="asocial-cell-actions">
                        <button type="button" className="ag-btn ag-btn-ghost" onClick={() => openDetail(project)} title="Voir">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="1.8"/><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8"/></svg>
                        </button>
                        <button type="button" className="ag-btn ag-btn-outline" onClick={() => openEdit(project)} title="Modifier">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M17 3a2.83 2.83 0 014 4L7.5 20.5 2 22l1.5-5.5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>
                        </button>
                        {canDelete && (
                          <button type="button" className="ag-btn ag-btn-danger" onClick={() => askDelete(project)} title="Supprimer">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <AnimatePresence>
        {panelOpen && (
          <>
            <motion.div className="asocial-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closePanel} />
            <motion.aside className="asocial-panel" initial={{ x: 460 }} animate={{ x: 0 }} exit={{ x: 460 }} transition={{ type: 'spring', damping: 28, stiffness: 260 }} onClick={(event) => event.stopPropagation()}>
              <div className="asocial-panel-header">
                <div>
                  <span className="ag-badge ag-badge-info">{editing ? 'Modification' : 'Nouveau binôme'}</span>
                  <h2>{editing ? 'Modifier le binôme' : 'Créer un binôme'}</h2>
                </div>
                <button type="button" className="asocial-panel-close" onClick={closePanel}>×</button>
              </div>

              <form className="asocial-panel-form" onSubmit={saveProject}>
                <div className="asocial-panel-body">
                  <label className="asocial-field">
                    <span>Nom du binôme</span>
                    <input type="text" className="ag-input" value={form.name} onChange={(event) => updateField('name', event.target.value)} placeholder="Ex. Binôme Éco-Responsable" />
                    {errors.name && <small className="acand-field-error">{errors.name}</small>}
                  </label>

                  <label className="asocial-field">
                    <span>Premier candidat</span>
                    <select className="ag-input ag-select" value={form.candidate1_id} onChange={(event) => updateField('candidate1_id', event.target.value)}>
                      <option value="">Sélectionner un candidat</option>
                      {candidateOptions.map((c) => (
                        <option key={c.id} value={c.id} disabled={c.already_assigned && !editing}>
                          {c.full_name} {c.already_assigned && !editing ? '(déjà dans un binôme)' : ''}
                        </option>
                      ))}
                    </select>
                    {errors.candidate1_id && <small className="acand-field-error">{errors.candidate1_id}</small>}
                  </label>

                  <label className="asocial-field">
                    <span>Second candidat</span>
                    <select className="ag-input ag-select" value={form.candidate2_id} onChange={(event) => updateField('candidate2_id', event.target.value)}>
                      <option value="">Sélectionner un candidat</option>
                      {candidateOptions.filter((c) => String(c.id) !== String(form.candidate1_id)).map((c) => (
                        <option key={c.id} value={c.id} disabled={c.already_assigned && !editing}>
                          {c.full_name} {c.already_assigned && !editing ? '(déjà dans un binôme)' : ''}
                        </option>
                      ))}
                    </select>
                    {errors.candidate2_id && <small className="acand-field-error">{errors.candidate2_id}</small>}
                  </label>

                  <label className="asocial-field">
                    <span>Thème du projet social</span>
                    <textarea className="ag-input" rows="4" value={form.theme} onChange={(event) => updateField('theme', event.target.value)} placeholder="Décrivez le thème du projet social..." />
                    {errors.theme && <small className="acand-field-error">{errors.theme}</small>}
                  </label>
                </div>

                <div className="asocial-panel-footer">
                  <button type="button" className="ag-btn ag-btn-ghost" onClick={closePanel} disabled={saving}>Annuler</button>
                  <button type="submit" className="ag-btn ag-btn-primary" disabled={saving}>
                    {saving ? 'Enregistrement…' : editing ? 'Mettre à jour' : 'Créer le binôme'}
                  </button>
                </div>
              </form>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {detailOpen && detailProject && (
          <motion.div className="asocial-detail-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDetailOpen(false)}>
            <motion.div className="asocial-detail-modal" initial={{ scale: 0.94, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.94, y: 20 }} onClick={(event) => event.stopPropagation()}>
              <div className="asocial-detail-header">
                <h2>{detailProject.name}</h2>
                <button type="button" className="asocial-panel-close" onClick={() => setDetailOpen(false)}>×</button>
              </div>
              <div className="asocial-detail-body">
                <div className="asocial-detail-candidates">
                  <div className="asocial-detail-candidate">
                    {detailProject.candidate1?.photo_url ? (
                      <img src={detailProject.candidate1.photo_url} alt={detailProject.candidate1.full_name} className="asocial-detail-photo" />
                    ) : (
                      <div className="asocial-detail-photo-placeholder" />
                    )}
                    <h4>{detailProject.candidate1?.full_name || '—'}</h4>
                    <p>{detailProject.candidate1?.university || ''}</p>
                  </div>
                  <div className="asocial-detail-divider">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 5l7 7-7 7" stroke="#D4AF37" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                  <div className="asocial-detail-candidate">
                    {detailProject.candidate2?.photo_url ? (
                      <img src={detailProject.candidate2.photo_url} alt={detailProject.candidate2.full_name} className="asocial-detail-photo" />
                    ) : (
                      <div className="asocial-detail-photo-placeholder" />
                    )}
                    <h4>{detailProject.candidate2?.full_name || '—'}</h4>
                    <p>{detailProject.candidate2?.university || ''}</p>
                  </div>
                </div>
                <div className="asocial-detail-theme">
                  <span className="ag-badge ag-badge-gold">Thème du projet</span>
                  <p>{detailProject.theme}</p>
                </div>

                {[1, 2].map((num) => {
                  const candidate = detailProject[`candidate${num}`];
                  const photoUrl = detailProject[`candidate${num}PhotoUrl`];
                  const isUploading = uploadingPhotoFor === String(num);
                  return (
                    <div key={num} className="asocial-detail-photo-section">
                      <span className="ag-badge ag-badge-info">Photo candidat {num} — {candidate?.full_name || '—'}</span>
                      <div className="asocial-detail-photo-binome">
                        {photoUrl ? (
                          <img
                            src={photoUrl}
                            alt={`Photo candidat ${num}`}
                            className="asocial-photo-preview"
                          />
                        ) : (
                          <div className="asocial-photo-placeholder">
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                              <rect x="3" y="4" width="18" height="16" rx="2" stroke="#D4AF37" strokeWidth="1.5"/>
                              <circle cx="8.5" cy="9" r="1.5" fill="#D4AF37"/>
                              <path d="M21 16l-5.5-5.5L6 20" stroke="#D4AF37" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            <span>Photo par défaut (profil)</span>
                          </div>
                        )}
                      </div>
                      <div className="asocial-photo-actions">
                        <label className={`ag-btn ag-btn-outline ${isUploading ? 'ag-btn-disabled' : ''}`}>
                          {isUploading ? 'Envoi…' : 'Changer la photo'}
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            style={{ display: 'none' }}
                            disabled={isUploading}
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              if (file) {
                                handlePhotoUpload(detailProject.id, num, file);
                              }
                              event.target.value = '';
                            }}
                          />
                        </label>
                        {photoUrl && (
                          <button
                            type="button"
                            className="ag-btn ag-btn-danger"
                            onClick={() => handlePhotoDelete(detailProject.id, num)}
                          >
                            Supprimer
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                <p className="asocial-detail-meta">Créé le {formatDate(detailProject.createdAt)}</p>
              </div>
              <div className="asocial-detail-footer">
                <button type="button" className="ag-btn ag-btn-outline" onClick={() => { setDetailOpen(false); openEdit(detailProject); }}>Modifier</button>
                <button type="button" className="ag-btn ag-btn-ghost" onClick={() => setDetailOpen(false)}>Fermer</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminSocialProjects;
