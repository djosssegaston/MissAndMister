import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { adminBilletterieAPI, billetterieAPI } from '../../services/api';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import './admin-theme.css';
import './AdminBilletterie.css';

const emptyEventForm = {
  title: '', description: '', event_date: '', location: '', image: null, status: 'published',
};

const emptyTicketTypeForm = {
  name: '', description: '', price: '', quantity: '', currency: 'XOF', image: null,
};

const ConfirmModal = ({ message, onConfirm, onCancel }) => (
  <motion.div className="abill-confirm-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onCancel}>
    <motion.div className="abill-confirm-modal" initial={{ scale: 0.94, y: 18 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.94, y: 18 }} onClick={(e) => e.stopPropagation()}>
      <p>{message}</p>
      <div className="abill-confirm-actions">
        <button className="ag-btn ag-btn-ghost" onClick={onCancel}>Annuler</button>
        <button className="ag-btn ag-btn-danger" onClick={onConfirm}>Confirmer</button>
      </div>
    </motion.div>
  </motion.div>
);

const AdminBilletterie = () => {
  const [tab, setTab] = useState('events');
  const [feedback, setFeedback] = useState(null);
  const [confirm, setConfirm] = useState(null);

  return (
    <div className="admin-page admin-billetterie">
      {feedback && (
        <div className={`abill-banner abill-banner-${feedback.type}`}>
          <span>{feedback.message}</span>
          <button onClick={() => setFeedback(null)}>&times;</button>
        </div>
      )}

      <div className="abill-header">
        <div>
          <h1>Billetterie</h1>
          <p>Gestion des &eacute;v&eacute;nements, billets et commandes</p>
        </div>
      </div>

      <div className="abill-tabs">
        <button className={`abill-tab ${tab === 'events' ? 'active' : ''}`} onClick={() => setTab('events')}>Événements</button>
        <button className={`abill-tab ${tab === 'orders' ? 'active' : ''}`} onClick={() => setTab('orders')}>Commandes</button>
        <button className={`abill-tab ${tab === 'checkin' ? 'active' : ''}`} onClick={() => setTab('checkin')}>Check-in</button>
        <button className={`abill-tab ${tab === 'stats' ? 'active' : ''}`} onClick={() => setTab('stats')}>Statistiques</button>
      </div>

      <AnimatePresence mode="wait">
        {tab === 'events' && <EventsTab key="events" setFeedback={setFeedback} setConfirm={setConfirm} />}
        {tab === 'orders' && <OrdersTab key="orders" />}
        {tab === 'checkin' && <CheckinTab key="checkin" setFeedback={setFeedback} />}
        {tab === 'stats' && <StatsTab key="stats" />}
      </AnimatePresence>

      <AnimatePresence>
        {confirm && (
          <ConfirmModal message={confirm.message} onConfirm={() => confirm.onAction()} onCancel={() => setConfirm(null)} />
        )}
      </AnimatePresence>
    </div>
  );
};

const EventsTab = ({ setFeedback, setConfirm }) => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyEventForm);
  const [ticketPanelOpen, setTicketPanelOpen] = useState(false);
  const [ticketForm, setTicketForm] = useState(emptyTicketTypeForm);
  const [editingTicket, setEditingTicket] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const fileInputRef = useRef(null);
  const hasLoaded = useRef(false);

  useEffect(() => {
    if (!hasLoaded.current) { hasLoaded.current = true; loadEvents(); }
  }, []);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const data = await adminBilletterieAPI.getEvents();
      setEvents(Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : []);
    } catch (err) {
      if (!err?.isSessionExpired) setFeedback({ type: 'error', message: err.message || 'Erreur de chargement' });
    } finally { setLoading(false); }
  };

  const openCreateEvent = () => {
    setEditing(null); setForm({ ...emptyEventForm }); setPanelOpen(true);
  };

  const openEditEvent = (event) => {
    setEditing(event);
    setForm({ title: event.title || '', description: event.description || '', event_date: event.event_date || '', location: event.location || '', image: null, status: event.status || 'published' });
    setPanelOpen(true);
  };

  const closePanel = () => {
    setPanelOpen(false); setEditing(null); setForm({ ...emptyEventForm });
  };

  const handleSaveEvent = async () => {
    if (!form.title.trim()) { setFeedback({ type: 'error', message: 'Le titre est obligatoire.' }); return; }
    try {
      const fd = new FormData();
      fd.append('title', form.title.trim());
      fd.append('description', form.description.trim());
      if (form.event_date) fd.append('event_date', form.event_date);
      fd.append('location', form.location.trim());
      fd.append('status', form.status);
      if (form.image) fd.append('image', form.image);

      if (editing) {
        await adminBilletterieAPI.updateEvent(editing.uuid, fd);
        setFeedback({ type: 'success', message: 'Événement mis à jour.' });
      } else {
        await adminBilletterieAPI.createEvent(fd);
        setFeedback({ type: 'success', message: 'Événement créé.' });
      }
      closePanel();
      loadEvents();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Erreur lors de la sauvegarde.' });
    }
  };

  const handleDeleteEvent = async (id) => {
    try {
      await adminBilletterieAPI.deleteEvent(id);
      setFeedback({ type: 'success', message: 'Événement supprimé.' });
      loadEvents();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Erreur lors de la suppression.' });
    }
  };

  const openTicketPanel = (event) => {
    setSelectedEvent(event);
    setEditingTicket(null);
    setTicketForm({ ...emptyTicketTypeForm });
    setTicketPanelOpen(true);
  };

  const openEditTicket = (event, ticketType) => {
    setSelectedEvent(event);
    setEditingTicket(ticketType);
    setTicketForm({ name: ticketType.name || '', description: ticketType.description || '', price: ticketType.price || '', quantity: ticketType.quantity_total || '', currency: ticketType.currency || 'XOF', image: null });
    setTicketPanelOpen(true);
  };

  const closeTicketPanel = () => {
    setTicketPanelOpen(false); setSelectedEvent(null); setEditingTicket(null); setTicketForm({ ...emptyTicketTypeForm });
  };

  const handleSaveTicketType = async () => {
    if (!ticketForm.name.trim() || !ticketForm.price) { setFeedback({ type: 'error', message: 'Nom et prix obligatoires.' }); return; }
    try {
      const fd = new FormData();
      fd.append('name', ticketForm.name.trim());
      fd.append('description', ticketForm.description.trim());
      fd.append('price', Number(ticketForm.price));
      fd.append('quantity_total', Number(ticketForm.quantity) || 1);
      fd.append('currency', ticketForm.currency);
      if (ticketForm.image) fd.append('image', ticketForm.image);

      if (editingTicket) {
        await adminBilletterieAPI.updateTicketType(selectedEvent.uuid, editingTicket.id, fd);
        setFeedback({ type: 'success', message: 'Type de billet mis à jour.' });
      } else {
        await adminBilletterieAPI.createTicketType(selectedEvent.uuid, fd);
        setFeedback({ type: 'success', message: 'Type de billet créé.' });
      }
      closeTicketPanel();
      loadEvents();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Erreur lors de la sauvegarde.' });
    }
  };

  const handleDeleteTicketType = async (eventId, typeId) => {
    try {
      await adminBilletterieAPI.deleteTicketType(eventId, typeId);
      setFeedback({ type: 'success', message: 'Type de billet supprimé.' });
      loadEvents();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Erreur lors de la suppression.' });
    }
  };

  return (
    <motion.div key="events" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div style={{ marginBottom: '1.2rem' }}>
        <button className="ag-btn ag-btn-primary" onClick={openCreateEvent}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /></svg>
          Nouvel événement
        </button>
      </div>

      {loading ? (
        <div className="loading-container"><span className="ag-spinner" /> Chargement...</div>
      ) : events.length === 0 ? (
        <div className="abill-empty">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 16px', color: 'var(--ag-gold-1, #D4AF37)', opacity: 0.4 }}><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 3h-2a4 4 0 0 0-4 0H8" /></svg>
          <p>Aucun événement. Créez-en un.</p>
        </div>
      ) : (
        <div className="abill-events-grid">
          {events.map((event) => (
            <div key={event.uuid} className="abill-event-card ag-card">
              {event.image_url && (
                <div className="abill-event-card-img">
                  <img src={resolveMediaUrl(event.image_url)} alt={event.title} />
                </div>
              )}
              <div className="ag-card-body">
                <div className="abill-event-card-header">
                  <h3>{event.title}</h3>
                  <span className={`ag-badge ${event.status === 'published' ? 'ag-badge-success' : 'ag-badge-warning'}`}>
                    {event.status === 'published' ? 'Publié' : 'Brouillon'}
                  </span>
                </div>
                {event.event_date && <p className="abill-event-date">{new Date(event.event_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>}
                {event.location && <p className="abill-event-location">{event.location}</p>}
                {Array.isArray(event.ticket_types) && event.ticket_types.length > 0 && (
                  <div className="abill-ticket-types">
                    <strong>Types de billets :</strong>
                    {event.ticket_types.map((tt) => (
                      <div key={tt.id} className="abill-ticket-type-row">
                        <span>{tt.name} &mdash; {Number(tt.price || 0).toLocaleString('fr-FR')} {tt.currency || 'XOF'}</span>
                        <div className="abill-ticket-type-actions">
                          <button className="ag-btn ag-btn-sm ag-btn-ghost" onClick={() => openEditTicket(event, tt)}>Modifier</button>
                           <button className="ag-btn ag-btn-sm ag-btn-danger" onClick={() => setConfirm({ message: 'Supprimer "' + tt.name + '" ?', onAction: () => { handleDeleteTicketType(event.uuid, tt.id); } })}>&times;</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="abill-event-card-actions">
                  <button className="ag-btn ag-btn-sm ag-btn-ghost" onClick={() => openTicketPanel(event)}>+ Billet</button>
                  <button className="ag-btn ag-btn-sm ag-btn-outline" onClick={() => openEditEvent(event)}>Modifier</button>
                   <button className="ag-btn ag-btn-sm ag-btn-danger" onClick={() => setConfirm({ message: 'Supprimer "' + event.title + '" ?', onAction: () => handleDeleteEvent(event.uuid) })}>Supprimer</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {panelOpen && (
          <motion.div className="abill-panel-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closePanel}>
            <motion.div className="abill-panel" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} onClick={(e) => e.stopPropagation()}>
              <div className="abill-panel-header">
                <h2>{editing ? "Modifier l'événement" : 'Nouvel événement'}</h2>
                <button className="abill-panel-close" onClick={closePanel}>&times;</button>
              </div>
              <div className="abill-panel-body">
                <div className="ag-form-group">
                  <label className="ag-label">Titre</label>
                  <input className="ag-input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Titre de l'événement" />
                </div>
                <div className="ag-form-group">
                  <label className="ag-label">Description</label>
                  <textarea className="ag-input ag-textarea" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={4} placeholder="Description" />
                </div>
                <div className="ag-form-group">
                  <label className="ag-label">Date</label>
                  <input className="ag-input" type="datetime-local" value={form.event_date} onChange={(e) => setForm((f) => ({ ...f, event_date: e.target.value }))} />
                </div>
                <div className="ag-form-group">
                  <label className="ag-label">Lieu</label>
                  <input className="ag-input" value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder="Lieu" />
                </div>
                <div className="ag-form-group">
                  <label className="ag-label">Image</label>
                  <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setForm((f) => ({ ...f, image: e.target.files[0] }))} />
                </div>
                <div className="ag-form-group">
                  <label className="ag-label">Statut</label>
                  <select className="ag-input ag-select" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                    <option value="published">Publié</option>
                    <option value="draft">Brouillon</option>
                  </select>
                </div>
              </div>
              <div className="abill-panel-footer">
                <button className="ag-btn ag-btn-ghost" onClick={closePanel}>Annuler</button>
                <button className="ag-btn ag-btn-primary" onClick={handleSaveEvent}>
                  {editing ? 'Mettre à jour' : 'Créer'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {ticketPanelOpen && (
          <motion.div className="abill-panel-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeTicketPanel}>
            <motion.div className="abill-panel" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} onClick={(e) => e.stopPropagation()}>
              <div className="abill-panel-header">
                <h2>{editingTicket ? 'Modifier le billet' : 'Nouveau billet'} &mdash; {selectedEvent?.title}</h2>
                <button className="abill-panel-close" onClick={closeTicketPanel}>&times;</button>
              </div>
              <div className="abill-panel-body">
                <div className="ag-form-group">
                  <label className="ag-label">Nom</label>
                  <input className="ag-input" value={ticketForm.name} onChange={(e) => setTicketForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: Standard, VIP" />
                </div>
                <div className="ag-form-group">
                  <label className="ag-label">Description</label>
                  <input className="ag-input" value={ticketForm.description} onChange={(e) => setTicketForm((f) => ({ ...f, description: e.target.value }))} placeholder="Optionnelle" />
                </div>
                <div className="ag-form-group">
                  <label className="ag-label">Image du billet</label>
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setTicketForm((f) => ({ ...f, image: e.target.files[0] }))} />
                  {editingTicket?.image_path && !ticketForm.image && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <img src={resolveMediaUrl(`storage/${editingTicket.image_path}`)} alt="Aperçu" style={{ maxWidth: '120px', borderRadius: '8px', border: '1px solid rgba(212,175,55,0.15)' }} />
                    </div>
                  )}
                </div>
                <div className="ag-form-group">
                  <label className="ag-label">Prix (FCFA)</label>
                  <input className="ag-input" type="number" min="0" value={ticketForm.price} onChange={(e) => setTicketForm((f) => ({ ...f, price: e.target.value }))} placeholder="5000" />
                </div>
                <div className="ag-form-group">
                  <label className="ag-label">Quantité disponible</label>
                  <input className="ag-input" type="number" min="0" value={ticketForm.quantity} onChange={(e) => setTicketForm((f) => ({ ...f, quantity: e.target.value }))} placeholder="100" />
                </div>
                <div className="ag-form-group">
                  <label className="ag-label">Devise</label>
                  <select className="ag-input ag-select" value={ticketForm.currency} onChange={(e) => setTicketForm((f) => ({ ...f, currency: e.target.value }))}>
                    <option value="XOF">XOF</option>
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              </div>
              <div className="abill-panel-footer">
                <button className="ag-btn ag-btn-ghost" onClick={closeTicketPanel}>Annuler</button>
                <button className="ag-btn ag-btn-primary" onClick={handleSaveTicketType}>
                  {editingTicket ? 'Mettre à jour' : 'Créer'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const OrdersTab = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => { loadOrders(); }, [statusFilter]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      const data = await adminBilletterieAPI.getOrders(params);
      setOrders(Array.isArray(data?.data) ? data.data : []);
    } catch (err) {
      if (!err?.isSessionExpired) console.error(err);
    } finally { setLoading(false); }
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '\u2014';

  return (
    <motion.div key="orders" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="abill-filter-bar">
        <label>Filtrer :</label>
        <select className="ag-input ag-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Toutes</option>
          <option value="pending">En attente</option>
          <option value="paid">Payée</option>
          <option value="failed">Échouée</option>
          <option value="cancelled">Annulée</option>
        </select>
      </div>
      {loading ? (
        <div className="loading-container"><span className="ag-spinner" /> Chargement...</div>
      ) : orders.length === 0 ? (
        <div className="abill-empty">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 16px', color: 'var(--ag-gold-1, #D4AF37)', opacity: 0.4 }}><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><path d="M3 6h18" /></svg>
          <p>Aucune commande.</p>
        </div>
      ) : (
        <div className="abill-table-wrap">
          <table className="ag-table ag-table-responsive">
            <thead>
              <tr>
                <th>Réf</th>
                <th>Client</th>
                <th>Événement</th>
                <th>Montant</th>
                <th>Statut</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td data-label="Réf">
                    <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--ag-text-2)', letterSpacing: '0.5px' }}>
                      {order.reference || '\u2014'}
                    </span>
                  </td>
                  <td data-label="Client">
                    <div>
                      <div style={{ fontWeight: 500, color: 'var(--ag-text-1)', fontSize: '0.84rem' }}>
                        {order.holder_name || order.user_name || order.user?.name || '\u2014'}
                      </div>
                      {(order.holder_email || order.user?.email) && (
                        <div style={{ fontSize: '0.76rem', color: 'var(--ag-text-3)', marginTop: '2px' }}>
                          {order.holder_email || order.user?.email}
                        </div>
                      )}
                    </div>
                  </td>
                  <td data-label="Événement">{order.event_name || order.event?.title || '\u2014'}</td>
                  <td data-label="Montant">{order.total_amount ? `${Number(order.total_amount).toLocaleString('fr-FR')} ${order.currency || 'XOF'}` : '\u2014'}</td>
                  <td data-label="Statut"><span className={`ag-badge ${order.status === 'paid' ? 'ag-badge-success' : order.status === 'failed' ? 'ag-badge-error' : order.status === 'cancelled' ? 'ag-badge-warning' : 'ag-badge-info'}`}>{order.status === 'paid' ? 'Payée' : order.status === 'pending' ? 'En attente' : order.status === 'failed' ? 'Échouée' : order.status === 'cancelled' ? 'Annulée' : order.status || '\u2014'}</span></td>
                  <td data-label="Date">{formatDate(order.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  );
};

const CheckinTab = ({ setFeedback }) => {
  const [code, setCode] = useState('');
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleCheckin = async () => {
    const trimmedCode = code.trim();
    if (!trimmedCode) { setFeedback({ type: 'error', message: 'Entrez un code de billet.' }); return; }
    setChecking(true);
    setResult(null);
    try {
      const data = await adminBilletterieAPI.checkin(trimmedCode);
      setResult({ success: true, message: data?.message || 'Check-in réussi !', data });
      setFeedback({ type: 'success', message: 'Check-in effectué.' });
      setCode('');
    } catch (err) {
      setResult({ success: false, message: err.message || 'Échec du check-in.' });
      setFeedback({ type: 'error', message: err.message || 'Échec du check-in.' });
    } finally { setChecking(false); }
  };

  const handleVerify = async () => {
    const trimmedCode = code.trim();
    if (!trimmedCode) { setFeedback({ type: 'error', message: 'Entrez un code de billet.' }); return; }
    setChecking(true);
    setResult(null);
    try {
      const data = await billetterieAPI.verifyTicket(trimmedCode);
      setResult({ success: true, message: 'Billet valide', data });
    } catch (err) {
      setResult({ success: false, message: err.message || 'Billet invalide.' });
    } finally { setChecking(false); }
  };

  return (
    <motion.div key="checkin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="abill-checkin">
        <h2>Check-in</h2>
        <p>Saisissez ou scannez le code du billet pour valider l'entrée</p>
        <div style={{ marginBottom: 16 }}>
          <button
            className="ag-btn ag-btn-primary"
            onClick={() => window.open('/admin/billetterie/scan', '_blank')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" /><path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" /><line x1="7" y1="12" x2="17" y2="12" /><line x1="12" y1="7" x2="12" y2="17" />
            </svg>
            Ouvrir le scanner QR Code
          </button>
        </div>
        <div className="abill-checkin-input-row">
          <input ref={inputRef} className="ag-input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Code du billet (ex: a1b2c3d4-e5f6-...)" onKeyDown={(e) => e.key === 'Enter' && handleCheckin()} style={{ fontSize: '0.95rem' }} />
          <button className="ag-btn ag-btn-primary" onClick={handleCheckin} disabled={checking}>
            {checking ? <><span className="ag-spinner" /> ...</> : (
              <><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><polyline points="22 4 12 14.01 9 11.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg> Check-in</>
            )}
          </button>
          <button className="ag-btn ag-btn-outline" onClick={handleVerify} disabled={checking}>Vérifier</button>
        </div>
        {result && (
          <div className={`abill-checkin-result ${result.success ? 'success' : 'error'}`}>
            {result.success ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
            )}
            {result.message}
          </div>
        )}
      </div>
    </motion.div>
  );
};

const StatIcon = ({ children }) => (
  <div className="abill-stat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{children}</svg></div>
);

const StatsTab = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadStats(); }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      const data = await adminBilletterieAPI.getStats();
      setStats(data || {});
    } catch (err) {
      console.error(err);
    } finally { setLoading(false); }
  };

  if (loading) return <motion.div key="stats" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><div className="loading-container"><span className="ag-spinner" /> Chargement...</div></motion.div>;

  return (
    <motion.div key="stats" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="abill-stats">
        <div className="abill-stat-card ag-card">
          <div className="ag-card-body">
            <StatIcon>
              <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
            </StatIcon>
            <div className="abill-stat-value">{stats?.total_events ?? stats?.events_count ?? 0}</div>
            <div className="abill-stat-label">Événements</div>
          </div>
        </div>
        <div className="abill-stat-card ag-card">
          <div className="ag-card-body">
            <StatIcon>
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" />
            </StatIcon>
            <div className="abill-stat-value">{stats?.total_orders ?? stats?.orders_count ?? 0}</div>
            <div className="abill-stat-label">Commandes</div>
          </div>
        </div>
        <div className="abill-stat-card ag-card">
          <div className="ag-card-body">
            <StatIcon>
              <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 3h-2a4 4 0 0 0-4 0H8" /><path d="M12 11v4" /><path d="M10 13h4" />
            </StatIcon>
            <div className="abill-stat-value">{stats?.total_tickets ?? stats?.tickets_count ?? 0}</div>
            <div className="abill-stat-label">Billets vendus</div>
          </div>
        </div>
        <div className="abill-stat-card ag-card">
          <div className="ag-card-body">
            <StatIcon>
              <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </StatIcon>
            <div className="abill-stat-value">{stats?.total_revenue ? `${Number(stats.total_revenue).toLocaleString('fr-FR')} XOF` : '0 XOF'}</div>
            <div className="abill-stat-label">Revenus</div>
          </div>
        </div>
        <div className="abill-stat-card ag-card">
          <div className="ag-card-body">
            <StatIcon>
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
            </StatIcon>
            <div className="abill-stat-value">{stats?.checked_in_tickets ?? 0}</div>
            <div className="abill-stat-label">Check-ins</div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default AdminBilletterie;
