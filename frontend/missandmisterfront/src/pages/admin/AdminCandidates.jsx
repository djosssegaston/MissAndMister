import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { adminAPI } from '../../services/api';
import { getCandidateImageSources } from '../../utils/candidateImage';
import { formatCandidatePublicNumber } from '../../utils/candidatePublic';
import Loader from '../../components/Loader';
import { ADMIN_LIVE_UPDATE_INTERVAL_MS, broadcastLiveUpdate, useAutoRefresh } from '../../utils/liveUpdates';
import './admin-theme.css';
import './AdminCandidates.css';

const RANKS_ICON = [
  <svg key="1" width="14" height="14" viewBox="0 0 24 24" fill="#FFD700"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>,
  <svg key="2" width="14" height="14" viewBox="0 0 24 24" fill="#C0C0C0"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>,
  <svg key="3" width="14" height="14" viewBox="0 0 24 24" fill="#CD7F32"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>,
];

const emptyForm = {
  name: '',
  publicNumber: '',
  email: '',
  password: '',
  confirmPassword: '',
  categoryId: null,
  university: '',
  age: '',
  city: '',
  bio: '',
  photo: null,
  video: null,
  videoName: '',
  existingVideoPath: null,
  existingVideoUrl: null,
  existingVideoLabel: '',
  active: true,
};

const MAX_PHOTO_SIZE_BYTES = 20 * 1024 * 1024;
const DEFAULT_MAX_VIDEO_SIZE_MB = 2048;
const rawVideoLimitMb = Number(import.meta.env.VITE_MAX_VIDEO_UPLOAD_MB || DEFAULT_MAX_VIDEO_SIZE_MB);
const MAX_VIDEO_SIZE_MB = Number.isFinite(rawVideoLimitMb) && rawVideoLimitMb > 0
  ? rawVideoLimitMb
  : DEFAULT_MAX_VIDEO_SIZE_MB;
const MAX_VIDEO_SIZE_BYTES = MAX_VIDEO_SIZE_MB * 1024 * 1024;
const MAX_VIDEO_SIZE_LABEL = MAX_VIDEO_SIZE_MB >= 1024
  ? `${Number.isInteger(MAX_VIDEO_SIZE_MB / 1024) ? MAX_VIDEO_SIZE_MB / 1024 : (MAX_VIDEO_SIZE_MB / 1024).toFixed(1).replace(/\.0$/, '')} Go`
  : `${MAX_VIDEO_SIZE_MB} Mo`;
const allowedVideoTypes = ['video/mp4', 'video/quicktime', 'video/x-m4v', 'video/webm'];

const apiFieldMap = {
  category_id: 'categoryId',
  password_confirmation: 'confirmPassword',
  photo: 'photo',
  video: 'video',
};

const FeedbackBanner = ({ type = 'info', message, onClose }) => (
  <div className={`acand-banner acand-banner-${type}`}>
    <span>{message}</span>
    <button className="banner-close" onClick={onClose} type="button">×</button>
  </div>
);

const buildCandidateForm = (candidate) => {
  const raw = candidate?.raw || candidate || {};
  const fullName = `${raw.first_name ?? ''} ${raw.last_name ?? ''}`.trim() || candidate?.name || '';

  return {
    name: fullName,
    publicNumber: raw.public_number ?? candidate?.publicNumber ?? '',
    email: raw.email || candidate?.email || raw.user?.email || '',
    password: '',
    confirmPassword: '',
    categoryId: candidate?.category?.id ?? raw.category?.id ?? raw.category_id ?? null,
    university: raw.university || candidate?.university || '',
    age: raw.age ?? candidate?.age ?? '',
    city: raw.city || candidate?.city || '',
    bio: raw.bio || raw.description || candidate?.bio || '',
    photo: null,
    video: null,
    videoName: raw.video_path ? 'Vidéo actuelle' : candidate?.videoName || '',
    existingVideoPath: raw.video_path || candidate?.videoPath || null,
    existingVideoUrl: raw.video_url || candidate?.videoUrl || null,
    existingVideoLabel: raw.video_path ? 'Vidéo actuelle' : '',
    active: raw.is_active ?? candidate?.active ?? raw.status === 'active',
  };
};

const buildCandidatePreview = (candidate) => {
  const raw = candidate?.raw || candidate || {};
  const sources = getCandidateImageSources(raw, 'medium');
  return sources.src || sources.medium || sources.large || sources.original || null;
};

const compareCandidatesByCategoryAndNumber = (leftCandidate, rightCandidate) => {
  const leftCategory = String(leftCandidate.category?.name || '').toLowerCase();
  const rightCategory = String(rightCandidate.category?.name || '').toLowerCase();
  const categoryCompare = leftCategory.localeCompare(rightCategory, 'fr', { sensitivity: 'base' });

  if (categoryCompare !== 0) {
    return categoryCompare;
  }

  const leftNumber = Number(leftCandidate.publicNumber ?? Number.MAX_SAFE_INTEGER);
  const rightNumber = Number(rightCandidate.publicNumber ?? Number.MAX_SAFE_INTEGER);

  if (leftNumber !== rightNumber) {
    return leftNumber - rightNumber;
  }

  return String(leftCandidate.name || '').localeCompare(String(rightCandidate.name || ''), 'fr', { sensitivity: 'base' });
};

const sortCandidates = (rows = []) => [...rows]
  .sort(compareCandidatesByCategoryAndNumber)
  .map((candidate, index) => ({
    ...candidate,
    rank: index + 1,
  }));

const getNextPublicNumberForCategory = (rows = [], categoryId) => rows.reduce((max, candidate) => {
  if (String(candidate.category?.id ?? '') !== String(categoryId ?? '')) {
    return max;
  }

  const value = Number(candidate.publicNumber || 0);
  return Number.isFinite(value) && value > max ? value : max;
}, 0) + 1;

const hasCategoryNumberConflict = (rows = [], categoryId, publicNumber, ignoreCandidateId = null) => rows.some((candidate) => {
  if (String(candidate.category?.id ?? '') !== String(categoryId ?? '')) {
    return false;
  }

  if (ignoreCandidateId !== null && Number(candidate.id) === Number(ignoreCandidateId)) {
    return false;
  }

  return Number(candidate.publicNumber || 0) === Number(publicNumber || 0);
});

const ConfirmModal = ({ message, onConfirm, onCancel }) => (
  <AnimatePresence>
    <motion.div className="agc-overlay" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} onClick={onCancel}>
      <motion.div className="agc-modal" initial={{ scale:0.88, y:24 }} animate={{ scale:1, y:0 }} exit={{ scale:0.88, y:24 }} onClick={e => e.stopPropagation()}>
        <div className="agc-modal-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="#F4D03F" strokeWidth="2"/>
            <path d="M12 9v4M12 17h.01" stroke="#F4D03F" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
        <p>{message}</p>
        <div className="agc-modal-actions">
          <button className="ag-btn ag-btn-ghost" onClick={onCancel}>Annuler</button>
          <button className="ag-btn ag-btn-danger" onClick={onConfirm}>Confirmer</button>
        </div>
      </motion.div>
    </motion.div>
  </AnimatePresence>
);

const AdminCandidates = () => {
  const [candidates, setCandidates] = useState([]);
  const [search,     setSearch]     = useState('');
  const [catFilter,  setCatFilter]  = useState('Tous');
  const [panelOpen,  setPanelOpen]  = useState(false);
  const [editing,    setEditing]    = useState(null);
  const [form,       setForm]       = useState(emptyForm);
  const [confirm,    setConfirm]    = useState(null);
  const [preview,    setPreview]    = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState(null);
  const [feedback,   setFeedback]   = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [categories, setCategories] = useState([]);
  const [page, setPage] = useState(1);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const hasLoadedRef = useRef(false);
  const perPage = 10;
  const adminRole = (() => {
    try {
      return JSON.parse(localStorage.getItem('adminUser') || 'null')?.role || 'admin';
    } catch {
      return 'admin';
    }
  })();
  const canDeleteCandidates = adminRole === 'superadmin';

  const mapCandidate = (c, idx = 0, catList = categories) => {
    const catId = c.category?.id ?? c.category_id;
    const catName = c.category?.name
      || (catList || []).find(cat => String(cat.id) === String(catId))?.name
      || c.category
      || '—';
    const imageSources = getCandidateImageSources(c, 'medium');

    return {
      id: c.id,
      publicNumber: c.public_number ?? null,
      number: formatCandidatePublicNumber(c.public_number),
      name: `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || c.name || '—',
      category: { name: catName, id: catId },
      university: c.university || 'N/A',
      age: c.age || '',
      city: c.city || '',
      email: c.email || c.user?.email || '',
      votes: c.votes_count ?? c.votes ?? 0,
      rank: c.rank ?? idx + 1,
      active: c.is_active ?? c.status === 'active',
      photoUrl: imageSources.src || imageSources.medium || imageSources.large || imageSources.original || null,
      photoProcessingStatus: c.photo_processing_status || 'idle',
      photoProcessingError: c.photo_processing_error || '',
      videoName: c.video_path ? 'Vidéo' : '',
      videoPath: c.video_path || null,
      videoUrl: c.video_url || null,
      raw: c,
    };
  };

  const fetchAll = async () => {
    const isInitialLoad = !hasLoadedRef.current;

    try {
      if (isInitialLoad) {
        setLoading(true);
      }

      const [cats, list] = await Promise.all([
        adminAPI.getCategories(),
        adminAPI.getCandidates({ per_page: 200 }),
      ]);

      const catList = cats?.data || cats || [];
      setCategories(catList);
      const rows = sortCandidates((list?.data || list || []).map((c, idx) => mapCandidate(c, idx, catList)));
      setCandidates(rows);
      setError(null);
      setAutoRefreshEnabled(true);
      hasLoadedRef.current = true;
    } catch (err) {
      if (err?.isSessionExpired) {
        return;
      }

      setAutoRefreshEnabled(false);

      if (isInitialLoad) {
        setError(err.message || 'Erreur de chargement');
      }
    } finally {
      if (isInitialLoad) {
        hasLoadedRef.current = true;
        setLoading(false);
      }
    }
  };

  useAutoRefresh(fetchAll, {
    intervalMs: ADMIN_LIVE_UPDATE_INTERVAL_MS,
    enabled: autoRefreshEnabled,
  });

  const retryFetchAll = async () => {
    hasLoadedRef.current = false;
    setAutoRefreshEnabled(true);
    await fetchAll();
  };

  const filtered = useMemo(() => candidates.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) || c.university.toLowerCase().includes(search.toLowerCase());
    const matchCat    = catFilter === 'Tous' || c.category?.name === catFilter;
    return matchSearch && matchCat;
  }), [candidates, search, catFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, catFilter, candidates.length]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paginatedCandidates = useMemo(() => {
    const start = (page - 1) * perPage;
    return filtered.slice(start, start + perPage);
  }, [filtered, page]);

  const openAdd  = () => {
    const defaultCatId = categories[0]?.id ?? null;
    const nextPublicNumber = getNextPublicNumberForCategory(candidates, defaultCatId);
    setForm({ ...emptyForm, categoryId: defaultCatId, publicNumber: String(nextPublicNumber) });
    setFormErrors({});
    setError(null);
    setFeedback(null);
    setPreview(null);
    setEditing(null);
    setPanelOpen(true);
  };
  const openEdit = c  => {
    setForm(buildCandidateForm(c));
    setFormErrors({});
    setError(null);
    setFeedback(null);
    setPreview(buildCandidatePreview(c));
    setEditing(c.id);
    setPanelOpen(true);
  };

  const updateField = (name, value) => {
    setForm(prev => {
      if (name === 'categoryId') {
        const nextPublicNumber = getNextPublicNumberForCategory(candidates, value);
        const currentPublicNumber = Number(prev.publicNumber || 0);
        const shouldReplacePublicNumber = !editing
          || currentPublicNumber < 1
          || hasCategoryNumberConflict(candidates, value, currentPublicNumber, editing);

        return {
          ...prev,
          categoryId: value,
          publicNumber: shouldReplacePublicNumber ? String(nextPublicNumber) : prev.publicNumber,
        };
      }

      return { ...prev, [name]: value };
    });
    setFormErrors(prev => ({ ...prev, [name]: '' }));
    setFeedback(null);
  };

  const validateForm = () => {
    const next = {};
    const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{10,}$/;

    if (!form.name.trim()) next.name = 'Le nom complet est requis';
    if (!form.publicNumber || Number(form.publicNumber) < 1) next.publicNumber = "Le numéro d'ordre est requis";
    if (!form.categoryId) next.categoryId = 'La catégorie est requise';
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = 'Adresse email invalide';
    if (!form.city.trim()) next.city = 'La ville est requise';

    if (form.password && !form.email.trim()) {
      next.email = "Renseignez un email avant de définir un mot de passe d'accès";
    }

    if (form.password && !passwordPattern.test(form.password)) {
      next.password = '10 caracteres min avec majuscule, minuscule, chiffre et symbole';
    }

    if (form.password !== form.confirmPassword) {
      next.confirmPassword = 'Les mots de passe ne correspondent pas';
    }

    return next;
  };

  const buildPayload = () => {
    const [firstName, ...rest] = (form.name || '').trim().split(' ');
    const lastName = rest.join(' ') || firstName || '';
    const category = categories.find(cat => String(cat.id) === String(form.categoryId))
      || categories.find(cat => cat.name?.toLowerCase() === (form.categoryId || '').toString().toLowerCase());
    return {
      category_id: category?.id,
      first_name: firstName || 'N/A',
      last_name: lastName || 'N/A',
      public_number: Number(form.publicNumber),
      email: form.email.trim() || null,
      university: form.university.trim() || null,
      age: form.age ? Number(form.age) : null,
      city: form.city.trim(),
      bio: form.bio.trim() || null,
      description: form.bio.trim() || null,
      is_active: form.active,
      status: form.active ? 'active' : 'inactive',
      ...(form.password ? {
        password: form.password,
        password_confirmation: form.confirmPassword,
      } : {}),
    };
  };

  const closePanel = () => {
    setPanelOpen(false);
    setFormErrors({});
    setForm({ ...emptyForm, categoryId: categories[0]?.id ?? null });
    setPreview(null);
    setEditing(null);
  };

  const normalizeApiErrors = (err) => {
    const source = err?.errors || err?.payload?.errors;
    if (!source || typeof source !== 'object') return {};

    return Object.entries(source).reduce((acc, [key, value]) => {
      const message = Array.isArray(value) ? value[0] : value;
      if (!message) return acc;
      acc[apiFieldMap[key] || key] = message;
      return acc;
    }, {});
  };

  const getApiErrorMessage = (err, fallback) => {
    const fieldErrors = normalizeApiErrors(err);
    return Object.values(fieldErrors)[0] || err?.validationMessage || err?.message || fallback;
  };

  const handleDelete = (cand) => {
    if (!canDeleteCandidates) {
      setFeedback({
        type: 'error',
        message: 'Seul le superadmin peut désactiver ou supprimer un candidat.',
      });
      return;
    }

    setConfirm({
      message: `Supprimer ${cand.name} ? Cette action est irréversible.`,
      onConfirm: async () => {
        try {
          await adminAPI.deleteCandidate(cand.id);
          setCandidates(previousCandidates => sortCandidates(previousCandidates.filter(c => c.id !== cand.id)));
          setFeedback({ type: 'success', message: `${cand.name} a été désactivé avec succès.` });
          broadcastLiveUpdate('candidates');
        } catch (err) {
          if (err?.isSessionExpired) {
            return;
          }
          setFeedback({ type: 'error', message: getApiErrorMessage(err, 'Échec de la suppression du candidat.') });
        } finally {
          setConfirm(null);
        }
      }
    });
  };

  const handleToggle = (cand) => {
    const nextState = !cand.active;
    setConfirm({
      message: `${nextState ? 'Activer' : 'Désactiver'} ${cand.name} ?`,
      onConfirm: async () => {
        try {
          await adminAPI.toggleCandidateStatus(cand.id, nextState);
          setCandidates(previousCandidates => sortCandidates(previousCandidates.map(c => c.id === cand.id ? { ...c, active: nextState } : c)));
          setFeedback({
            type: 'success',
            message: `${cand.name} est maintenant ${nextState ? 'actif' : 'inactif'}.`,
          });
          broadcastLiveUpdate('candidates');
        } catch (err) {
          if (err?.isSessionExpired) {
            return;
          }
          setFeedback({ type: 'error', message: getApiErrorMessage(err, 'Échec de la mise à jour du statut.') });
        } finally {
          setConfirm(null);
        }
      }
    });
  };

  const handleSave = async () => {
    const nextErrors = validateForm();
    if (Object.keys(nextErrors).length > 0) {
      setFormErrors(nextErrors);
      setFeedback({
        type: 'error',
        message: 'Veuillez corriger les champs en erreur avant de continuer.',
      });
      return;
    }

    const payload = buildPayload();
    if (!payload.category_id) {
      setFeedback({ type: 'error', message: 'Catégorie introuvable.' });
      return;
    }

    setSaving(true);
    setError(null);
    setFeedback(null);
    setFormErrors({});

    try {
      let workingCandidate = null;
      const mediaErrors = {};
      let photoProcessingQueued = false;

      if (editing) {
        const res = await adminAPI.updateCandidate(editing, payload);
        workingCandidate = res.candidate || res;

        if (form.photo) {
          try {
            const upload = await adminAPI.uploadCandidatePhoto(editing, form.photo);
            photoProcessingQueued = Boolean(upload.processing);
            workingCandidate = {
              ...workingCandidate,
              ...(upload.candidate || {}),
              photo_path: upload.photo_path ?? upload.candidate?.photo_path ?? workingCandidate?.photo_path,
              photo_url: upload.photo_url ?? upload.candidate?.photo_url ?? workingCandidate?.photo_url,
              photo_urls: upload.photo_urls ?? upload.candidate?.photo_urls ?? workingCandidate?.photo_urls,
            };
          } catch (photoError) {
            if (photoError?.isSessionExpired) {
              throw photoError;
            }
            mediaErrors.photo = getApiErrorMessage(photoError, 'La photo n’a pas pu être importée.');
          }
        }
        if (form.video) {
          try {
            const upload = await adminAPI.uploadCandidateVideo(editing, form.video);
            workingCandidate = {
              ...workingCandidate,
              ...(upload.candidate || {}),
              video_path: upload.video_path ?? upload.candidate?.video_path ?? workingCandidate?.video_path,
              video_url: upload.video_url ?? upload.candidate?.video_url ?? workingCandidate?.video_url,
            };
          } catch (videoError) {
            if (videoError?.isSessionExpired) {
              throw videoError;
            }
            mediaErrors.video = getApiErrorMessage(videoError, 'La vidéo n’a pas pu être importée.');
          }
        }

        const updated = mapCandidate(workingCandidate, candidates.findIndex(c => c.id === editing));
        setCandidates(previousCandidates => sortCandidates(previousCandidates.map(c => c.id === editing ? updated : c)));

        if (Object.keys(mediaErrors).length > 0) {
          setFormErrors(mediaErrors);
          setForm(buildCandidateForm(updated));
          setPreview(buildCandidatePreview(updated));
          setFeedback({
            type: 'warning',
            message: 'Les informations du candidat ont été enregistrées, mais certains fichiers n’ont pas pu être envoyés. Corrigez les erreurs ci-dessous puis réessayez.',
          });
          return;
        }

        setFeedback({
          type: photoProcessingQueued ? 'info' : 'success',
          message: photoProcessingQueued
            ? 'Candidat mis à jour. La photo est en cours de traitement automatique.'
            : 'Candidat mis à jour avec succès.',
        });
        broadcastLiveUpdate('candidates');
      } else {
        const res = await adminAPI.createCandidate(payload);
        workingCandidate = res.candidate || res;

        if (form.photo) {
          try {
            const upload = await adminAPI.uploadCandidatePhoto(workingCandidate.id, form.photo);
            photoProcessingQueued = Boolean(upload.processing);
            workingCandidate = {
              ...workingCandidate,
              ...(upload.candidate || {}),
              photo_path: upload.photo_path ?? upload.candidate?.photo_path ?? workingCandidate?.photo_path,
              photo_url: upload.photo_url ?? upload.candidate?.photo_url ?? workingCandidate?.photo_url,
              photo_urls: upload.photo_urls ?? upload.candidate?.photo_urls ?? workingCandidate?.photo_urls,
            };
          } catch (photoError) {
            if (photoError?.isSessionExpired) {
              throw photoError;
            }
            mediaErrors.photo = getApiErrorMessage(photoError, 'La photo n’a pas pu être importée.');
          }
        }
        if (form.video) {
          try {
            const upload = await adminAPI.uploadCandidateVideo(workingCandidate.id, form.video);
            workingCandidate = {
              ...workingCandidate,
              ...(upload.candidate || {}),
              video_path: upload.video_path ?? upload.candidate?.video_path ?? workingCandidate?.video_path,
              video_url: upload.video_url ?? upload.candidate?.video_url ?? workingCandidate?.video_url,
            };
          } catch (videoError) {
            if (videoError?.isSessionExpired) {
              throw videoError;
            }
            mediaErrors.video = getApiErrorMessage(videoError, 'La vidéo n’a pas pu être importée.');
          }
        }

        const created = mapCandidate(workingCandidate, candidates.length);
        setCandidates(previousCandidates => sortCandidates([created, ...previousCandidates]));

        if (Object.keys(mediaErrors).length > 0) {
          setEditing(created.id);
          setFormErrors(mediaErrors);
          setForm(buildCandidateForm(created));
          setPreview(buildCandidatePreview(created));
          setFeedback({
            type: 'warning',
            message: 'Le candidat a été créé, mais certains fichiers n’ont pas pu être envoyés. Vous pouvez corriger et réessayer immédiatement.',
          });
          return;
        }

        setFeedback({
          type: photoProcessingQueued ? 'info' : 'success',
          message: photoProcessingQueued
            ? 'Candidat créé. La photo est en cours de traitement automatique.'
            : 'Candidat créé avec succès.',
        });
        broadcastLiveUpdate('candidates');
      }

      closePanel();
    } catch (err) {
      if (err?.isSessionExpired) {
        return;
      }
      const backendErrors = normalizeApiErrors(err);
      if (Object.keys(backendErrors).length > 0) {
        setFormErrors(backendErrors);
      }
      setFeedback({
        type: 'error',
        message: getApiErrorMessage(err, 'Échec de l’enregistrement du candidat.'),
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImageFile = file.type.startsWith('image/') || /\.(jpe?g|png|webp)$/i.test(file.name);

    if (!isImageFile) {
      const message = 'Sélectionnez une image valide au format JPG, PNG ou WebP.';
      setFormErrors(prev => ({ ...prev, photo: message }));
      setFeedback({ type: 'error', message });
      e.target.value = '';
      return;
    }

    if (file.size > MAX_PHOTO_SIZE_BYTES) {
      const message = 'La photo ne doit pas dépasser 20 Mo.';
      setFormErrors(prev => ({ ...prev, photo: message }));
      setFeedback({ type: 'error', message });
      e.target.value = '';
      return;
    }

    setFeedback(null);
    setFormErrors(prev => ({ ...prev, photo: '' }));
    setPreview(URL.createObjectURL(file));
    setForm(f => ({ ...f, photo: file }));
  };

  const handleVideo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isAllowedVideo = allowedVideoTypes.includes(file.type) || /\.(mp4|mov|m4v|webm)$/i.test(file.name);

    if (!isAllowedVideo) {
      const message = 'Sélectionnez une vidéo MP4, MOV, M4V ou WebM.';
      setFormErrors(prev => ({ ...prev, video: message }));
      setFeedback({ type: 'error', message });
      e.target.value = '';
      return;
    }

    if (file.size > MAX_VIDEO_SIZE_BYTES) {
      const message = `La vidéo ne doit pas dépasser ${MAX_VIDEO_SIZE_LABEL}.`;
      setFormErrors(prev => ({ ...prev, video: message }));
      setFeedback({ type: 'error', message });
      e.target.value = '';
      return;
    }

    setFeedback(null);
    setFormErrors(prev => ({ ...prev, video: '' }));
    setForm(f => ({ ...f, video: file, videoName: file.name }));
  };

  const handleDeleteCurrentVideo = () => {
    if (!editing || !form.existingVideoPath) {
      return;
    }

    setConfirm({
      message: 'Supprimer définitivement la vidéo actuelle de ce candidat ?',
      onConfirm: async () => {
        try {
          const response = await adminAPI.updateCandidate(editing, { video_path: null });
          const workingCandidate = response?.candidate || response || {};
          const updated = mapCandidate(workingCandidate, candidates.findIndex(c => c.id === editing));

          setCandidates((previousCandidates) => sortCandidates(previousCandidates.map((candidate) => (
            candidate.id === editing ? updated : candidate
          ))));
          setForm((previousForm) => ({
            ...previousForm,
            video: null,
            videoName: '',
            existingVideoPath: null,
            existingVideoUrl: null,
            existingVideoLabel: '',
          }));
          setFeedback({ type: 'success', message: 'La vidéo du candidat a été supprimée.' });
          broadcastLiveUpdate('candidates');
        } catch (err) {
          if (err?.isSessionExpired) {
            return;
          }
          setFeedback({
            type: 'error',
            message: getApiErrorMessage(err, 'Impossible de supprimer la vidéo du candidat.'),
          });
        } finally {
          setConfirm(null);
        }
      },
    });
  };

  const stats = [
    { label:'Total',  value: candidates.length,                                    color:'#D4AF37' },
    { label:'Miss',   value: candidates.filter(c => c.category?.name?.toLowerCase() === 'miss').length,   color:'#f472b6' },
    { label:'Mister', value: candidates.filter(c => c.category?.name?.toLowerCase() === 'mister').length, color:'#60a5fa' },
    { label:'Actifs', value: candidates.filter(c => c.active).length,               color:'#4ADE80' },
  ];

  if (loading) {
    return (
      <div className="admin-page acand">
        <div className="loading-container"><Loader /><p>Chargement des candidats...</p></div>
      </div>
    );
  }

    return (
    <div className="admin-page acand">
      {feedback && !panelOpen && (
        <FeedbackBanner
          type={feedback.type}
          message={feedback.message}
          onClose={() => setFeedback(null)}
        />
      )}
      {confirm && <ConfirmModal {...confirm} onCancel={() => setConfirm(null)} />}

      {/* Header */}
      <div className="acand-header">
        <div>
          <h1>Gestion des candidats</h1>
          <p>Enregistrez et gérez les candidats du concours</p>
        </div>
        <button className="ag-btn ag-btn-primary" onClick={openAdd}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
          Ajouter un candidat
        </button>
      </div>

      {error && (
        <div className="error-container" style={{ marginBottom: '1rem' }}>
          <p style={{ margin: 0 }}>{error}</p>
          <button className="btn-gold" onClick={retryFetchAll}>Réessayer</button>
        </div>
      )}

      {/* Stats mini */}
      <div className="acand-stats">
        {stats.map((s, i) => (
          <motion.div key={i} className="acand-stat" initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay: i * 0.07 }}>
            <span className="acand-stat-val" style={{ color: s.color }}>{s.value}</span>
            <span className="acand-stat-lbl">{s.label}</span>
          </motion.div>
        ))}
      </div>

      {/* Filtres */}
      <div className="acand-filters">
        <div className="acand-search-wrap">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="acand-search-icon">
            <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
            <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <input className="ag-input acand-search" placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="acand-cat-tabs">
          {['Tous','Miss','Mister'].map(t => (
            <button key={t} className={`acand-tab ${catFilter === t ? 'active' : ''}`} onClick={() => setCatFilter(t)}>{t}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      <motion.div className="ag-card acand-table-card" initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.2 }}>
        <div className="acand-table-wrap">
          <table className="ag-table ag-table-responsive">
            <thead>
              <tr>
                <th>N°</th>
                <th>Candidat</th>
                <th>Catégorie</th>
                <th>Université</th>
                <th>Vidéo</th>
                <th>Votes</th>
                <th>Rang</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedCandidates.map(c => (
                <motion.tr key={c.id} initial={{ opacity:0 }} animate={{ opacity:1 }}>
                  <td data-label="N°"><span className="acand-num">{c.number === '—' ? '—' : `#${c.number}`}</span></td>
                  <td data-label="Candidat">
                    <div className="acand-identity">
                      <div className="acand-avatar">{c.name.charAt(0)}</div>
                      <div>
                        <p className="acand-name">{c.name}</p>
                        <p className="acand-city">{c.city}</p>
                      </div>
                    </div>
                  </td>
                  <td data-label="Catégorie"><span className={`ag-badge ${c.category?.name?.toLowerCase() === 'miss' ? 'adash-miss' : 'adash-mister'}`}>{c.category?.name}</span></td>
                  <td data-label="Université" style={{ color:'var(--ag-text-3)', fontSize:'0.83rem' }}>{c.university}</td>
                  <td data-label="Vidéo">
                    {c.videoName
                      ? <span className="acand-video-tag">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><polygon points="5 3 19 12 5 21 5 3" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/></svg>
                          Vidéo
                        </span>
                      : <span className="acand-video-empty">—</span>
                    }
                  </td>
                  <td data-label="Votes"><span className="acand-votes">{c.votes.toLocaleString('fr-FR')}</span></td>
                  <td data-label="Rang">
                    <div className="acand-rank">
                      {c.rank <= 3 ? RANKS_ICON[c.rank - 1] : null}
                      <span>#{c.rank}</span>
                    </div>
                  </td>
                  <td data-label="Statut">
                    <button className={`acand-status-toggle ${c.active ? 'active' : 'inactive'}`} onClick={() => handleToggle(c)}>
                      <span className="acand-status-dot" />
                      {c.active ? 'Actif' : 'Inactif'}
                    </button>
                  </td>
                  <td data-label="Actions">
                    <div className="acand-actions">
                      <button className="ag-btn ag-btn-ghost acand-edit-btn" onClick={() => openEdit(c)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </button>
                      {canDeleteCandidates && (
                        <button className="ag-btn ag-btn-danger acand-del-btn" onClick={() => handleDelete(c)}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M10 11v6M14 11v6M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                        </button>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign:'center', padding:'2rem', color:'var(--ag-text-3)' }}>Aucun candidat trouvé</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="acand-pagination">
          <button
            className="ag-btn ag-btn-ghost"
            type="button"
            onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
            disabled={page <= 1}
          >
            En arrière
          </button>
          <span className="acand-page-indicator">
            Page {Math.min(page, totalPages)} / {totalPages}
          </span>
          <button
            className="ag-btn ag-btn-outline"
            type="button"
            onClick={() => setPage((currentPage) => Math.min(totalPages, currentPage + 1))}
            disabled={page >= totalPages}
          >
            En suivant
          </button>
        </div>
      </motion.div>

      {/* Panel formulaire */}
      <AnimatePresence>
        {panelOpen && (
          <>
            <motion.div className="agc-overlay" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} onClick={closePanel} />
            <motion.aside className="acand-panel"
              initial={{ x:'100%' }} animate={{ x:0 }} exit={{ x:'100%' }}
              transition={{ type:'spring', stiffness:280, damping:30 }}>

              <div className="acand-panel-header">
                <h3>{editing ? 'Modifier le candidat' : 'Nouveau candidat'}</h3>
                <button className="acand-panel-close" onClick={closePanel} type="button">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                </button>
              </div>

              <div className="acand-panel-body">
                {feedback && panelOpen && (
                  <FeedbackBanner
                    type={feedback.type}
                    message={feedback.message}
                    onClose={() => setFeedback(null)}
                  />
                )}

                {/* Upload photo */}
                <div className="acand-photo-upload">
                  <div className="acand-photo-preview">
                    {preview
                      ? <img src={preview} alt="preview" />
                      : <svg width="32" height="32" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="rgba(212,175,55,0.3)" strokeWidth="1.5"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="rgba(212,175,55,0.3)" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    }
                  </div>
                  <div className="acand-photo-actions">
                    <label className="ag-btn ag-btn-outline" style={{ cursor:'pointer' }}>
                      Choisir une photo
                      <input type="file" accept="image/*" style={{ display:'none' }} onChange={handlePhoto} />
                    </label>
                    <p className="acand-photo-hint">Format conseille: 2000 x 1200 px (ratio 5:3), max 20 Mo.</p>
                  </div>
                </div>
                {formErrors.photo && <span className="acand-field-error">{formErrors.photo}</span>}

                {/* Upload vidéo */}
                <div className="ag-form-group">
                  <label className="ag-label">Vidéo de présentation</label>
                  <div className="acand-video-upload">
                    {form.videoName ? (
                      <div className="acand-video-preview">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <polygon points="5 3 19 12 5 21 5 3" stroke="#D4AF37" strokeWidth="2" strokeLinejoin="round"/>
                        </svg>
                        <span>{form.videoName}</span>
                        {form.video ? (
                          <button
                            className="acand-video-remove"
                            onClick={() => setForm((previousForm) => ({
                              ...previousForm,
                              video: null,
                              videoName: previousForm.existingVideoLabel || '',
                            }))}
                            type="button"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                          </button>
                        ) : form.existingVideoPath ? (
                          <button className="acand-video-remove" onClick={handleDeleteCurrentVideo} type="button" disabled={saving}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                    <label className="acand-video-drop">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <polygon points="5 3 19 12 5 21 5 3" stroke="rgba(212,175,55,0.3)" strokeWidth="1.5" strokeLinejoin="round"/>
                      </svg>
                      <span>Cliquer pour choisir une vidéo MP4, MOV, M4V ou WebM</span>
                      <small>Max {MAX_VIDEO_SIZE_LABEL}. Les gros envois peuvent prendre plusieurs minutes.</small>
                      <input type="file" accept="video/mp4,video/quicktime,video/x-m4v,video/webm,.mp4,.mov,.m4v,.webm" style={{ display:'none' }} onChange={handleVideo} />
                    </label>
                    {editing && form.existingVideoPath && !form.video ? (
                      <small className="acand-video-hint">La vidéo actuelle peut être remplacée ou supprimée directement.</small>
                    ) : null}
                  </div>
                  {formErrors.video && <span className="acand-field-error">{formErrors.video}</span>}
                </div>

                {/* Champs texte */}
                <div className="ag-form-group acand-form-grid">
                  <div>
                    <label className="ag-label">Nom complet</label>
                    <input className="ag-input" value={form.name} onChange={e => updateField('name', e.target.value)} placeholder="Prénom NOM" />
                    {formErrors.name && <span className="acand-field-error">{formErrors.name}</span>}
                  </div>
                  <div>
                    <label className="ag-label">Numéro d'ordre public</label>
                    <input
                      className="ag-input"
                      type="number"
                      min="1"
                      value={form.publicNumber}
                      onChange={e => updateField('publicNumber', e.target.value)}
                      placeholder="Ex: 15"
                    />
                    {formErrors.publicNumber && <span className="acand-field-error">{formErrors.publicNumber}</span>}
                  </div>
                </div>

                <div className="ag-form-group acand-form-grid">
                  <div>
                    <label className="ag-label">Catégorie</label>
                    <select
                      className="ag-input ag-select"
                      value={form.categoryId ?? ''}
                      onChange={e => updateField('categoryId', e.target.value)}
                    >
                      <option value="" disabled>Sélectionner</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                    {formErrors.categoryId && <span className="acand-field-error">{formErrors.categoryId}</span>}
                  </div>
                </div>

                <div className="ag-form-group acand-form-grid">
                  <div>
                    <label className="ag-label">Email de connexion</label>
                    <input className="ag-input" type="email" value={form.email} onChange={e => updateField('email', e.target.value)} placeholder="Optionnel pour l'instant" />
                    {formErrors.email && <span className="acand-field-error">{formErrors.email}</span>}
                  </div>
                  <div className="acand-account-note">
                    <span className="acand-account-pill">{editing ? 'Accès candidat' : 'Création simple'}</span>
                    <p>{editing ? "Ajoutez l'email et un mot de passe plus tard pour créer ou réinitialiser l'accès candidat." : "Vous pouvez créer le candidat sans accès. L'email et le mot de passe pourront être ajoutés plus tard."}</p>
                  </div>
                </div>

                <div className="ag-form-group">
                  <label className="ag-label">Université</label>
                  <input className="ag-input" value={form.university} onChange={e => updateField('university', e.target.value)} placeholder="Ex: UAC" />
                </div>

                <div className="ag-form-group acand-form-grid">
                  <div>
                    <label className="ag-label">Âge</label>
                    <input className="ag-input" type="number" value={form.age} onChange={e => updateField('age', e.target.value)} placeholder="22" />
                  </div>
                  <div>
                    <label className="ag-label">Ville</label>
                    <input className="ag-input" value={form.city} onChange={e => updateField('city', e.target.value)} placeholder="Cotonou" />
                    {formErrors.city && <span className="acand-field-error">{formErrors.city}</span>}
                  </div>
                </div>

                {editing ? (
                  <div className="ag-form-group acand-form-grid">
                    <div>
                      <label className="ag-label">Mot de passe temporaire</label>
                      <input className="ag-input" type="password" value={form.password} onChange={e => updateField('password', e.target.value)} placeholder="Renseigner pour créer ou réinitialiser l'accès" autoComplete="new-password" />
                      {formErrors.password && <span className="acand-field-error">{formErrors.password}</span>}
                    </div>
                    <div>
                      <label className="ag-label">Confirmer le mot de passe</label>
                      <input className="ag-input" type="password" value={form.confirmPassword} onChange={e => updateField('confirmPassword', e.target.value)} placeholder="Confirmer le mot de passe" autoComplete="new-password" />
                      {formErrors.confirmPassword && <span className="acand-field-error">{formErrors.confirmPassword}</span>}
                    </div>
                  </div>
                ) : null}

                <div className="ag-form-group">
                  <label className="ag-label">Biographie</label>
                  <textarea className="ag-input" rows={4} value={form.bio} onChange={e => updateField('bio', e.target.value)} placeholder="Présentation du candidat..." style={{ resize:'vertical' }} />
                </div>

              </div>

              <div className="acand-panel-footer">
                <button className="ag-btn ag-btn-ghost" onClick={closePanel} type="button">Annuler</button>
                <button className="ag-btn ag-btn-primary" onClick={handleSave} disabled={saving} type="button">
                  {saving ? 'Sauvegarde…' : editing ? 'Enregistrer les modifications' : 'Créer le candidat'}
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminCandidates;
