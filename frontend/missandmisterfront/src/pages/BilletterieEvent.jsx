import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import { billetterieAPI } from '../services/api';
import { resolveMediaUrl } from '../utils/mediaUrl';
import Loader from '../components/Loader';
import heroBg from '../assets/Billeterie.jpg.jpeg';
import './BilletterieEvent.css';

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
};

const BilletterieEvent = () => {
  const { eventId } = useParams();
  const { user } = useOutletContext() || {};

  const [event, setEvent] = useState(null);
  const [quantities, setQuantities] = useState({});
  const [loading, setLoading] = useState(true);
  const [ordering, setOrdering] = useState(false);
  const [error, setError] = useState(null);
  const [orderError, setOrderError] = useState(null);
  const [orderSuccess, setOrderSuccess] = useState(null);
  const hasLoadedRef = useRef(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalTicketTypeId, setModalTicketTypeId] = useState(null);
  const [modalQty, setModalQty] = useState(0);
  const [modalTotal, setModalTotal] = useState(0);
  const [form, setForm] = useState({ name: '', phone: '', email: '', deliveryMethod: 'both' });
  const [formErrors, setFormErrors] = useState({});

  const loadEvent = async () => {
    try {
      setLoading(true);
      const response = await billetterieAPI.getEvent(eventId);
      const data = response?.data || response;
      setEvent(data);
      setError(null);
      hasLoadedRef.current = true;
    } catch (err) {
      if (!hasLoadedRef.current) {
        setError(err.message || "Impossible de charger l'événement.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    hasLoadedRef.current = false;
    setEvent(null);
    setLoading(true);
    setError(null);
    setOrderSuccess(null);
    setOrderError(null);
    setQuantities({});
    loadEvent();
  }, [eventId]);

  useEffect(() => {
    if (user && modalOpen) {
      setForm(prev => ({
        ...prev,
        name: prev.name || user.name || '',
        email: prev.email || user.email || '',
        phone: prev.phone || user.phone || '',
      }));
    }
  }, [user, modalOpen]);

  const getTotal = () => {
    if (!event) return 0;
    return (event.ticket_types || []).reduce((sum, tt) => {
      const qty = quantities[tt.id] || 0;
      return sum + qty * Number(tt.price || 0);
    }, 0);
  };

  const getTotalTickets = () => Object.values(quantities).reduce((a, b) => a + b, 0);

  const handleQuantity = (typeId, delta) => {
    setQuantities(prev => {
      const current = prev[typeId] || 0;
      const next = Math.max(0, Math.min(10, current + delta));
      return { ...prev, [typeId]: next };
    });
  };

  const openOrderModal = (ticketTypeId) => {
    const qty = quantities[ticketTypeId] || 0;
    if (qty <= 0) {
      setOrderError('Veuillez sélectionner une quantité.');
      return;
    }
    const tt = (event.ticket_types || []).find(t => t.id === ticketTypeId);
    setModalTicketTypeId(ticketTypeId);
    setModalQty(qty);
    setModalTotal(qty * Number(tt?.price || 0));
    setFormErrors({});
    setOrderError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalTicketTypeId(null);
    setFormErrors({});
  };

  const validateForm = () => {
    const errors = {};
    if (!form.name.trim()) errors.name = 'Votre nom complet est requis.';
    if (!form.phone.trim()) errors.phone = 'Votre numéro WhatsApp est requis.';
    else if (!/^\+?\d{8,15}$/.test(form.phone.replace(/\s/g, '')))
      errors.phone = 'Numéro de téléphone invalide.';
    if (!form.email.trim()) errors.email = 'Votre email est requis.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      errors.email = 'Adresse email invalide.';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleOrder = async () => {
    if (!validateForm()) return;

    setOrdering(true);
    setOrderError(null);
    setOrderSuccess(null);

    try {
      const result = await billetterieAPI.order({
        ticket_type_id: modalTicketTypeId,
        quantity: modalQty,
        holder_name: form.name.trim(),
        holder_email: form.email.trim(),
        holder_phone: form.phone.trim(),
        delivery_method: form.deliveryMethod,
      });

      const paymentUrl = result?.payment_url || result?.data?.payment_url;
      const message = result?.message || result?.data?.message || 'Commande confirmée.';

      if (paymentUrl) {
        window.location.href = paymentUrl;
      } else {
        setOrderSuccess(message);
        setQuantities({});
        closeModal();
        loadEvent();
      }
    } catch (err) {
      setOrderError(err.message || 'Erreur lors de la commande.');
    } finally {
      setOrdering(false);
    }
  };

  const eventImage = resolveMediaUrl(event?.image_url || event?.image || (event?.image_path ? `storage/${event.image_path}` : null));

  const getSelectedTicketTypeId = () => {
    const entries = Object.entries(quantities);
    for (const [typeId, qty] of entries) {
      if (qty > 0) return Number(typeId);
    }
    return null;
  };

  const selectedTypeId = getSelectedTicketTypeId();
  const selectedTT = selectedTypeId ? (event?.ticket_types || []).find(t => t.id === selectedTypeId) : null;
  const selectedQty = selectedTypeId ? quantities[selectedTypeId] : 0;
  const selectedTotal = selectedTT ? selectedQty * Number(selectedTT.price || 0) : 0;

  return (
    <div className="bilevt-page">
      {/* Hero — poster covers the section */}
      <section className="bilevt-hero bilevt-hero--poster">
        <div
          className="bilevt-hero-poster"
          style={{ backgroundImage: `url(${heroBg})` }}
        />
        <div className="bilevt-hero-bg" aria-hidden="true">
          <div className="bilevt-hero-overlay" />
          <div className="bilevt-orb bilevt-orb-1" />
        </div>
        <div className="container bilevt-hero-content">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="bilevt-hero-inner"
          >
            <Link to="/billetterie" className="bilevt-back">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Retour aux événements
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Content */}
      <section className="bilevt-section section">
        <div className="container">
          {loading ? (
            <div className="bilevt-loading">
              <Loader />
              <p>Chargement...</p>
            </div>
          ) : error ? (
            <div className="bilevt-state-card">
              <h3>Erreur</h3>
              <p>{error}</p>
              <Link to="/billetterie" className="bilevt-btn bilevt-btn-primary">Retour</Link>
            </div>
          ) : !event ? (
            <div className="bilevt-state-card">
              <h3>Événement introuvable</h3>
              <Link to="/billetterie" className="bilevt-btn bilevt-btn-primary">Retour</Link>
            </div>
          ) : (
            <div className="bilevt-layout">
              {/* Left: Event Info */}
              <motion.div
                className="bilevt-info"
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
              >
                {eventImage && (
                  <div className="bilevt-info-img">
                    <img src={eventImage} alt={event.title} />
                  </div>
                )}

                <h1 className="bilevt-info-title">{event.title}</h1>

                <div className="bilevt-info-meta">
                  {event.event_date && (
                    <div className="bilevt-info-meta-item">
                      <div className="bilevt-info-meta-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                          <path d="M8 2v4M16 2v4M3 10h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                      </div>
                      <div>
                        <span className="bilevt-meta-label">Date</span>
                        <span className="bilevt-meta-value">{formatDate(event.event_date)}</span>
                      </div>
                    </div>
                  )}
                  {event.location && (
                    <div className="bilevt-info-meta-item">
                      <div className="bilevt-info-meta-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="currentColor" strokeWidth="1.5"/>
                          <circle cx="12" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
                        </svg>
                      </div>
                      <div>
                        <span className="bilevt-meta-label">Lieu</span>
                        <span className="bilevt-meta-value">{event.location}</span>
                      </div>
                    </div>
                  )}
                </div>

                {event.description && (
                  <div className="bilevt-info-desc">
                    <h3>À propos</h3>
                    <p>{event.description}</p>
                  </div>
                )}
              </motion.div>

              {/* Right: Tickets */}
              <motion.div
                className="bilevt-tickets"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <div className="bilevt-tickets-header">
                  <h2>Billets disponibles</h2>
                  {getTotalTickets() > 0 && (
                    <span className="bilevt-tickets-count">{getTotalTickets()} billet{getTotalTickets() > 1 ? 's' : ''}</span>
                  )}
                </div>

                <AnimatePresence>
                  {orderError && (
                    <motion.div className="bilevt-alert bilevt-alert-error" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
                        <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                      </svg>
                      {orderError}
                    </motion.div>
                  )}
                  {orderSuccess && (
                    <motion.div className="bilevt-alert bilevt-alert-success" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        <path d="M22 4L12 14.01l-3-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      {orderSuccess}
                    </motion.div>
                  )}
                </AnimatePresence>

                {(!event.ticket_types || event.ticket_types.length === 0) ? (
                  <div className="bilevt-no-tickets">
                    <p>Aucun billet disponible pour le moment.</p>
                  </div>
                ) : (
                  <div className="bilevt-ticket-list">
                    {event.ticket_types.map((tt, index) => {
                      const qty = quantities[tt.id] || 0;
                      const remaining = (tt.quantity_total || 0) - (tt.quantity_sold || 0);
                      const isSoldOut = remaining <= 0;
                      const ttImageUrl = tt.image_path ? resolveMediaUrl(`storage/${tt.image_path}`) : null;

                      return (
                        <motion.div
                          key={tt.id}
                          className={`bilevt-ticket ${isSoldOut ? 'bilevt-ticket--soldout' : ''} ${qty > 0 ? 'bilevt-ticket--selected' : ''}`}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.1 + index * 0.08, duration: 0.4 }}
                        >
                          {ttImageUrl && (
                            <div className="bilevt-ticket-bg" style={{ backgroundImage: `url(${ttImageUrl})` }} />
                          )}
                          <div className="bilevt-ticket-content">
                            <div className="bilevt-ticket-info">
                              <h4 className="bilevt-ticket-name">{tt.name}</h4>
                              {tt.description && <p className="bilevt-ticket-desc">{tt.description}</p>}
                              <div className="bilevt-ticket-details">
                                <span className="bilevt-ticket-price">
                                  {Number(tt.price || 0).toLocaleString('fr-FR')} {tt.currency || 'XOF'}
                                </span>
                                {!isSoldOut && (
                                  <span className="bilevt-ticket-remaining">
                                    {remaining} place{remaining > 1 ? 's' : ''}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="bilevt-ticket-action">
                              {isSoldOut ? (
                                <span className="bilevt-soldout-label">Épuisé</span>
                              ) : (
                                <div className="bilevt-qty">
                                  <button className="bilevt-qty-btn" onClick={() => handleQuantity(tt.id, -1)} disabled={qty <= 0}>−</button>
                                  <span className="bilevt-qty-value">{qty}</span>
                                  <button className="bilevt-qty-btn" onClick={() => handleQuantity(tt.id, 1)} disabled={qty >= 10 || qty >= remaining}>+</button>
                                </div>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}

                {/* Sticky buy bar */}
                <AnimatePresence>
                  {selectedTT && (
                    <motion.div
                      className="bilevt-buy-bar"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 20 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="bilevt-buy-bar-info">
                        <span className="bilevt-buy-bar-name">{selectedTT.name}</span>
                        <span className="bilevt-buy-bar-qty">{selectedQty} billet{selectedQty > 1 ? 's' : ''}</span>
                      </div>
                      <motion.button
                        className="bilevt-btn bilevt-btn-primary bilevt-btn-buy"
                        onClick={() => openOrderModal(selectedTypeId)}
                        disabled={ordering}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                      >
                        {'Acheter \u2014 ' + selectedTotal.toLocaleString('fr-FR') + ' ' + (selectedTT.currency || 'XOF')}
                      </motion.button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </div>
          )}
        </div>
      </section>

      {/* Order Modal */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div
            className="bilevt-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeModal}
          >
            <motion.div
              className="bilevt-modal"
              initial={{ opacity: 0, scale: 0.92, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 30 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bilevt-modal-header">
                <h3>Finaliser votre commande</h3>
                <button className="bilevt-modal-close" onClick={closeModal}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>

              <div className="bilevt-modal-summary">
                <span>{modalQty} billet{modalQty > 1 ? 's' : ''}</span>
                <span className="bilevt-modal-total">{modalTotal.toLocaleString('fr-FR')} {(event?.ticket_types || []).find(t => t.id === modalTicketTypeId)?.currency || 'XOF'}</span>
              </div>

              <div className="bilevt-modal-form">
                <div className="bilevt-field">
                  <label className="bilevt-label">Nom complet <span className="bilevt-required">*</span></label>
                  <input
                    type="text"
                    className={`bilevt-input ${formErrors.name ? 'bilevt-input--error' : ''}`}
                    placeholder="Ex: Jean Dupont"
                    value={form.name}
                    onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                  />
                  {formErrors.name && <span className="bilevt-field-error">{formErrors.name}</span>}
                </div>

                <div className="bilevt-field">
                  <label className="bilevt-label">Numéro WhatsApp <span className="bilevt-required">*</span></label>
                  <input
                    type="tel"
                    className={`bilevt-input ${formErrors.phone ? 'bilevt-input--error' : ''}`}
                    placeholder="+229 55 74 87 87"
                    value={form.phone}
                    onChange={(e) => setForm(prev => ({ ...prev, phone: e.target.value }))}
                  />
                  {formErrors.phone && <span className="bilevt-field-error">{formErrors.phone}</span>}
                </div>

                <div className="bilevt-field">
                  <label className="bilevt-label">Email <span className="bilevt-required">*</span></label>
                  <input
                    type="email"
                    className={`bilevt-input ${formErrors.email ? 'bilevt-input--error' : ''}`}
                    placeholder="vous@email.com"
                    value={form.email}
                    onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                  />
                  {formErrors.email && <span className="bilevt-field-error">{formErrors.email}</span>}
                </div>

                <div className="bilevt-field">
                  <label className="bilevt-label">Recevoir mes billets par <span className="bilevt-required">*</span></label>
                  <div className="bilevt-delivery">
                    <label className={`bilevt-delivery-option ${form.deliveryMethod === 'whatsapp' ? 'bilevt-delivery-option--active' : ''}`}>
                      <input
                        type="radio"
                        name="delivery"
                        value="whatsapp"
                        checked={form.deliveryMethod === 'whatsapp'}
                        onChange={(e) => setForm(prev => ({ ...prev, deliveryMethod: e.target.value }))}
                      />
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" stroke="currentColor" strokeWidth="1.5"/>
                        <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z" stroke="currentColor" strokeWidth="1.5"/>
                      </svg>
                      WhatsApp
                    </label>
                    <label className={`bilevt-delivery-option ${form.deliveryMethod === 'email' ? 'bilevt-delivery-option--active' : ''}`}>
                      <input
                        type="radio"
                        name="delivery"
                        value="email"
                        checked={form.deliveryMethod === 'email'}
                        onChange={(e) => setForm(prev => ({ ...prev, deliveryMethod: e.target.value }))}
                      />
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                        <path d="M22 7l-10 7L2 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Email
                    </label>
                    <label className={`bilevt-delivery-option ${form.deliveryMethod === 'both' ? 'bilevt-delivery-option--active' : ''}`}>
                      <input
                        type="radio"
                        name="delivery"
                        value="both"
                        checked={form.deliveryMethod === 'both'}
                        onChange={(e) => setForm(prev => ({ ...prev, deliveryMethod: e.target.value }))}
                      />
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        <path d="M22 4L12 14.01l-3-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Les deux
                    </label>
                  </div>
                </div>
              </div>

              <AnimatePresence>
                {orderError && (
                  <motion.div className="bilevt-alert bilevt-alert-error bilevt-modal-alert" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                    </svg>
                    {orderError}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="bilevt-modal-actions">
                <button className="bilevt-btn bilevt-btn-ghost" onClick={closeModal} disabled={ordering}>
                  Annuler
                </button>
                <motion.button
                  className="bilevt-btn bilevt-btn-primary bilevt-btn-confirm"
                  onClick={handleOrder}
                  disabled={ordering}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                >
                  {ordering ? (
                    <>
                      <span className="bilevt-spinner" />
                      Traitement...
                    </>
                  ) : (
                    <>
                      Confirmer et payer
                      <span className="bilevt-modal-total-btn">{modalTotal.toLocaleString('fr-FR')} {(event?.ticket_types || []).find(t => t.id === modalTicketTypeId)?.currency || 'XOF'}</span>
                    </>
                  )}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BilletterieEvent;
