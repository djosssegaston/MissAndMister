import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { adminAPI } from '../../services/api';
import Loader from '../../components/Loader';
import { ADMIN_LIVE_UPDATE_INTERVAL_MS, broadcastLiveUpdate, useAutoRefresh } from '../../utils/liveUpdates';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import './admin-theme.css';
import './AdminPartners.css';

const MAX_LOGO_SIZE_BYTES = 20 * 1024 * 1024;
const MAX_LOGO_LABEL = '20 Mo';

const emptyForm = {
  name: '',
  websiteUrl: '',
  sortOrder: 0,
  isActive: true,
  logo: null,
};

const FeedbackBanner = ({ type = 'info', message, onClose }) => (
  <div className={`apartners-banner apartners-banner-${type}`}>
    <span>{message}</span>
    <button type="button" className="apartners-banner-close" onClick={onClose}>×</button>
  </div>
);

const ConfirmModal = ({ message, onConfirm, onCancel }) => (
  <motion.div className="apartners-confirm-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onCancel}>
    <motion.div className="apartners-confirm-modal" initial={{ scale: 0.94, y: 18 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.94, y: 18 }} onClick={(event) => event.stopPropagation()}>
      <div className="apartners-confirm-icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="#F4D03F" strokeWidth="2" />
          <path d="M12 9v4M12 17h.01" stroke="#F4D03F" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
      <p>{message}</p>
      <div className="apartners-confirm-actions">
        <button type="button" className="ag-btn ag-btn-ghost" onClick={onCancel}>Annuler</button>
        <button type="button" className="ag-btn ag-btn-danger" onClick={onConfirm}>Confirmer</button>
      </div>
    </motion.div>
  </motion.div>
);

const normalizePartner = (item) => ({
  id: item.id,
  name: item.name || 'Partenaire',
  websiteUrl: item.website_url || '',
  logoUrl: resolveMediaUrl(item.logo_url || item.logo_path || null),
  logoMeta: item.logo_meta || null,
  sortOrder: Number(item.sort_order || 0),
  isActive: Boolean(item.is_active),
  publishedAt: item.published_at || null,
  createdAt: item.created_at || null,
  updatedAt: item.updated_at || null,
});

const buildFormFromPartner = (partner) => ({
  name: partner?.name || '',
  websiteUrl: partner?.websiteUrl || '',
  sortOrder: Number(partner?.sortOrder || 0),
  isActive: Boolean(partner?.isActive ?? true),
  logo: null,
});

const formatDate = (value) => {
  if (!value) {
    return '—';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const AdminPartners = () => {
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Tous');
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [errors, setErrors] = useState({});
  const [confirm, setConfirm] = useState(null);
  const [error, setError] = useState(null);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const hasLoadedRef = useRef(false);
  const adminRole = (() => {
    try {
      return JSON.parse(localStorage.getItem('adminUser') || 'null')?.role || 'admin';
    } catch {
      return 'admin';
    }
  })();
  const canDeletePartners = adminRole === 'superadmin';

  useEffect(() => () => {
    if (previewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
  }, [previewUrl]);

  const fetchPartners = async () => {
    const isInitialLoad = !hasLoadedRef.current;

    try {
      if (isInitialLoad) {
        setLoading(true);
        setError(null);
      }

      const response = await adminAPI.getPartners();
      const rows = (response?.data || []).map(normalizePartner);
      setPartners(rows);
      setError(null);
      setAutoRefreshEnabled(true);
      hasLoadedRef.current = true;
    } catch (fetchError) {
      if (fetchError?.isSessionExpired) {
        return;
      }

      setAutoRefreshEnabled(false);

      if (isInitialLoad) {
        setError(fetchError.message || 'Impossible de charger les partenaires.');
      }
    } finally {
      if (isInitialLoad) {
        hasLoadedRef.current = true;
        setLoading(false);
      }
    }
  };

  useAutoRefresh(fetchPartners, {
    intervalMs: ADMIN_LIVE_UPDATE_INTERVAL_MS,
    enabled: autoRefreshEnabled,
  });

  const retryFetchPartners = async () => {
    hasLoadedRef.current = false;
    setError(null);
    setAutoRefreshEnabled(true);
    await fetchPartners();
  };

  const stats = useMemo(() => {
    const active = partners.filter((partner) => partner.isActive).length;
    const inactive = partners.length - active;
    const websites = partners.filter((partner) => partner.websiteUrl).length;

    return [
      { label: 'Total', value: partners.length, tone: 'gold' },
      { label: 'Actifs', value: active, tone: 'success' },
      { label: 'Inactifs', value: inactive, tone: 'warning' },
      { label: 'Avec site', value: websites, tone: 'info' },
    ];
  }, [partners]);

  const sortedPartners = useMemo(() => {
    return [...partners].sort((a, b) => {
      if (a.isActive !== b.isActive) {
        return a.isActive ? -1 : 1;
      }

      if (a.sortOrder !== b.sortOrder) {
        return a.sortOrder - b.sortOrder;
      }

      return a.name.localeCompare(b.name, 'fr');
    });
  }, [partners]);

  const filteredPartners = useMemo(() => {
    const query = search.trim().toLowerCase();

    return sortedPartners.filter((partner) => {
      const matchesQuery = !query
        || partner.name.toLowerCase().includes(query)
        || partner.websiteUrl.toLowerCase().includes(query);
      const matchesStatus = statusFilter === 'Tous'
        || (statusFilter === 'Actifs' && partner.isActive)
        || (statusFilter === 'Inactifs' && !partner.isActive);

      return matchesQuery && matchesStatus;
    });
  }, [sortedPartners, search, statusFilter]);

  const closePanel = () => {
    setPanelOpen(false);
    setEditing(null);
    setForm(emptyForm);
    setErrors({});
    setPreviewUrl(null);
  };

  const openCreate = () => {
    setFeedback(null);
    setError(null);
    setEditing(null);
    setForm({ ...emptyForm });
    setErrors({});
    setPreviewUrl(null);
    setPanelOpen(true);
  };

  const openEdit = (partner) => {
    setFeedback(null);
    setError(null);
    setEditing(partner);
    setForm(buildFormFromPartner(partner));
    setErrors({});
    setPreviewUrl(partner.logoUrl || null);
    setPanelOpen(true);
  };

  const updateField = (name, value) => {
    setForm((previous) => ({ ...previous, [name]: value }));
    setErrors((previous) => ({ ...previous, [name]: '' }));
  };

  const handleLogoChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const isImage = /^image\/(jpeg|png|webp)$/.test(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name);
    if (!isImage) {
      const message = 'Sélectionnez un logo au format JPG, PNG ou WebP.';
      setErrors((previous) => ({ ...previous, logo: message }));
      setFeedback({ type: 'error', message });
      event.target.value = '';
      return;
    }

    if (file.size > MAX_LOGO_SIZE_BYTES) {
      const message = `Le logo ne doit pas dépasser ${MAX_LOGO_LABEL}.`;
      setErrors((previous) => ({ ...previous, logo: message }));
      setFeedback({ type: 'error', message });
      event.target.value = '';
      return;
    }

    setErrors((previous) => ({ ...previous, logo: '' }));
    setFeedback(null);
    setPreviewUrl(URL.createObjectURL(file));
    setForm((previous) => ({ ...previous, logo: file }));
  };

  const validateForm = () => {
    const nextErrors = {};

    if (!form.name.trim()) {
      nextErrors.name = 'Le nom du partenaire est requis.';
    }

    if (!editing && !form.logo) {
      nextErrors.logo = 'Veuillez sélectionner un logo.';
    }

    if (String(form.websiteUrl || '').trim()) {
      try {
        const normalized = new URL(form.websiteUrl);
        if (!/^https?:$/i.test(normalized.protocol)) {
          nextErrors.websiteUrl = 'Le lien doit commencer par http:// ou https://.';
        }
      } catch {
        nextErrors.websiteUrl = 'Le lien du site web est invalide.';
      }
    }

    if (!Number.isFinite(Number(form.sortOrder)) || Number(form.sortOrder) < 0) {
      nextErrors.sortOrder = 'L’ordre d’affichage doit être un nombre positif.';
    }

    return nextErrors;
  };

  const buildPayload = () => {
    const payload = new FormData();
    payload.append('name', form.name.trim());
    payload.append('website_url', form.websiteUrl.trim());
    payload.append('sort_order', String(Number(form.sortOrder) || 0));
    payload.append('is_active', form.isActive ? '1' : '0');

    if (form.logo) {
      payload.append('logo', form.logo);
    }

    return payload;
  };

  const normalizeServerErrors = (apiError) => {
    const source = apiError?.errors || apiError?.payload?.errors;
    if (!source || typeof source !== 'object') {
      return {};
    }

    return Object.entries(source).reduce((accumulator, [key, value]) => {
      const message = Array.isArray(value) ? value[0] : value;
      if (!message) {
        return accumulator;
      }

      const mappedKey = key === 'website_url' ? 'websiteUrl' : key === 'sort_order' ? 'sortOrder' : key;
      accumulator[mappedKey] = message;
      return accumulator;
    }, {});
  };

  const savePartner = async (event) => {
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
      const payload = buildPayload();
      const response = editing
        ? await adminAPI.updatePartner(editing.id, payload)
        : await adminAPI.createPartner(payload);

      setFeedback({
        type: 'success',
        message: response?.message || (editing
          ? 'Logo partenaire mis à jour avec succès.'
          : 'Logo partenaire ajouté avec succès.'),
      });
      closePanel();
      broadcastLiveUpdate('partners');
      await fetchPartners();
    } catch (saveError) {
      if (saveError?.isSessionExpired) {
        return;
      }

      const mappedErrors = normalizeServerErrors(saveError);
      if (Object.keys(mappedErrors).length > 0) {
        setErrors(mappedErrors);
      }

      setFeedback({
        type: 'error',
        message: saveError.message || 'Impossible d’enregistrer le partenaire.',
      });
    } finally {
      setSaving(false);
    }
  };

  const askDelete = (partner) => {
    if (!canDeletePartners) {
      setFeedback({
        type: 'error',
        message: 'Seul le superadmin peut supprimer un partenaire.',
      });
      return;
    }

    setConfirm({
      message: `Supprimer le logo de ${partner.name} ?`,
      onConfirm: async () => {
        try {
          await adminAPI.deletePartner(partner.id);
          setFeedback({
            type: 'success',
            message: `Le logo de ${partner.name} a été supprimé.`,
          });
          broadcastLiveUpdate('partners');
          await fetchPartners();
        } catch (deleteError) {
          if (deleteError?.isSessionExpired) {
            return;
          }

          setFeedback({
            type: 'error',
            message: deleteError.message || 'La suppression a échoué.',
          });
        } finally {
          setConfirm(null);
        }
      },
    });
  };

  const togglePartnerStatus = async (partner) => {
    setSaving(true);
    try {
      const payload = new FormData();
      payload.append('name', partner.name);
      payload.append('website_url', partner.websiteUrl);
      payload.append('sort_order', String(partner.sortOrder || 0));
      payload.append('is_active', partner.isActive ? '0' : '1');
      const response = await adminAPI.updatePartner(partner.id, payload);
      setFeedback({
        type: 'success',
        message: response?.message || `Le statut de ${partner.name} a été mis à jour.`,
      });
      broadcastLiveUpdate('partners');
      await fetchPartners();
    } catch (toggleError) {
      if (toggleError?.isSessionExpired) {
        return;
      }

      setFeedback({
        type: 'error',
        message: toggleError.message || 'Impossible de modifier le statut.',
      });
    } finally {
      setSaving(false);
    }
  };

  const renderCard = (partner) => (
    <motion.article
      key={partner.id}
      className="apartners-card"
      initial={{ opacity: 0, y: 22, scale: 0.96, filter: 'blur(8px)' }}
      whileInView={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
      viewport={{ once: false, amount: 0.18 }}
      transition={{ duration: 0.66, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -6 }}
    >
      <div className="apartners-card-media">
        {partner.logoUrl ? (
          <img src={partner.logoUrl} alt={partner.name} className="apartners-card-image" loading="lazy" decoding="async" />
        ) : (
          <div className="apartners-card-placeholder">
            <span>{(partner.name?.trim().charAt(0) || 'P').toUpperCase()}</span>
          </div>
        )}
        <div className="apartners-card-overlay">
          <span className={`apartners-status-pill ${partner.isActive ? 'active' : 'inactive'}`}>
            {partner.isActive ? 'Actif' : 'Inactif'}
          </span>
          <span className="apartners-order-pill">#{String(partner.sortOrder || 0).padStart(2, '0')}</span>
        </div>
      </div>

      <div className="apartners-card-body">
        <h3>{partner.name}</h3>
        <p className="apartners-card-url">
          {partner.websiteUrl ? (
            <a href={partner.websiteUrl} target="_blank" rel="noreferrer">
              {partner.websiteUrl}
            </a>
          ) : (
            'Aucun site web renseigné'
          )}
        </p>

        <div className="apartners-card-meta">
          <span>Ajouté le {formatDate(partner.createdAt)}</span>
          <span>Mis à jour le {formatDate(partner.updatedAt)}</span>
        </div>

        <div className="apartners-card-actions">
          <button type="button" className="ag-btn ag-btn-ghost" onClick={() => togglePartnerStatus(partner)} disabled={saving}>
            {partner.isActive ? 'Désactiver' : 'Activer'}
          </button>
          <button type="button" className="ag-btn ag-btn-outline" onClick={() => openEdit(partner)} disabled={saving}>
            Modifier
          </button>
          {canDeletePartners && (
            <button type="button" className="ag-btn ag-btn-danger" onClick={() => askDelete(partner)} disabled={saving}>
              Supprimer
            </button>
          )}
        </div>
      </div>
    </motion.article>
  );

  return (
    <div className="admin-page apartners">
      <AnimatePresence>
        {confirm && (
          <ConfirmModal
            message={confirm.message}
            onConfirm={confirm.onConfirm}
            onCancel={() => setConfirm(null)}
          />
        )}
      </AnimatePresence>

      <div className="apartners-header">
        <div className="apartners-header-copy">
          <span className="ag-badge ag-badge-gold">Carousel public</span>
          <h1>Gestion des partenaires</h1>
          <p>Ajoutez les logos qui seront affichés dans le carrousel automatique du site public, avec une taille uniforme et une boucle infinie.</p>
        </div>

        <div className="apartners-header-actions">
          <button type="button" className="ag-btn ag-btn-primary" onClick={openCreate}>
            Ajouter un logo
          </button>
        </div>
      </div>

      {feedback && (
        <FeedbackBanner
          type={feedback.type}
          message={feedback.message}
          onClose={() => setFeedback(null)}
        />
      )}

      {error && (
        <div className="apartners-error-shell">
          <div className="apartners-empty-icon" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M8.5 14.5l-1.2 1.2a3.5 3.5 0 01-4.95-4.95l3-3a3.5 3.5 0 014.95 0l1.1 1.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M15.5 9.5l1.2-1.2a3.5 3.5 0 014.95 4.95l-3 3a3.5 3.5 0 01-4.95 0l-1.1-1.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h3>Chargement impossible</h3>
          <p>{error}</p>
          <button type="button" className="ag-btn ag-btn-primary" onClick={retryFetchPartners}>
            Réessayer
          </button>
        </div>
      )}

      {!error && !loading && (
        <>
          <div className="apartners-stats">
            {stats.map((stat) => (
              <div key={stat.label} className={`apartners-stat-card tone-${stat.tone}`}>
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </div>
            ))}
          </div>

          <div className="apartners-toolbar">
            <div className="apartners-search-wrap">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" />
                <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <input
                type="search"
                className="ag-input apartners-search"
                placeholder="Rechercher un partenaire…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            <select
              className="ag-input ag-select apartners-filter"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              {['Tous', 'Actifs', 'Inactifs'].map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>

          {filteredPartners.length > 0 ? (
            <div className="apartners-grid">
              {filteredPartners.map(renderCard)}
            </div>
          ) : (
            <div className="apartners-empty-state">
              <div className="apartners-empty-icon" aria-hidden="true">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <path d="M8.5 14.5l-1.2 1.2a3.5 3.5 0 01-4.95-4.95l3-3a3.5 3.5 0 014.95 0l1.1 1.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M15.5 9.5l1.2-1.2a3.5 3.5 0 014.95 4.95l-3 3a3.5 3.5 0 01-4.95 0l-1.1-1.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h3>Aucun partenaire trouvé</h3>
              <p>Ajoutez un premier logo ou ajustez vos filtres pour retrouver les partenaires existants.</p>
              <button type="button" className="ag-btn ag-btn-primary" onClick={openCreate}>
                Ajouter un logo
              </button>
            </div>
          )}
        </>
      )}

      {loading && (
        <div className="loading-container">
          <Loader />
          <p>Chargement des partenaires...</p>
        </div>
      )}

      <AnimatePresence>
        {panelOpen && (
          <>
            <motion.div
              className="apartners-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closePanel}
            />

            <motion.aside
              className="apartners-panel"
              initial={{ x: 460 }}
              animate={{ x: 0 }}
              exit={{ x: 460 }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="apartners-panel-header">
                <div>
                  <span className="ag-badge ag-badge-info">{editing ? 'Modification' : 'Nouvel ajout'}</span>
                  <h2>{editing ? 'Modifier le partenaire' : 'Ajouter un partenaire'}</h2>
                </div>
                <button type="button" className="apartners-panel-close" onClick={closePanel}>
                  ×
                </button>
              </div>

              <form className="apartners-panel-form" onSubmit={savePartner}>
                <div className="apartners-panel-body">
                  <label className="apartners-field">
                    <span>Nom du partenaire</span>
                    <input
                      type="text"
                      className="ag-input"
                      value={form.name}
                      onChange={(event) => updateField('name', event.target.value)}
                      placeholder="Ex. Université partenaire"
                    />
                    {errors.name && <small className="acand-field-error">{errors.name}</small>}
                  </label>

                  <label className="apartners-field">
                    <span>Lien du site web</span>
                    <input
                      type="url"
                      className="ag-input"
                      value={form.websiteUrl}
                      onChange={(event) => updateField('websiteUrl', event.target.value)}
                      placeholder="https://..."
                    />
                    {errors.websiteUrl && <small className="acand-field-error">{errors.websiteUrl}</small>}
                  </label>

                  <div className="apartners-inline-grid">
                    <label className="apartners-field">
                      <span>Ordre d’affichage</span>
                      <input
                        type="number"
                        min="0"
                        className="ag-input"
                        value={form.sortOrder}
                        onChange={(event) => updateField('sortOrder', event.target.value)}
                      />
                      {errors.sortOrder && <small className="acand-field-error">{errors.sortOrder}</small>}
                    </label>

                    <label className="apartners-field">
                      <span>Statut</span>
                      <select
                        className="ag-input ag-select"
                        value={form.isActive ? '1' : '0'}
                        onChange={(event) => updateField('isActive', event.target.value === '1')}
                      >
                        <option value="1">Actif</option>
                        <option value="0">Inactif</option>
                      </select>
                    </label>
                  </div>

                  <div className="apartners-upload">
                    <div className="apartners-upload-preview">
                      {previewUrl ? (
                        <img src={previewUrl} alt="Prévisualisation du logo" className="apartners-upload-image" />
                      ) : (
                        <div className="apartners-upload-placeholder">
                          <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
                            <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.8" />
                            <path d="M8 13l2.5-2.5L14 14l2-2 3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            <circle cx="8.5" cy="9" r="1.5" fill="currentColor" />
                          </svg>
                          <span>Aperçu du logo</span>
                        </div>
                      )}
                    </div>

                    <div className="apartners-upload-actions">
                      <label className="ag-btn ag-btn-outline apartners-upload-button">
                        Choisir un logo
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={handleLogoChange}
                          hidden
                        />
                      </label>
                      <p>
                        Formats acceptés: JPG, PNG, WebP. Taille maximale {MAX_LOGO_LABEL}. Le logo sera affiché dans le carousel avec une taille uniforme.
                      </p>
                      {errors.logo && <small className="acand-field-error">{errors.logo}</small>}
                    </div>
                  </div>
                </div>

                <div className="apartners-panel-footer">
                  <button type="button" className="ag-btn ag-btn-ghost" onClick={closePanel} disabled={saving}>
                    Annuler
                  </button>
                  <button type="submit" className="ag-btn ag-btn-primary" disabled={saving}>
                    {saving ? 'Enregistrement…' : editing ? 'Mettre à jour' : 'Ajouter le logo'}
                  </button>
                </div>
              </form>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminPartners;
