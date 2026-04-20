import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { adminAPI } from '../../services/api';
import Loader from '../../components/Loader';
import { ADMIN_LIVE_UPDATE_INTERVAL_MS, broadcastLiveUpdate, useAutoRefresh } from '../../utils/liveUpdates';
import './admin-theme.css';
import './AdminUsers.css';

const ConfirmModal = ({ message, onConfirm, onCancel }) => (
  <motion.div className="agc-overlay" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} onClick={onCancel}>
    <motion.div className="agc-modal" initial={{ scale:0.88,y:24 }} animate={{ scale:1,y:0 }} exit={{ scale:0.88,y:24 }} onClick={e => e.stopPropagation()}>
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
);

const AdminUsers = () => {
  const [users, setUsers]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [search, setSearch]     = useState('');
  const [filter, setFilter]     = useState('Actifs');
  const [confirm, setConfirm]   = useState(null);
  const [page, setPage]         = useState(1);
  const [perPage]               = useState(25);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const hasLoadedRef = useRef(false);
  const adminRole = (() => {
    try {
      return JSON.parse(localStorage.getItem('adminUser') || 'null')?.role || 'admin';
    } catch {
      return 'admin';
    }
  })();
  const canDeleteRecords = adminRole === 'superadmin';

  const isGuestUser = (user) => user?.registered === false || user?.status === 'guest' || String(user?.id || '').startsWith('guest-');
  const isAdminAccount = (user) => user?.kind === 'admin' || user?.role === 'admin' || user?.role === 'superadmin';

  const fetchUsers = async () => {
    const isInitialLoad = !hasLoadedRef.current;

    try {
      if (isInitialLoad) {
        setLoading(true);
      }

      const res = await adminAPI.getUsers({ per_page: 100 });
      const data = res?.data || res || [];
      setUsers(data);
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

  useAutoRefresh(fetchUsers, {
    intervalMs: ADMIN_LIVE_UPDATE_INTERVAL_MS,
    enabled: autoRefreshEnabled,
  });

  const retryFetchUsers = async () => {
    hasLoadedRef.current = false;
    setAutoRefreshEnabled(true);
    await fetchUsers();
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return users.filter(u => {
      const matchS = (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q) || (u.phone || '').toLowerCase().includes(q);
      const matchF = filter === 'Tous' || (filter === 'Actifs' && u.status === 'active') || (filter === 'Suspendus' && u.status === 'inactive');
      return matchS && matchF;
    });
  }, [users, search, filter]);

  useEffect(() => {
    setPage(1);
  }, [search, filter, users.length]);

  const paginated = useMemo(() => {
    const start = (page - 1) * perPage;
    return filtered.slice(start, start + perPage);
  }, [filtered, page, perPage]);

  const handleToggle = (user) => {
    if (isGuestUser(user)) {
      setError('Les comptes invites sont en lecture seule.');
      return;
    }

    if (isAdminAccount(user) && adminRole !== 'superadmin') {
      setError('Seul le superadmin peut gerer un compte administrateur.');
      return;
    }

    const msg = user.status === 'active' ? `Suspendre ${user.name} ?` : `Réactiver ${user.name} ?`;
    setConfirm({
      message: msg,
      onConfirm: async () => {
        try {
          await adminAPI.updateUserStatus(user.id);
          setUsers(p => p.map(x => x.id === user.id ? { ...x, status: x.status === 'active' ? 'inactive' : 'active' } : x));
          broadcastLiveUpdate('users');
        } catch (err) {
          if (err?.isSessionExpired) {
            return;
          }
          setError(err.message || 'Échec de la mise à jour');
        } finally {
          setConfirm(null);
        }
      }
    });
  };

  const handleDelete = (user) => {
    if (!canDeleteRecords) {
      setError('Seul le superadmin peut désactiver un compte.');
      return;
    }

    if (isGuestUser(user)) {
      setError('Les comptes invites ne peuvent pas etre desactives.');
      return;
    }

    setConfirm({ message: `Désactiver le compte de ${user.name} ?`, onConfirm: async () => {
      try {
        await adminAPI.deleteUser(user.id);
        // On enlève de la liste côté UI pour qu'il disparaisse immédiatement,
        // tout en gardant une désactivation en base (status=inactive).
        setUsers(p => p.filter(x => x.id !== user.id));
        broadcastLiveUpdate('users');
      } catch (err) {
        if (err?.isSessionExpired) {
          return;
        }
        setError(err.message || 'Échec de la désactivation');
      } finally {
        setConfirm(null);
      }
    } });
  };

  const active    = users.filter(u => u.status === 'active').length;
  const suspended = users.filter(u => u.status === 'inactive').length;
  const guests    = users.filter(isGuestUser).length;

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));

  const exportCSV = () => {
    const header = ['ID','Nom','Email','Téléphone','Statut','Votes','Dernier vote','IP','Créé le'];
    const rows = filtered.map(u => [u.id, u.name, u.email || '', u.phone || '', u.status, u.votes_count || 0, u.last_vote_at || '', u.last_vote_ip || '', u.created_at || '']);
    const csv = '\uFEFF' + [header, ...rows].map(r => r.join(';')).join('\n');
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'users_export.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="admin-page ausers">
      <AnimatePresence>{confirm && <ConfirmModal {...confirm} onCancel={() => setConfirm(null)} />}</AnimatePresence>

      <div className="ausers-header">
        <div>
          <h1>Gestion des utilisateurs</h1>
          <p>Gérez les votants inscrits sur la plateforme</p>
        </div>
        <button className="ag-btn ag-btn-outline" onClick={exportCSV}>
          Export CSV
        </button>
        <div className="ausers-header-stats">
          <span className="ausers-hstat active"><span className="ausers-hstat-dot" />{active} actifs</span>
          <span className="ausers-hstat suspended"><span className="ausers-hstat-dot" />{suspended} inactifs</span>
          <span className="ausers-hstat guest"><span className="ausers-hstat-dot" />{guests} invités</span>
        </div>
      </div>

      {error && (
        <div className="error-container" style={{ margin:'0 0 1rem 0' }}>
          <p style={{ margin:0 }}>{error}</p>
          <button className="btn-gold" onClick={retryFetchUsers}>Réessayer</button>
        </div>
      )}

      <div className="ausers-filters">
        <div className="ausers-search-wrap">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="ausers-search-icon">
            <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
            <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <input className="ag-input ausers-search" placeholder="Rechercher un utilisateur…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="ausers-tabs">
          {['Tous','Actifs','Suspendus'].map(t => (
            <button key={t} className={`acand-tab ${filter === t ? 'active' : ''}`} onClick={() => setFilter(t)}>{t}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="loading-container"><Loader /><p>Chargement des utilisateurs...</p></div>
      ) : (
      <motion.div className="ag-card" initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.15 }}>
        <div className="ausers-table-wrap">
          <table className="ag-table ag-table-responsive">
            <thead>
              <tr>
                <th>Utilisateur</th>
                <th>Téléphone</th>
                <th>Votes effectués</th>
                <th>Dernier vote</th>
                <th>IP</th>
                <th>Inscription</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map(u => (
                <motion.tr key={u.id} initial={{ opacity:0 }} animate={{ opacity:1 }}>
                  <td data-label="Utilisateur">
                    <div className="ausers-identity">
                      <div className="ausers-avatar">{u.name.charAt(0)}</div>
                      <div>
                        <p className="ausers-name">{u.name}</p>
                        <p className="ausers-email">
                          {u.email || (isGuestUser(u) ? 'Compte invité' : '—')}
                          {isAdminAccount(u) ? ' • Administrateur' : ''}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td data-label="Téléphone"><span className="ausers-phone">{u.phone || '—'}</span></td>
                  <td data-label="Votes effectués">
                    <span className="ausers-votes-badge">{(u.votes_count || 0)} vote{(u.votes_count || 0) > 1 ? 's' : ''}</span>
                  </td>
                  <td data-label="Dernier vote"><span className="ausers-date">{u.last_vote_at ? new Date(u.last_vote_at).toLocaleString('fr-FR') : '—'}</span></td>
                  <td data-label="IP"><span className="ausers-ip">{u.last_vote_ip || '—'}</span></td>
                  <td data-label="Inscription"><span className="ausers-date">{u.created_at ? new Date(u.created_at).toLocaleDateString('fr-FR') : '—'}</span></td>
                  <td data-label="Statut">
                    <span className={`ausers-status ${isGuestUser(u) ? 'guest' : (u.status === 'active' ? 'active' : 'suspended')}`}>
                      <span className="ausers-status-dot" />
                      {isGuestUser(u) ? 'Invité' : isAdminAccount(u) ? `Admin ${u.status === 'active' ? 'actif' : 'inactif'}` : (u.status === 'active' ? 'Actif' : 'Inactif')}
                    </span>
                  </td>
                  <td data-label="Actions">
                    {isGuestUser(u) ? (
                      <span className="ausers-readonly">Lecture seule</span>
                    ) : (isAdminAccount(u) && adminRole !== 'superadmin') ? (
                      <span className="ausers-readonly">Superadmin requis</span>
                    ) : (
                      <div className="ausers-actions">
                        <button className={`ag-btn ${u.status === 'active' ? 'ag-btn-ghost' : 'ag-btn-outline'} ausers-action-btn`} onClick={() => handleToggle(u)}>
                          {u.status === 'active' ? 'Suspendre' : 'Réactiver'}
                        </button>
                        {canDeleteRecords && (
                          <button className="ag-btn ag-btn-danger ausers-del-btn" onClick={() => handleDelete(u)}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </motion.tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign:'center', padding:'2.5rem', color:'var(--ag-text-3)' }}>Aucun utilisateur trouvé</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
      )}

      {/* Pagination */}
      {filtered.length > perPage && (
        <div className="ausers-pagination">
          <button className="ag-btn ag-btn-ghost" disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Précédent</button>
          <span className="ausers-page">Page {page} / {totalPages}</span>
          <button className="ag-btn ag-btn-ghost" disabled={page === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Suivant</button>
        </div>
      )}
    </div>
  );
};

export default AdminUsers;
