import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { adminAPI } from '../../services/api';
import Loader from '../../components/Loader';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import { broadcastLiveUpdate, useAutoRefresh } from '../../utils/liveUpdates';
import './admin-theme.css';
import './AdminGallery.css';

const DEFAULT_CATEGORIES = ['Cérémonie', 'Candidats', 'Coulisses', 'Gala'];
const SPAN_OPTIONS = [
  { value: 'standard', label: 'Standard' },
  { value: 'wide', label: 'Large' },
  { value: 'tall', label: 'Vertical' },
];
const MAX_IMAGE_SIZE_BYTES = 20 * 1024 * 1024;

const emptyForm = {
  title: '',
  category: DEFAULT_CATEGORIES[0],
  altText: '',
  caption: '',
  layoutSpan: 'standard',
  sortOrder: 0,
  isPublished: true,
  image: null,
};

const FeedbackBanner = ({ type = 'info', message, onClose }) => (
  <div className={`agal-banner agal-banner-${type}`}>
    <span>{message}</span>
    <button type="button" className="agal-banner-close" onClick={onClose}>×</button>
  </div>
);

const ConfirmModal = ({ message, onConfirm, onCancel }) => (
  <AnimatePresence>
    <motion.div className="agal-confirm-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onCancel}>
      <motion.div className="agal-confirm-modal" initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 20 }} onClick={(event) => event.stopPropagation()}>
        <div className="agal-confirm-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="#F4D03F" strokeWidth="2" />
            <path d="M12 9v4M12 17h.01" stroke="#F4D03F" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <p>{message}</p>
        <div className="agal-confirm-actions">
          <button type="button" className="ag-btn ag-btn-ghost" onClick={onCancel}>Annuler</button>
          <button type="button" className="ag-btn ag-btn-danger" onClick={onConfirm}>Confirmer</button>
        </div>
      </motion.div>
    </motion.div>
  </AnimatePresence>
);

const normalizeItem = (item) => ({
  id: item.id,
  title: item.title || 'Photo de galerie',
  category: item.category || DEFAULT_CATEGORIES[0],
  altText: item.alt_text || item.title || 'Photo de galerie',
  caption: item.caption || '',
  imageUrl: resolveMediaUrl(item.image_url || item.image_path || null),
  imageMeta: item.image_meta || null,
  layoutSpan: item.layout_span || 'standard',
  sortOrder: Number(item.sort_order || 0),
  isPublished: Boolean(item.is_published),
  publishedAt: item.published_at || null,
  createdAt: item.created_at || null,
});

const buildFormFromItem = (item) => ({
  title: item.title || '',
  category: item.category || DEFAULT_CATEGORIES[0],
  altText: item.altText || item.title || '',
  caption: item.caption || '',
  layoutSpan: item.layoutSpan || 'standard',
  sortOrder: Number(item.sortOrder || 0),
  isPublished: Boolean(item.isPublished),
  image: null,
});

const AdminGallery = () => {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Tous');
  const [statusFilter, setStatusFilter] = useState('Tous');
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [errors, setErrors] = useState({});
  const [confirm, setConfirm] = useState(null);
  const hasLoadedRef = useRef(false);

  useEffect(() => () => {
    if (previewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
  }, [previewUrl]);

  const fetchGallery = async () => {
    const isInitialLoad = !hasLoadedRef.current;

    try {
      if (isInitialLoad) {
        setLoading(true);
      }

      const response = await adminAPI.getGalleryItems();
      const rows = (response?.data || []).map(normalizeItem);
      setItems(rows);
      setCategories(response?.categories?.length ? response.categories : DEFAULT_CATEGORIES);
      hasLoadedRef.current = true;
    } catch (error) {
      if (error?.isSessionExpired) {
        return;
      }

      if (isInitialLoad) {
        setFeedback({
          type: 'error',
          message: error.message || 'Impossible de charger la galerie admin.',
        });
      }
    } finally {
      if (isInitialLoad) {
        hasLoadedRef.current = true;
        setLoading(false);
      }
    }
  };

  useAutoRefresh(fetchGallery);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();

    return items.filter((item) => {
      const matchesQuery = !query
        || item.title.toLowerCase().includes(query)
        || item.category.toLowerCase().includes(query)
        || item.caption.toLowerCase().includes(query);
      const matchesCategory = categoryFilter === 'Tous' || item.category === categoryFilter;
      const matchesStatus = statusFilter === 'Tous'
        || (statusFilter === 'Publiées' && item.isPublished)
        || (statusFilter === 'Masquées' && !item.isPublished);

      return matchesQuery && matchesCategory && matchesStatus;
    });
  }, [items, search, categoryFilter, statusFilter]);

  const stats = useMemo(() => ([
    { label: 'Total', value: items.length, color: '#D4AF37' },
    { label: 'Publiées', value: items.filter((item) => item.isPublished).length, color: '#4ADE80' },
    { label: 'Masquées', value: items.filter((item) => !item.isPublished).length, color: '#F59E0B' },
    { label: 'Catégories', value: new Set(items.map((item) => item.category)).size, color: '#60A5FA' },
  ]), [items]);

  const resetPanel = () => {
    setPanelOpen(false);
    setEditing(null);
    setForm({ ...emptyForm, category: categories[0] || DEFAULT_CATEGORIES[0] });
    setErrors({});
    setPreviewUrl(null);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, category: categories[0] || DEFAULT_CATEGORIES[0] });
    setErrors({});
    setPreviewUrl(null);
    setFeedback(null);
    setPanelOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm(buildFormFromItem(item));
    setErrors({});
    setPreviewUrl(item.imageUrl);
    setFeedback(null);
    setPanelOpen(true);
  };

  const updateField = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isImage = /^image\/(jpeg|png|webp)$/.test(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name);
    if (!isImage) {
      const message = 'Sélectionnez une image JPG, PNG ou WebP.';
      setErrors((prev) => ({ ...prev, image: message }));
      setFeedback({ type: 'error', message });
      event.target.value = '';
      return;
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      const message = 'La photo ne doit pas dépasser 20 Mo.';
      setErrors((prev) => ({ ...prev, image: message }));
      setFeedback({ type: 'error', message });
      event.target.value = '';
      return;
    }

    if (previewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }

    setErrors((prev) => ({ ...prev, image: '' }));
    setFeedback(null);
    setPreviewUrl(URL.createObjectURL(file));
    setForm((prev) => ({ ...prev, image: file }));
  };

  const validateForm = () => {
    const nextErrors = {};

    if (!form.title.trim()) nextErrors.title = 'Le titre est requis.';
    if (!form.category.trim()) nextErrors.category = 'La catégorie est requise.';
    if (!editing && !form.image) nextErrors.image = 'Veuillez sélectionner une photo.';
    if (Number(form.sortOrder) < 0) nextErrors.sortOrder = 'L’ordre doit être positif.';

    return nextErrors;
  };

  const buildPayload = () => {
    const payload = new FormData();
    payload.append('title', form.title.trim());
    payload.append('category', form.category.trim());
    payload.append('alt_text', (form.altText || form.title).trim());
    payload.append('caption', form.caption.trim());
    payload.append('layout_span', form.layoutSpan);
    payload.append('sort_order', String(Number(form.sortOrder) || 0));
    payload.append('is_published', form.isPublished ? '1' : '0');
    if (form.image) {
      payload.append('image', form.image);
    }
    return payload;
  };

  const normalizeServerErrors = (error) => {
    const source = error?.errors || error?.payload?.errors;
    if (!source || typeof source !== 'object') return {};

    return Object.entries(source).reduce((acc, [key, value]) => {
      const message = Array.isArray(value) ? value[0] : value;
      if (!message) return acc;

      const mappedKey = key === 'alt_text' ? 'altText'
        : key === 'layout_span' ? 'layoutSpan'
        : key === 'sort_order' ? 'sortOrder'
        : key;
      acc[mappedKey] = message;
      return acc;
    }, {});
  };

  const handleSave = async () => {
    const nextErrors = validateForm();
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setFeedback({ type: 'error', message: 'Veuillez corriger les champs en erreur avant de continuer.' });
      return;
    }

    setSaving(true);
    setFeedback(null);

    try {
      const payload = buildPayload();
      const response = editing
        ? await adminAPI.updateGalleryItem(editing.id, payload)
        : await adminAPI.createGalleryItem(payload);
      const item = normalizeItem(response?.item || response);

      setItems((prev) => {
        if (editing) {
          return prev.map((entry) => (entry.id === item.id ? item : entry));
        }
        return [item, ...prev];
      });

      setCategories((prev) => Array.from(new Set([...(prev || []), item.category])));
      setFeedback({
        type: 'success',
        message: editing
          ? 'Photo de galerie mise à jour avec succès.'
          : 'Photo de galerie ajoutée avec succès.',
      });
      broadcastLiveUpdate('gallery');
      resetPanel();
    } catch (error) {
      if (error?.isSessionExpired) {
        return;
      }
      const serverErrors = normalizeServerErrors(error);
      if (Object.keys(serverErrors).length > 0) {
        setErrors(serverErrors);
      }
      setFeedback({
        type: 'error',
        message: Object.values(serverErrors)[0] || error.message || 'Impossible d’enregistrer cette photo de galerie.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublish = (item) => {
    setConfirm({
      message: item.isPublished
        ? `Masquer "${item.title}" de la galerie publique ?`
        : `Publier "${item.title}" dans la galerie publique ?`,
      onConfirm: async () => {
        try {
          const payload = new FormData();
          payload.append('is_published', item.isPublished ? '0' : '1');
          const response = await adminAPI.updateGalleryItem(item.id, payload);
          const updated = normalizeItem(response?.item || response);
          setItems((prev) => prev.map((entry) => (entry.id === updated.id ? updated : entry)));
          setFeedback({
            type: 'success',
            message: updated.isPublished
              ? 'La photo est maintenant visible dans la galerie publique.'
              : 'La photo a été retirée de la galerie publique.',
          });
          broadcastLiveUpdate('gallery');
        } catch (error) {
          if (error?.isSessionExpired) {
            return;
          }
          setFeedback({
            type: 'error',
            message: error.message || 'Impossible de modifier la visibilité de cette photo.',
          });
        } finally {
          setConfirm(null);
        }
      },
    });
  };

  const handleDelete = (item) => {
    setConfirm({
      message: `Supprimer définitivement "${item.title}" ?`,
      onConfirm: async () => {
        try {
          await adminAPI.deleteGalleryItem(item.id);
          setItems((prev) => prev.filter((entry) => entry.id !== item.id));
          setFeedback({ type: 'success', message: 'Photo de galerie supprimée avec succès.' });
          broadcastLiveUpdate('gallery');
        } catch (error) {
          if (error?.isSessionExpired) {
            return;
          }
          setFeedback({
            type: 'error',
            message: error.message || 'Impossible de supprimer cette photo.',
          });
        } finally {
          setConfirm(null);
        }
      },
    });
  };

  if (loading) {
    return (
      <div className="admin-page agal">
        <div className="loading-container"><Loader /><p>Chargement de la galerie...</p></div>
      </div>
    );
  }

  return (
    <div className="admin-page agal">
      <AnimatePresence>{confirm && <ConfirmModal {...confirm} onCancel={() => setConfirm(null)} />}</AnimatePresence>

      <div className="agal-header">
        <div>
          <h1>Galerie</h1>
          <p>Ajoutez, organisez et publiez les photos visibles sur la page galerie du site.</p>
        </div>
        <button type="button" className="ag-btn ag-btn-primary" onClick={openCreate}>
          Ajouter une photo
        </button>
      </div>

      {feedback && (
        <FeedbackBanner type={feedback.type} message={feedback.message} onClose={() => setFeedback(null)} />
      )}

      <div className="agal-stats">
        {stats.map((stat) => (
          <div key={stat.label} className="agal-stat-card">
            <strong style={{ color: stat.color }}>{stat.value}</strong>
            <span>{stat.label}</span>
          </div>
        ))}
      </div>

      <div className="agal-toolbar">
        <div className="agal-search-wrap">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" />
            <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            className="ag-input"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher une photo..."
          />
        </div>
        <select className="ag-input ag-select" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
          <option value="Tous">Toutes les catégories</option>
          {categories.map((category) => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>
        <select className="ag-input ag-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="Tous">Tous les statuts</option>
          <option value="Publiées">Publiées</option>
          <option value="Masquées">Masquées</option>
        </select>
      </div>

      {filteredItems.length === 0 ? (
        <div className="agal-empty">
          <p>Aucune photo ne correspond aux filtres actuels.</p>
        </div>
      ) : (
        <div className="agal-grid">
          {filteredItems.map((item) => (
            <motion.article key={item.id} className={`agal-card ${item.layoutSpan}`} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
              <div className="agal-card-media">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.altText} className="agal-card-image" loading="lazy" decoding="async" />
                ) : (
                  <div className="agal-card-placeholder">
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
                      <rect x="3" y="3" width="18" height="18" rx="2" stroke="rgba(212,175,55,0.3)" strokeWidth="1.5" />
                      <circle cx="8.5" cy="8.5" r="1.5" fill="rgba(212,175,55,0.3)" />
                      <path d="M21 15l-5-5L5 21" stroke="rgba(212,175,55,0.3)" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </div>
                )}
                <div className="agal-card-overlay">
                  <span className="agal-card-category">{item.category}</span>
                  <span className={`agal-card-status ${item.isPublished ? 'published' : 'hidden'}`}>
                    {item.isPublished ? 'Publiée' : 'Masquée'}
                  </span>
                </div>
              </div>

              <div className="agal-card-body">
                <h3>{item.title}</h3>
                <p>{item.caption || 'Sans description complémentaire.'}</p>
                <div className="agal-card-meta">
                  <span>Format: {SPAN_OPTIONS.find((option) => option.value === item.layoutSpan)?.label || 'Standard'}</span>
                  <span>Ordre: {item.sortOrder}</span>
                </div>
              </div>

              <div className="agal-card-actions">
                <button type="button" className="ag-btn ag-btn-outline" onClick={() => openEdit(item)}>Modifier</button>
                <button type="button" className="ag-btn ag-btn-ghost" onClick={() => handleTogglePublish(item)}>
                  {item.isPublished ? 'Masquer' : 'Publier'}
                </button>
                <button type="button" className="ag-btn ag-btn-danger" onClick={() => handleDelete(item)}>Supprimer</button>
              </div>
            </motion.article>
          ))}
        </div>
      )}

      <AnimatePresence>
        {panelOpen && (
          <>
            <motion.div className="agal-panel-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={resetPanel} />
            <motion.aside className="agal-panel" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 260, damping: 28 }}>
              <div className="agal-panel-header">
                <div>
                  <h2>{editing ? 'Modifier la photo' : 'Ajouter une photo'}</h2>
                  <p>Cette fiche pilote directement le rendu de la page galerie publique.</p>
                </div>
                <button type="button" className="agal-panel-close" onClick={resetPanel}>×</button>
              </div>

              <div className="agal-panel-body">
                <div className="agal-form-group">
                  <label className="ag-label">Aperçu</label>
                  <label className="agal-upload-box">
                    {previewUrl ? (
                      <img src={previewUrl} alt="Aperçu de la photo" className="agal-upload-preview" />
                    ) : (
                      <div className="agal-upload-placeholder">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                          <rect x="3" y="3" width="18" height="18" rx="2" stroke="rgba(212,175,55,0.3)" strokeWidth="1.5" />
                          <circle cx="8.5" cy="8.5" r="1.5" fill="rgba(212,175,55,0.3)" />
                          <path d="M21 15l-5-5L5 21" stroke="rgba(212,175,55,0.3)" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                        <span>Cliquer pour choisir une photo</span>
                        <small>JPG, PNG ou WebP · max 20 Mo</small>
                      </div>
                    )}
                    <input type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" onChange={handleImageChange} />
                  </label>
                  {errors.image && <span className="agal-field-error">{errors.image}</span>}
                </div>

                <div className="agal-form-group">
                  <label className="ag-label">Titre</label>
                  <input className="ag-input" value={form.title} onChange={(event) => updateField('title', event.target.value)} placeholder="Ex: Soirée d’ouverture officielle" />
                  {errors.title && <span className="agal-field-error">{errors.title}</span>}
                </div>

                <div className="agal-form-grid">
                  <div className="agal-form-group">
                    <label className="ag-label">Catégorie</label>
                    <select className="ag-input ag-select" value={form.category} onChange={(event) => updateField('category', event.target.value)}>
                      {categories.map((category) => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                    {errors.category && <span className="agal-field-error">{errors.category}</span>}
                  </div>

                  <div className="agal-form-group">
                    <label className="ag-label">Format de carte</label>
                    <select className="ag-input ag-select" value={form.layoutSpan} onChange={(event) => updateField('layoutSpan', event.target.value)}>
                      {SPAN_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                    {errors.layoutSpan && <span className="agal-field-error">{errors.layoutSpan}</span>}
                  </div>
                </div>

                <div className="agal-form-group">
                  <label className="ag-label">Texte alternatif</label>
                  <input className="ag-input" value={form.altText} onChange={(event) => updateField('altText', event.target.value)} placeholder="Description courte pour l’accessibilité" />
                  {errors.altText && <span className="agal-field-error">{errors.altText}</span>}
                </div>

                <div className="agal-form-group">
                  <label className="ag-label">Description</label>
                  <textarea className="ag-input" rows="4" value={form.caption} onChange={(event) => updateField('caption', event.target.value)} placeholder="Texte affiché dans l’overlay et la lightbox" />
                  {errors.caption && <span className="agal-field-error">{errors.caption}</span>}
                </div>

                <div className="agal-form-grid">
                  <div className="agal-form-group">
                    <label className="ag-label">Ordre d’affichage</label>
                    <input className="ag-input" type="number" min="0" value={form.sortOrder} onChange={(event) => updateField('sortOrder', event.target.value)} />
                    {errors.sortOrder && <span className="agal-field-error">{errors.sortOrder}</span>}
                  </div>

                  <div className="agal-form-group agal-toggle-group">
                    <label className="ag-label">Visibilité</label>
                    <button type="button" className={`agal-toggle ${form.isPublished ? 'active' : ''}`} onClick={() => updateField('isPublished', !form.isPublished)}>
                      <span className="agal-toggle-dot" />
                      <span>{form.isPublished ? 'Visible publiquement' : 'Masquée publiquement'}</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="agal-panel-footer">
                <button type="button" className="ag-btn ag-btn-ghost" onClick={resetPanel}>Annuler</button>
                <button type="button" className="ag-btn ag-btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? 'Enregistrement...' : editing ? 'Enregistrer les modifications' : 'Ajouter à la galerie'}
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminGallery;
