import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOutletContext } from 'react-router-dom';
import { galleryAPI } from '../services/api';
import Loader from '../components/Loader';
import { resolveMediaUrl } from '../utils/mediaUrl';
import { useAutoRefresh } from '../utils/liveUpdates';
import './Gallery.css';

const DEFAULT_CATEGORIES = ['Cérémonie', 'Candidats', 'Coulisses', 'Gala'];

const normalizePhoto = (item) => ({
  id: item.id,
  category: item.category || DEFAULT_CATEGORIES[0],
  alt: item.alt_text || item.title || 'Photo de galerie',
  title: item.title || 'Photo de galerie',
  caption: item.caption || '',
  span: item.layout_span === 'standard' ? '' : (item.layout_span || ''),
  imageUrl: resolveMediaUrl(item.image_url || item.image_path || null),
});

const PhotoCard = ({ photo, onClick }) => {
  const [failed, setFailed] = useState(false);

  return (
    <motion.div
      className={`gallery-item ${photo.span}`}
      layout
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.88 }}
      transition={{ duration: 0.35 }}
      whileHover={{ scale: 1.02 }}
      onClick={() => onClick(photo)}
      role="button"
      tabIndex={0}
      aria-label={photo.alt}
      onKeyDown={(event) => event.key === 'Enter' && onClick(photo)}
    >
      {!failed && photo.imageUrl ? (
        <img
          src={photo.imageUrl}
          alt={photo.alt}
          className="gallery-image"
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="gallery-placeholder">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="3" width="18" height="18" rx="2" stroke="rgba(212,175,55,0.3)" strokeWidth="1.5" />
            <circle cx="8.5" cy="8.5" r="1.5" fill="rgba(212,175,55,0.3)" />
            <path d="M21 15l-5-5L5 21" stroke="rgba(212,175,55,0.3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}
      <div className="gallery-item-overlay">
        <span className="gallery-cat-tag">{photo.category}</span>
        <p className="gallery-alt">{photo.title}</p>
      </div>
    </motion.div>
  );
};

const Lightbox = ({ photo, onClose, onPrev, onNext }) => {
  const [failed, setFailed] = useState(false);

  return (
    <motion.div
      className="lightbox-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="lightbox-content"
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.85, opacity: 0 }}
        onClick={(event) => event.stopPropagation()}
      >
        <button className="lb-close" onClick={onClose} aria-label="Fermer">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>

        <button className="lb-nav lb-prev" onClick={onPrev} aria-label="Précédent">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <div className="lb-image-wrap">
          {!failed && photo.imageUrl ? (
            <img
              src={photo.imageUrl}
              alt={photo.alt}
              className="lb-image"
              loading="eager"
              decoding="sync"
              onError={() => setFailed(true)}
            />
          ) : (
            <div className="gallery-placeholder">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="3" width="18" height="18" rx="2" stroke="rgba(212,175,55,0.25)" strokeWidth="1.2" />
                <circle cx="8.5" cy="8.5" r="1.5" fill="rgba(212,175,55,0.25)" />
                <path d="M21 15l-5-5L5 21" stroke="rgba(212,175,55,0.25)" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </div>
          )}
        </div>

        <button className="lb-nav lb-next" onClick={onNext} aria-label="Suivant">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <div className="lb-info">
          <span className="gallery-cat-tag">{photo.category}</span>
          <div>
            <p className="lb-title">{photo.title}</p>
            {photo.caption ? <p>{photo.caption}</p> : null}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

const Gallery = () => {
  const [activeCategory, setActiveCategory] = useState('Tout');
  const [lightbox, setLightbox] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const hasLoadedRef = useRef(false);
  const { publicSettings = null } = useOutletContext() || {};

  const isGalleryPublic = publicSettings?.gallery_public !== false;

  const loadGallery = async () => {
    const isInitialLoad = !hasLoadedRef.current;

    try {
      if (isInitialLoad) {
        setLoading(true);
      }

      const response = await galleryAPI.getAll();
      setPhotos((response?.data || []).map(normalizePhoto));
      setError(null);
      hasLoadedRef.current = true;
    } catch (galleryError) {
      if (isInitialLoad) {
        setError(galleryError.message || 'Impossible de charger la galerie pour le moment.');
      }
    } finally {
      if (isInitialLoad) {
        hasLoadedRef.current = true;
        setLoading(false);
      }
    }
  };

  useAutoRefresh(loadGallery, { enabled: isGalleryPublic });

  const retryLoadGallery = async () => {
    hasLoadedRef.current = false;
    await loadGallery();
  };

  const categories = useMemo(() => {
    const discovered = Array.from(new Set(photos.map((photo) => photo.category).filter(Boolean)));
    const orderedDefaults = DEFAULT_CATEGORIES.filter((category) => discovered.includes(category));
    const extras = discovered.filter((category) => !DEFAULT_CATEGORIES.includes(category)).sort();
    const finalCategories = [...orderedDefaults, ...extras];
    return ['Tout', ...(finalCategories.length ? finalCategories : DEFAULT_CATEGORIES)];
  }, [photos]);

  const filtered = activeCategory === 'Tout'
    ? photos
    : photos.filter((photo) => photo.category === activeCategory);

  useEffect(() => {
    if (lightbox && !filtered.some((photo) => photo.id === lightbox.id)) {
      setLightbox(filtered[0] || null);
    }
  }, [filtered, lightbox]);

  const openLightbox = (photo) => setLightbox(photo);
  const closeLightbox = () => setLightbox(null);

  const navigate = (direction) => {
    if (!lightbox || filtered.length === 0) return;
    const index = filtered.findIndex((photo) => photo.id === lightbox.id);
    const nextIndex = (index + direction + filtered.length) % filtered.length;
    setLightbox(filtered[nextIndex]);
  };

  return (
    <div className="gallery-page">
      <section className="gallery-hero">
        <div className="gallery-hero-bg" aria-hidden="true">
          <div className="gal-orb orb-1" />
          <div className="gal-orb orb-2" />
        </div>
        <div className="container">
          <motion.div className="gallery-hero-content" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}>
            <span className="page-eyebrow">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
                <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
                <path d="M21 15l-5-5L5 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Galerie officielle
            </span>
            <h1>Galerie <span className="text-gold">Photos</span></h1>
            <p>Revivez les meilleurs moments du concours Miss &amp; Mister University Bénin 2026.</p>
            <div className="gallery-count-pill">{photos.length} photo{photos.length > 1 ? 's' : ''}</div>
          </motion.div>
        </div>
      </section>

      {!isGalleryPublic ? (
        <section className="gallery-grid-section section">
          <div className="container">
            <div className="gallery-state-card">
              <h3>Galerie temporairement masquée</h3>
              <p>L’organisation a momentanément désactivé l’accès public à la galerie. Revenez un peu plus tard.</p>
            </div>
          </div>
        </section>
      ) : loading ? (
        <section className="gallery-grid-section section">
          <div className="container">
            <div className="loading-container">
              <Loader />
              <p>Chargement de la galerie...</p>
            </div>
          </div>
        </section>
      ) : error ? (
        <section className="gallery-grid-section section">
          <div className="container">
            <div className="gallery-state-card">
              <h3>Erreur de chargement</h3>
              <p>{error}</p>
              <button type="button" className="btn btn-primary" onClick={retryLoadGallery}>Réessayer</button>
            </div>
          </div>
        </section>
      ) : (
        <>
          <section className="gallery-filters-section">
            <div className="container">
              <motion.div className="gallery-filter-bar" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                {categories.map((category) => {
                  const count = category === 'Tout'
                    ? photos.length
                    : photos.filter((photo) => photo.category === category).length;

                  return (
                    <button
                      key={category}
                      className={`gallery-filter-btn ${activeCategory === category ? 'active' : ''}`}
                      onClick={() => setActiveCategory(category)}
                    >
                      {category}
                      <span className="gf-count">{count}</span>
                    </button>
                  );
                })}
              </motion.div>
            </div>
          </section>

          <section className="gallery-grid-section section">
            <div className="container">
              <motion.div className="gallery-grid" layout>
                <AnimatePresence mode="popLayout">
                  {filtered.map((photo) => (
                    <PhotoCard key={photo.id} photo={photo} onClick={openLightbox} />
                  ))}
                </AnimatePresence>
              </motion.div>

              {filtered.length === 0 && (
                <div className="gallery-empty">
                  <p>Aucune photo dans cette catégorie.</p>
                </div>
              )}
            </div>
          </section>
        </>
      )}

      <AnimatePresence>
        {lightbox && (
          <Lightbox
            photo={lightbox}
            onClose={closeLightbox}
            onPrev={() => navigate(-1)}
            onNext={() => navigate(1)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default Gallery;
