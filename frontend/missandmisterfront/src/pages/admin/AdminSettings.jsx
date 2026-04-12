import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { adminAPI } from '../../services/api';
import { broadcastLiveUpdate } from '../../utils/liveUpdates';
import './admin-theme.css';
import './AdminSettings.css';

const Toggle = ({ checked, onChange, danger }) => (
  <button
    className={`as-toggle ${checked ? 'on' : ''} ${danger ? 'danger' : ''}`}
    onClick={() => onChange(!checked)}
    role="switch" aria-checked={checked}>
    <motion.span className="as-toggle-knob" layout animate={{ x: checked ? (danger ? 22 : 22) : 0 }} transition={{ type:'spring', stiffness:500, damping:35 }} />
  </button>
);

const AdminSettings = () => {
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [dates,   setDates]   = useState({ start: '', end: '' });
  const [rules,   setRules]   = useState({ pricePerVote: 0, maxPerDay: 0 });
  const [feats,   setFeats]   = useState({ votingOpen: false, galleryPublic: false, resultsPublic: false });
  const [notifs,  setNotifs]  = useState({ emailConfirm: false, smsConfirm: false });
  const [security,setSecurity]= useState({ captcha: false, ipTracking: false, maintenance: false, maintenanceEnd: '' });

  // Load settings on mount
  useEffect(() => {
    const load = async () => {
      try {
        setError(null);
        const data = await adminAPI.getSettings();
        setDates({
          start: data?.vote_start_at || '',
          end: data?.vote_end_at || '',
        });
        setRules({
          pricePerVote: data?.price_per_vote ?? 0,
          maxPerDay: data?.max_votes_per_day ?? 0,
        });
        setFeats({
          votingOpen: !!data?.voting_open,
          galleryPublic: !!data?.gallery_public,
          resultsPublic: !!data?.results_public,
        });
        setNotifs({
          emailConfirm: !!data?.email_confirm,
          smsConfirm: !!data?.sms_confirm,
        });
        setSecurity({
          captcha: !!data?.captcha_enabled,
          ipTracking: !!data?.ip_tracking_enabled,
          maintenance: !!data?.maintenance_mode,
          maintenanceEnd: data?.maintenance_end_at || '',
        });
      } catch (err) {
        if (err?.isSessionExpired) {
          return;
        }
        setError(err.message || 'Impossible de charger les paramètres');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSave = () => {
    // Validation minimale côté front pour éviter des states incohérents
    if (dates.start && dates.end && new Date(dates.end) < new Date(dates.start)) {
      setError('La date de fin doit être postérieure à la date de début.');
      return;
    }
    if (rules.pricePerVote <= 0) {
      setError('Le prix par vote doit être supérieur à 0.');
      return;
    }
    if (rules.maxPerDay && rules.maxPerDay < 1) {
      setError('Le maximum de votes par jour doit être au moins 1.');
      return;
    }

    const payload = {
      vote_start_at: dates.start,
      vote_end_at: dates.end,
      price_per_vote: rules.pricePerVote,
      max_votes_per_day: rules.maxPerDay,
      voting_open: feats.votingOpen,
      gallery_public: feats.galleryPublic,
      results_public: feats.resultsPublic,
      email_confirm: notifs.emailConfirm,
      sms_confirm: notifs.smsConfirm,
      captcha_enabled: security.captcha,
      ip_tracking_enabled: security.ipTracking,
      maintenance_mode: security.maintenance,
      maintenance_end_at: security.maintenanceEnd,
    };

    setSaving(true);
    setError(null);

    adminAPI.updateSettings(payload)
      .then(() => {
        // Notify other tabs/pages to recharger les réglages automatiquement
        localStorage.setItem('settings_updated_at', Date.now().toString());
        window.dispatchEvent(new Event('settings-updated'));
        broadcastLiveUpdate('settings');
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      })
      .catch((err) => {
        if (err?.isSessionExpired) {
          return;
        }
        setError(err.message || 'Échec de l’enregistrement');
      })
      .finally(() => setSaving(false));
  };

  const handleReset = () => {
    setFeats({ votingOpen: true, galleryPublic: true, resultsPublic: false });
    setNotifs({ emailConfirm: true, smsConfirm: false });
    setSecurity({ captcha: true, ipTracking: true, maintenance: false, maintenanceEnd: '' });
  };

  return (
    <div className="admin-page asetts">

      {error && (
        <div className="error-container" style={{ marginBottom: '1rem' }}>
          <p style={{ margin: 0 }}>{error}</p>
        </div>
      )}

      <div className="asetts-header">
        <div>
          <h1>Paramètres du système</h1>
          <p>Configuration générale de la plateforme de vote</p>
        </div>
        <div className="asetts-header-actions">
          <button className="ag-btn ag-btn-ghost" onClick={handleReset}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M1 4v6h6M23 20v-6h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Réinitialiser
          </button>
          <motion.button className={`ag-btn ag-btn-primary ${saved ? 'asetts-saved' : ''}`} onClick={handleSave} disabled={saving || loading} whileTap={{ scale: 0.97 }}>
            {saving ? <span className="ag-spinner" style={{ width:15,height:15,borderWidth:2 }} /> : saved
              ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              : <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" stroke="currentColor" strokeWidth="2"/><path d="M17 21v-8H7v8M7 3v5h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>}
            {saved ? 'Enregistré !' : saving ? 'Sauvegarde...' : 'Sauvegarder'}
          </motion.button>
        </div>
      </div>

      <div className="asetts-grid">

        {/* Dates */}
        <motion.div className="ag-card" initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.05 }}>
          <div className="ag-card-header">
            <h3>Dates du concours</h3>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" stroke="var(--ag-gold-1)" strokeWidth="1.8"/><path d="M16 2v4M8 2v4M3 10h18" stroke="var(--ag-gold-1)" strokeWidth="1.8" strokeLinecap="round"/></svg>
          </div>
          <div className="ag-card-body">
            <div className="ag-form-group">
              <label className="ag-label">Date de début</label>
              <input type="date" className="ag-input" value={dates.start} onChange={e => setDates(d => ({...d, start: e.target.value}))} disabled={loading} />
            </div>
            <div className="ag-form-group" style={{ marginBottom:0 }}>
              <label className="ag-label">Date de fin</label>
              <input type="date" className="ag-input" value={dates.end} onChange={e => setDates(d => ({...d, end: e.target.value}))} disabled={loading} />
            </div>
          </div>
        </motion.div>

        {/* Règles */}
        <motion.div className="ag-card" initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.1 }}>
          <div className="ag-card-header">
            <h3>Règles de vote</h3>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="11" width="18" height="10" rx="2" stroke="var(--ag-gold-1)" strokeWidth="1.8"/><path d="M9 11V7a3 3 0 016 0v4" stroke="var(--ag-gold-1)" strokeWidth="1.8" strokeLinecap="round"/></svg>
          </div>
          <div className="ag-card-body">
            <div className="ag-form-group">
              <label className="ag-label">Prix par vote (FCFA)</label>
              <input type="number" className="ag-input" value={rules.pricePerVote} onChange={e => setRules(r => ({...r, pricePerVote: +e.target.value}))} min={0} disabled={loading} />
            </div>
            <div className="ag-form-group" style={{ marginBottom:0 }}>
              <label className="ag-label">Max votes / jour / utilisateur</label>
              <input type="number" className="ag-input" value={rules.maxPerDay} onChange={e => setRules(r => ({...r, maxPerDay: +e.target.value}))} min={1} disabled={loading} />
            </div>
          </div>
        </motion.div>

        {/* Fonctionnalités */}
        <motion.div className="ag-card" initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.15 }}>
          <div className="ag-card-header">
            <h3>Fonctionnalités</h3>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="var(--ag-gold-1)" strokeWidth="1.8"/></svg>
          </div>
          <div className="ag-card-body">
            {[
              { key:'votingOpen',      label:'Vote ouvert',          sub:'Autoriser les votes' },
              { key:'galleryPublic',   label:'Galerie publique',     sub:'Visible sans connexion' },
              { key:'resultsPublic',   label:'Résultats publics',    sub:'Afficher le classement' },
            ].map(item => (
              <div key={item.key} className="asetts-toggle-row">
                <div>
                  <p className="asetts-toggle-label">{item.label}</p>
                  <p className="asetts-toggle-sub">{item.sub}</p>
                </div>
                <Toggle checked={feats[item.key]} onChange={v => setFeats(f => ({...f, [item.key]: v}))} />
              </div>
            ))} 
          </div>
        </motion.div>

        {/* Notifications */}
        <motion.div className="ag-card" initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.2 }}>
          <div className="ag-card-header">
            <h3>Notifications</h3>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke="var(--ag-gold-1)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <div className="ag-card-body">
            {[
              { key:'emailConfirm', label:'Confirmation email', sub:'Envoyer un email après vote' },
              { key:'smsConfirm',   label:'Confirmation SMS',   sub:'Envoyer un SMS de confirmation' },
            ].map(item => (
              <div key={item.key} className="asetts-toggle-row">
                <div>
                  <p className="asetts-toggle-label">{item.label}</p>
                  <p className="asetts-toggle-sub">{item.sub}</p>
                </div>
                <Toggle checked={notifs[item.key]} onChange={v => setNotifs(n => ({...n, [item.key]: v}))} />
              </div>
            ))} 
          </div>
        </motion.div>

        {/* Sécurité */}
        <motion.div className="ag-card asetts-security-card" initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.25 }}>
          <div className="ag-card-header">
            <h3>Sécurité</h3>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="var(--ag-gold-1)" strokeWidth="1.8" strokeLinejoin="round"/></svg>
          </div>
          <div className="ag-card-body">
            <div className="ag-form-group">
              <label className="ag-label">Fin de maintenance</label>
              <input
                type="datetime-local"
                className="ag-input"
                value={security.maintenanceEnd}
                onChange={e => setSecurity(s => ({ ...s, maintenanceEnd: e.target.value }))}
                disabled={loading}
              />
            </div>
            {[
              { key:'captcha',     label:'CAPTCHA',           sub:'Protection anti-bot', danger:false },
              { key:'ipTracking',  label:'Suivi IP',          sub:'Limiter par adresse IP', danger:false },
              { key:'maintenance', label:'Mode maintenance',  sub:'Suspendre toute la plateforme', danger:true },
            ].map(item => (
              <div key={item.key} className={`asetts-toggle-row ${item.danger ? 'danger-row' : ''}`}>
                <div>
                  <p className={`asetts-toggle-label ${item.danger ? 'danger-label' : ''}`}>{item.label}</p>
                  <p className="asetts-toggle-sub">{item.sub}</p>
                </div>
                <Toggle checked={security[item.key]} onChange={v => setSecurity(s => ({...s, [item.key]: v}))} danger={item.danger} />
              </div>
            ))} 
          </div>
        </motion.div>

      </div>

      {loading && (
        <div className="loading-overlay">
          <div className="loading-container"><span className="ag-spinner" /> Chargement des paramètres...</div>
        </div>
      )}
    </div>
  );
};

export default AdminSettings;
