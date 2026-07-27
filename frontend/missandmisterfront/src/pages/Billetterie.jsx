import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { billetterieAPI } from '../services/api';
import { resolveMediaUrl } from '../utils/mediaUrl';
import Loader from '../components/Loader';
import './Billetterie.css';

const normalizeEvent = (item) => {
  const types = item.ticket_types || item.ticketTypes || [];
  const prices = types.map(t => Number(t.price || 0)).filter(p => p > 0);
  return {
    id: item.id,
    uuid: item.uuid,
    title: item.title || item.name || 'Événement',
    description: item.description || '',
    date: item.event_date || item.date || item.start_date || '',
    location: item.location || item.venue || '',
    imageUrl: resolveMediaUrl(item.image_url || item.image || item.poster_url || (item.image_path ? `storage/${item.image_path}` : null)),
    priceMin: prices.length > 0 ? Math.min(...prices) : null,
    priceMax: prices.length > 0 ? Math.max(...prices) : null,
    currency: item.currency || 'XOF',
    status: item.status || 'published',
    ticketCount: types.length,
  };
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'long', year: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

const formatPrice = (min, max, currency) => {
  if (min === null && max === null) return '';
  if (min === null) return `${max.toLocaleString('fr-FR')} ${currency}`;
  if (max === null || min === max) return `${min.toLocaleString('fr-FR')} ${currency}`;
  return `À partir de ${min.toLocaleString('fr-FR')} ${currency}`;
};

const Billetterie = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const hasLoadedRef = useRef(false);

  const loadEvents = async () => {
    const isInitialLoad = !hasLoadedRef.current;
    try {
      if (isInitialLoad) setLoading(true);
      const response = await billetterieAPI.getEvents();
      const list = Array.isArray(response) ? response : (response?.data || []);
      setEvents(list.map(normalizeEvent));
      setError(null);
      hasLoadedRef.current = true;
    } catch (err) {
      if (isInitialLoad) {
        setError(err.message || 'Impossible de charger les événements.');
      }
    } finally {
      if (isInitialLoad) {
        hasLoadedRef.current = true;
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!hasLoadedRef.current) {
      loadEvents();
    }
  }, []);

  const retryLoad = () => {
    hasLoadedRef.current = false;
    loadEvents();
  };

  return (
    <div className="billetterie-page">
      {/* Hero */}
      <section className="bilh-hero">
        <div className="bilh-hero-bg" aria-hidden="true">
          <div className="bilh-orb bilh-orb-1" />
          <div className="bilh-orb bilh-orb-2" />
          <div className="bilh-orb bilh-orb-3" />
        </div>
        <div className="container">
          <motion.div
            className="bilh-hero-content"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <h1 className="bilh-hero-title">
              <span className="bilh-hero-title-line-1">Événements &amp; Billetterie</span>
            </h1>
            <p className="bilh-hero-sub">
              Découvrez nos événements à venir et procurez-vous vos billets en quelques clics.
              <br />
              Places limitées — réservez dès maintenant.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Events */}
      {loading ? (
        <section className="bilh-section section">
          <div className="container">
            <div className="bilh-loading">
              <Loader />
              <p>Chargement des événements...</p>
            </div>
          </div>
        </section>
      ) : error ? (
        <section className="bilh-section section">
          <div className="container">
            <div className="bilh-state-card">
              <div className="bilh-state-icon bilh-state-icon--error">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </div>
              <h3>Erreur de chargement</h3>
              <p>{error}</p>
              <button type="button" className="bilh-btn bilh-btn-primary" onClick={retryLoad}>
                Réessayer
              </button>
            </div>
          </div>
        </section>
      ) : events.length === 0 ? (
        <section className="bilh-section section">
          <div className="container">
            <div className="bilh-state-card">
              <div className="bilh-state-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M8 2v4M16 2v4M3 10h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <h3>Aucun événement disponible</h3>
              <p>Il n&rsquo;y a pas d&rsquo;événement en vente pour le moment. Revenez bientôt.</p>
            </div>
          </div>
        </section>
      ) : (
        <section className="bilh-section section">
          <div className="container">
            <div className="bilh-events-grid">
              {events.map((event, index) => (
                <motion.div
                  key={event.uuid}
                  className="bilh-event-card"
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: Math.min(index * 0.08, 0.3), ease: [0.22, 1, 0.36, 1] }}
                  whileHover={{ y: -8 }}
                >
                  <Link to={`/billetterie/${event.uuid}`} className="bilh-event-card-link">
                    <div className="bilh-event-card-img">
                      {event.imageUrl ? (
                        <img src={event.imageUrl} alt={event.title} loading="lazy" decoding="async" />
                      ) : (
                        <div className="bilh-event-card-placeholder">
                          <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                            <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1"/>
                            <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/>
                            <path d="M21 15l-5-5L5 21" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      )}
                      <div className="bilh-event-card-badge">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                          <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="2"/>
                          <path d="M2 10h20" stroke="currentColor" strokeWidth="2"/>
                        </svg>
                        {event.ticketCount} billet{event.ticketCount > 1 ? 's' : ''}
                      </div>
                    </div>

                    <div className="bilh-event-card-body">
                      <h3 className="bilh-event-card-title">{event.title}</h3>

                      <div className="bilh-event-card-meta">
                        {event.date && (
                          <div className="bilh-event-card-meta-item">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                              <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                              <path d="M8 2v4M16 2v4M3 10h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                            </svg>
                            <span>{formatDate(event.date)}</span>
                          </div>
                        )}
                        {event.location && (
                          <div className="bilh-event-card-meta-item">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="currentColor" strokeWidth="1.5"/>
                              <circle cx="12" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
                            </svg>
                            <span>{event.location}</span>
                          </div>
                        )}
                      </div>

                      {event.description && (
                        <p className="bilh-event-card-desc">
                          {event.description.length > 120 ? event.description.slice(0, 120) + '…' : event.description}
                        </p>
                      )}

                      <div className="bilh-event-card-footer">
                        <span className="bilh-event-card-price">
                          {formatPrice(event.priceMin, event.priceMax, event.currency)}
                        </span>
                        <span className="bilh-event-card-cta">
                          Voir & réserver
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                            <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </span>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default Billetterie;
