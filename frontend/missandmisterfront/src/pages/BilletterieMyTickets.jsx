import { useEffect, useRef, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import { billetterieAPI } from '../services/api';
import Loader from '../components/Loader';
import './BilletterieMyTickets.css';

const WHATSAPP_PHONE = '22955748787';

const formatDate = (d) => {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return d;
  }
};

const getStatusLabel = (status) => {
  const map = {
    active: 'Actif',
    used: 'Utilisé',
    expired: 'Expiré',
    cancelled: 'Annulé',
    pending: 'En attente',
  };
  return map[status] || status || 'Actif';
};

const BilletterieMyTickets = () => {
  const { user } = useOutletContext() || {};
  const isLoggedIn = Boolean(user);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const hasLoadedRef = useRef(false);

  const loadTickets = async () => {
    try {
      setLoading(true);
      const response = await billetterieAPI.getMyTickets();
      setTickets(Array.isArray(response?.data) ? response.data : Array.isArray(response) ? response : []);
      setError(null);
      hasLoadedRef.current = true;
    } catch (err) {
      if (!hasLoadedRef.current) {
        setError(err.message || 'Impossible de charger vos billets.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoggedIn && !hasLoadedRef.current) {
      loadTickets();
    }
  }, [isLoggedIn]);

  if (!isLoggedIn) {
    return (
      <div className="billetterie-my-tickets-page">
        <section className="billetterie-my-tickets-hero">
          <div className="container">
            <div className="billetterie-my-tickets-unauthenticated">
              <h1>Mes billets</h1>
              <p>Connectez-vous pour voir vos billets.</p>
              <Link to="/login" className="btn btn-primary">Se connecter</Link>
            </div>
          </div>
        </section>
      </div>
    );
  }

  const grouped = tickets.reduce((acc, ticket) => {
    const eventName = ticket.event_name || ticket.event?.title || 'Événement';
    if (!acc[eventName]) acc[eventName] = [];
    acc[eventName].push(ticket);
    return acc;
  }, {});

  return (
    <div className="billetterie-my-tickets-page">
      <section className="billetterie-my-tickets-hero">
        <div className="billetterie-my-tickets-hero-bg" aria-hidden="true">
          <div className="bil-mt-orb orb-1" />
          <div className="bil-mt-orb orb-2" />
        </div>
        <div className="container">
          <motion.div className="billetterie-my-tickets-hero-content" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}>
            <h1>Mes billets</h1>
            <p>Retrouvez tous vos billets et codes d&rsquo;accès.</p>
          </motion.div>
        </div>
      </section>

      <section className="billetterie-my-tickets-section section">
        <div className="container">
          {loading ? (
            <div className="loading-container">
              <Loader />
              <p>Chargement de vos billets...</p>
            </div>
          ) : error ? (
            <div className="billetterie-my-tickets-state-card">
              <h3>Erreur</h3>
              <p>{error}</p>
              <button type="button" className="btn btn-primary" onClick={() => { hasLoadedRef.current = false; loadTickets(); }}>Réessayer</button>
            </div>
          ) : tickets.length === 0 ? (
            <div className="billetterie-my-tickets-state-card">
              <h3>Aucun billet</h3>
              <p>Vous n&rsquo;avez pas encore de billets.</p>
              <Link to="/billetterie" className="btn btn-primary">Acheter des billets</Link>
            </div>
          ) : (
            Object.entries(grouped).map(([eventName, eventTickets]) => (
              <div key={eventName} className="billetterie-event-group">
                <h2 className="billetterie-event-group-title">{eventName}</h2>
                <div className="billetterie-ticket-list">
                  {eventTickets.map((ticket) => {
                    const ticketCode = ticket.ticket_code || ticket.code || '—';
                    const whatsappText = `Bonjour, voici mon billet pour ${eventName}. Code: ${ticketCode}`;
                    const whatsappLink = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(whatsappText)}`;

                    return (
                      <motion.div
                        key={ticket.id || ticket.ticket_code}
                        className="billetterie-ticket-card"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        <div className="billetterie-ticket-card-header">
                          <h3>{ticket.ticket_type_name || ticket.type || 'Billet'}</h3>
                          <span className={`billetterie-ticket-status status-${(ticket.status || 'active').toLowerCase()}`}>
                            {getStatusLabel(ticket.status)}
                          </span>
                        </div>

                        <div className="billetterie-ticket-card-code">
                          <span>Code du billet</span>
                          <strong>{ticketCode}</strong>
                        </div>

                        <div className="billetterie-ticket-card-qr">
                          <div className="billetterie-qr-placeholder">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                              <rect x="2" y="2" width="8" height="8" rx="1" stroke="#D4AF37" strokeWidth="1.5" />
                              <rect x="14" y="2" width="8" height="8" rx="1" stroke="#D4AF37" strokeWidth="1.5" />
                              <rect x="2" y="14" width="8" height="8" rx="1" stroke="#D4AF37" strokeWidth="1.5" />
                              <path d="M14 14h3v3h-3zM18 14h2v2h-2zM14 18h4v2h-4zM18 17h2v3h-2z" stroke="#D4AF37" strokeWidth="1" />
                            </svg>
                            <span>QR Code</span>
                          </div>
                        </div>

                        <div className="billetterie-ticket-card-meta">
                          {ticket.purchased_at && (
                            <span>Acheté le {formatDate(ticket.purchased_at)}</span>
                          )}
                        </div>

                        <a
                          href={whatsappLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="billetterie-ticket-whatsapp-btn"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                          </svg>
                          Partager
                        </a>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
};

export default BilletterieMyTickets;
