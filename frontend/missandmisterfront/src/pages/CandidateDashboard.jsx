import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { authAPI, candidateAPI } from '../services/api';
import { formatCandidatePublicNumber } from '../utils/candidatePublic';
import { NO_AUTO_REFRESH_INTERVAL_MS, useAutoRefresh } from '../utils/liveUpdates';
import './CandidateDashboard.css';

const MiniChart = ({ data }) => {
  const safeData = data?.length ? data : [{ date: 'Aujourd’hui', votes: 0 }];
  const max = Math.max(...safeData.map(d => d.votes), 1);
  const w = 400;
  const h = 120;
  const pad = 16;
  const pts = safeData.map((d, i) => {
    const x = pad + (i / Math.max(safeData.length - 1, 1)) * (w - pad * 2);
    const y = h - pad - ((d.votes / max) * (h - pad * 2));
    return `${x},${y}`;
  });
  const area = `M${pts[0]} L${pts.join(' L')} L${w - pad},${h - pad} L${pad},${h - pad} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mini-chart" preserveAspectRatio="none">
      <defs>
        <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#D4AF37" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#cg)" />
      <polyline points={pts.join(' ')} fill="none" stroke="#D4AF37" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {safeData.map((_, i) => {
        const [x, y] = pts[i].split(',');
        return <circle key={i} cx={x} cy={y} r="4" fill="#D4AF37" stroke="#000" strokeWidth="2" />;
      })}
    </svg>
  );
};

const CandidateDashboard = () => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const [canLoad, setCanLoad] = useState(false);
  const hasLoadedRef = useRef(false);

  const loadDashboard = async () => {
    const isInitialLoad = !hasLoadedRef.current;

    try {
      if (isInitialLoad) {
        setData(null);
      }

      setError(null);
      const response = await candidateAPI.getDashboard();
      setData(response);
      hasLoadedRef.current = true;
    } catch (err) {
      if (err?.isSessionExpired) {
        return;
      }
      const message = err.message || 'Impossible de charger le tableau de bord';
      if (message.includes('Password change required')) {
        navigate('/change-password');
        return;
      }
      if (isInitialLoad) {
        setError(message);
      }
    } finally {
      if (isInitialLoad) {
        hasLoadedRef.current = true;
      }
    }
  };

  useEffect(() => {
    try {
      const token = localStorage.getItem('authToken');
      const user = JSON.parse(localStorage.getItem('user') || 'null');

      if (!token || !user) {
        navigate('/login');
        return;
      }

      if (user.role !== 'candidate') {
        navigate('/');
        return;
      }

      if (user.must_change_password) {
        navigate('/change-password');
        return;
      }

      setCanLoad(true);
    } catch {
      navigate('/login');
      return;
    }
  }, [navigate]);

  useAutoRefresh(loadDashboard, {
    enabled: canLoad,
    intervalMs: NO_AUTO_REFRESH_INTERVAL_MS,
    refreshOnFocus: false,
    refreshOnLiveUpdate: false,
    refreshOnStorage: false,
  });

  const retryLoadDashboard = async () => {
    hasLoadedRef.current = false;
    await loadDashboard();
  };

  const handleLogout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      navigate('/login');
    }
  };

  if (!data && !error) {
    return (
      <div className="cd-dash-loading">
        <motion.div className="cd-dash-spinner" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} />
        <p>Chargement de votre tableau de bord...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="cd-dash-loading">
        <p>{error}</p>
        <button className="cdb-nav-logout" type="button" onClick={retryLoadDashboard}>
          Réessayer
        </button>
      </div>
    );
  }

  const { candidate, totalVotes, rank, totalCandidates, evolution, history } = data;
  const objectiveVotes = Math.max(totalVotes || 0, 2000);
  const pct = objectiveVotes > 0 ? Math.min(100, Math.round(((totalVotes || 0) / objectiveVotes) * 100)) : 0;
  const fmtDate = (value) => value
    ? new Date(value).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : 'Date indisponible';

  return (
    <div className="candidat-dashboard">
      <div className="container">
        <div className="cdb-nav">
          <h2 className="cdb-nav-title">Espace candidat</h2>
          <button className="cdb-nav-logout" type="button" onClick={() => setLogoutConfirm(true)}>
            Se déconnecter
          </button>
        </div>

        <motion.div className="cdb-header" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="cdb-identity">
            <div className="cdb-avatar">{candidate.name?.charAt(0) || 'C'}</div>
            <div>
              <span className="cdb-eyebrow">Espace candidat</span>
              <h1>{candidate.name}</h1>
              <div className="cdb-meta">
                <span className={`cdb-cat ${(candidate.category || 'candidat').toLowerCase()}`}>{candidate.category}</span>
                <span className="cdb-univ">{candidate.university || 'Université non renseignée'}</span>
                <span className="cdb-num">N°{formatCandidatePublicNumber(candidate.public_number)}</span>
              </div>
            </div>
          </div>
          <div className="cdb-live-badge">
            <span className="cdb-live-dot" />
            Résultats en direct
          </div>
        </motion.div>

        <div className="cdb-stats-grid">
          {[
            {
              label: 'Total de votes reçus',
              value: (totalVotes || 0).toLocaleString('fr-FR'),
              icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="3" y="11" width="18" height="10" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M9 11V7a3 3 0 016 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><circle cx="12" cy="16" r="1.5" fill="currentColor"/></svg>,
              color: '#D4AF37',
              sub: 'Votes confirmés',
            },
            {
              label: 'Classement actuel',
              value: rank ? `#${rank}` : '—',
              icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/></svg>,
              color: '#f59e0b',
              sub: `sur ${totalCandidates || 0} candidats`,
            },
            {
              label: 'Progression objectif',
              value: `${pct}%`,
              icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M18 20V10M12 20V4M6 20v-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
              color: '#34d399',
              sub: `${(totalVotes || 0).toLocaleString('fr-FR')} / ${objectiveVotes.toLocaleString('fr-FR')} votes`,
            },
            {
              label: 'Votants récents',
              value: history.length,
              icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
              color: '#60a5fa',
              sub: 'Dernières confirmations',
            },
          ].map((stat, index) => (
            <motion.div key={index} className="cdb-stat-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.08 }} whileHover={{ y: -4 }}>
              <div className="cdb-stat-icon" style={{ background: stat.color + '18', color: stat.color }}>{stat.icon}</div>
              <div className="cdb-stat-body">
                <p className="cdb-stat-label">{stat.label}</p>
                <h3 className="cdb-stat-value" style={{ color: stat.color }}>{stat.value}</h3>
                <span className="cdb-stat-sub">{stat.sub}</span>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="cdb-mid-grid">
          <motion.div className="cdb-chart-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <div className="cdb-card-header">
              <h3>Évolution des votes</h3>
              <span className="cdb-card-badge">7 derniers jours</span>
            </div>
            <MiniChart data={evolution} />
            <div className="cdb-chart-labels">
              {(evolution || []).map((item, index) => <span key={index}>{item.date}</span>)}
            </div>
          </motion.div>

          <motion.div className="cdb-progress-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
            <div className="cdb-card-header">
              <h3>Progression objectif</h3>
            </div>
            <div className="cdb-rank-display">
              <div className="cdb-rank-circle">
                <svg viewBox="0 0 80 80" className="cdb-rank-svg">
                  <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(212,175,55,0.1)" strokeWidth="8" />
                  <motion.circle
                    cx="40"
                    cy="40"
                    r="34"
                    fill="none"
                    stroke="#D4AF37"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 34}`}
                    strokeDashoffset={`${2 * Math.PI * 34 * (1 - pct / 100)}`}
                    transform="rotate(-90 40 40)"
                    initial={{ strokeDashoffset: 2 * Math.PI * 34 }}
                    animate={{ strokeDashoffset: 2 * Math.PI * 34 * (1 - pct / 100) }}
                    transition={{ duration: 1.5, delay: 0.5, ease: 'easeOut' }}
                  />
                </svg>
                <div className="cdb-rank-inner">
                  <strong>{pct}%</strong>
                  <span>objectif</span>
                </div>
              </div>
            </div>

            <div className="cdb-progress-details">
              <div className="cdb-pd-row"><span>Votes actuels</span><strong className="text-gold">{(totalVotes || 0).toLocaleString('fr-FR')}</strong></div>
              <div className="cdb-pd-row"><span>Objectif</span><strong>{objectiveVotes.toLocaleString('fr-FR')}</strong></div>
              <div className="cdb-pd-row"><span>Écart</span><strong>{Math.max(objectiveVotes - (totalVotes || 0), 0).toLocaleString('fr-FR')} votes</strong></div>
              <div className="cdb-pd-row"><span>Classement</span><strong className="text-gold">{rank ? `#${rank}` : '—'} / {totalCandidates || 0}</strong></div>
            </div>

            <div className="cdb-progress-bar-wrap">
              <div className="cdb-progress-bar-label">
                <span>Progression</span>
                <span className="text-gold">{pct}%</span>
              </div>
              <div className="cdb-progress-track">
                <motion.div className="cdb-progress-fill" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1.2, delay: 0.6, ease: 'easeOut' }} />
              </div>
            </div>
          </motion.div>
        </div>

        <motion.div className="cdb-history-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
          <div className="cdb-card-header">
            <h3>Historique des votes reçus</h3>
            <span className="cdb-card-badge">{history.length} dernières transactions</span>
          </div>
          <div className="cdb-history-table">
            <table>
              <thead>
                <tr>
                  <th>Votant</th>
                  <th>Votes</th>
                  <th>Montant</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item, index) => (
                  <motion.tr key={item.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 + index * 0.05 }}>
                    <td className="cdb-voter">{item.voter}</td>
                    <td><span className="cdb-votes-badge">{item.votes} vote{item.votes > 1 ? 's' : ''}</span></td>
                    <td className="cdb-amount">{item.amount} FCFA</td>
                    <td className="cdb-date">{fmtDate(item.date)}</td>
                  </motion.tr>
                ))}
                {history.length === 0 && (
                  <tr>
                    <td colSpan="4" className="cdb-date">Aucun vote confirmé pour le moment.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {logoutConfirm && (
          <motion.div className="confirm-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="confirm-modal" initial={{ scale: 0.92, y: 18, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.9, y: 18, opacity: 0 }}>
              <div className="confirm-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="1.8"/>
                  <path d="M12 9v4M12 17h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </div>
              <h3>Confirmer la déconnexion</h3>
              <p>Vous serez redirigé vers la page de connexion.</p>
              <div className="confirm-actions">
                <button className="confirm-btn ghost" onClick={() => setLogoutConfirm(false)}>Annuler</button>
                <button className="confirm-btn danger" onClick={handleLogout}>Se déconnecter</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CandidateDashboard;
