import { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { adminAPI } from '../../services/api';
import Loader from '../../components/Loader';
import { broadcastLiveUpdate, useAutoRefresh } from '../../utils/liveUpdates';
import './admin-theme.css';
import './AdminVotes.css';

const STATUS_CONFIG = {
  confirmed: { label: 'V', class: 'status-valid', title: 'Validé' },
  pending: { label: 'En attente', class: 'status-pending', title: 'En attente' },
  suspect: { label: 'Suspect', class: 'status-suspect', title: 'Suspect' },
  cancelled: { label: 'X', class: 'status-cancelled', title: 'Annulé' },
  failed: { label: 'Échoué', class: 'status-failed', title: 'Échoué' },
};

const OP_COLOR = { MTN: '#FFD700', Moov: '#4499FF', Flooz: '#FF6B00', fedapay: '#D4AF37', kkiapay: '#C8A53A' };

const formatProviderLabel = (provider = '') => {
  if (provider === 'fedapay') {
    return 'FedaPay';
  }

  if (provider === 'kkiapay') {
    return 'Kkiapay';
  }

  return provider || '—';
};

const formatCurrencyAmount = (value) => {
  const numericValue = Number(value || 0);
  const safeValue = Number.isFinite(numericValue) ? numericValue : 0;
  return safeValue.toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const ConfirmModal = ({ message, onConfirm, onCancel }) => (
  <div className="agc-overlay" onClick={onCancel}>
    <div className="agc-modal" onClick={e => e.stopPropagation()}>
      <div className="agc-modal-icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="#F4D03F" strokeWidth="2" />
          <path d="M12 9v4M12 17h.01" stroke="#F4D03F" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
      <p>{message}</p>
      <div className="agc-modal-actions">
        <button className="ag-btn ag-btn-ghost" onClick={onCancel}>Annuler</button>
        <button className="ag-btn ag-btn-danger" onClick={onConfirm}>Confirmer</button>
      </div>
    </div>
  </div>
);

const AdminVotes = () => {
  const [votes, setVotes] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatus] = useState('Tous');
  const [catFilter, setCat] = useState('Tous');
  const [operatorFilter, setOperator] = useState('Tous');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [sortBy, setSortBy] = useState('date_desc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const hasLoadedRef = useRef(false);
  const adminRole = (() => {
    try {
      return JSON.parse(localStorage.getItem('adminUser') || 'null')?.role || 'admin';
    } catch {
      return 'admin';
    }
  })();

  const mapVote = (v) => {
    const candidateName = v.candidate ? `${v.candidate.first_name} ${v.candidate.last_name}`.trim() : '—';
    const categoryName = v.candidate?.category?.name || '—';
    const quantity = Number(v.quantity ?? v.qty);
    const qty = Number.isFinite(quantity) && quantity > 0
      ? Math.round(quantity)
      : (v.amount ? Math.max(1, Math.round(v.amount / 100)) : 1);
    const paymentStatus = v.payment?.status || '';
    const rawAmount = Number(v.amount ?? v.payment?.amount ?? 0);
    const amount = Number.isFinite(rawAmount) ? rawAmount : 0;
    const isCountable = v.status === 'confirmed' && (!paymentStatus || paymentStatus === 'succeeded');
    const voterPhone = v.user?.phone
      || v.payment?.meta?.voter_phone
      || v.payment?.payload?.customer?.phone_number
      || v.payment?.payload?.fedapay?.customer?.phone_number
      || '—';
    const voterIdentity = v.user?.name
      || v.payment?.meta?.voter_name
      || v.user?.email
      || v.payment?.meta?.voter_email
      || (voterPhone !== '—' ? `Paiement ${voterPhone}` : '—');
    const protectedSuccessfulVote = v.status === 'confirmed' && paymentStatus === 'succeeded';

    return {
      id: v.id,
      candidate: candidateName,
      category: categoryName,
      voter: voterIdentity,
      voterPhone,
      qty,
      amount,
      operator: v.payment?.provider || v.operator || 'fedapay',
      paymentStatus,
      isCountable,
      protectedSuccessfulVote,
      status: v.status || 'pending',
      date: v.created_at,
      ip: v.ip_address || v.payment?.meta?.ip || '—',
      raw: v,
    };
  };

  const fetchVotes = async () => {
    const isInitialLoad = !hasLoadedRef.current;

    try {
      if (isInitialLoad) {
        setLoading(true);
      }

      const res = await adminAPI.getVotes({ per_page: 500 });
      const data = res?.data || res || [];
      setVotes(data.map(mapVote));
      setError(null);
      hasLoadedRef.current = true;
    } catch (err) {
      if (err?.isSessionExpired) {
        return;
      }

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

  useAutoRefresh(fetchVotes);

  const retryFetchVotes = async () => {
    hasLoadedRef.current = false;
    await fetchVotes();
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return votes.filter(v => {
      const matchSearch = v.candidate.toLowerCase().includes(q)
        || v.voter.toLowerCase().includes(q)
        || String(v.voterPhone || '').toLowerCase().includes(q)
        || String(v.id).toLowerCase().includes(q);
      const matchStatus = statusFilter === 'Tous' || v.status === statusFilter;
      const matchCat = catFilter === 'Tous' || v.category === catFilter;
      const matchOp = operatorFilter === 'Tous' || v.operator === operatorFilter;
      const matchAmount = !minAmount || v.amount >= Number(minAmount || 0);
      const voteDate = v.date ? new Date(v.date) : null;
      const matchFrom = !dateFrom || (voteDate && voteDate >= new Date(dateFrom));
      const matchTo = !dateTo || (voteDate && voteDate <= new Date(`${dateTo}T23:59:59`));
      return matchSearch && matchStatus && matchCat && matchOp && matchAmount && matchFrom && matchTo;
    });
  }, [votes, search, statusFilter, catFilter, operatorFilter, minAmount, dateFrom, dateTo]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const sorter = {
      date_desc: (a, b) => new Date(b.date || 0) - new Date(a.date || 0),
      date_asc: (a, b) => new Date(a.date || 0) - new Date(b.date || 0),
      amount_desc: (a, b) => b.amount - a.amount,
      amount_asc: (a, b) => a.amount - b.amount,
      qty_desc: (a, b) => b.qty - a.qty,
      qty_asc: (a, b) => a.qty - b.qty,
    };
    return arr.sort(sorter[sortBy] || sorter.date_desc);
  }, [filtered, sortBy]);

  const askStatusChange = (vote, newStatus, label) => {
    if (vote.protectedSuccessfulVote && newStatus !== 'confirmed') {
      setError('Un vote confirme avec paiement FedaPay reussi ne peut plus etre modifie.');
      return;
    }

    setConfirm({
      message: `${label} le vote ${vote.id} ?`,
      onConfirm: async () => {
        try {
          await adminAPI.updateVote(vote.id, { status: newStatus });
          setVotes(p => p.map(v => v.id === vote.id ? { ...v, status: newStatus } : v));
          broadcastLiveUpdate('votes');
        } catch (err) {
          if (err?.isSessionExpired) {
            return;
          }
          setError(err.message || 'Échec de la mise à jour');
        } finally {
          setConfirm(null);
        }
      },
    });
  };

  const handleDelete = (vote) => {
    const isAllowed = !vote.protectedSuccessfulVote || adminRole === 'superadmin';
    if (!isAllowed) {
      setError('Seul le superadmin peut supprimer un vote confirme avec paiement reussi.');
      return;
    }

    setConfirm({
      message: vote.protectedSuccessfulVote
        ? `Supprimer definitivement le vote ${vote.id} ? Cette action est reservee au superadmin.`
        : `Supprimer definitivement le vote ${vote.id} et ses traces de paiement non confirme ?`,
      onConfirm: async () => {
        try {
          await adminAPI.deleteVote(vote.id);
          setVotes((previousVotes) => previousVotes.filter((currentVote) => currentVote.id !== vote.id));
          setSelected((previousSelection) => {
            const next = new Set(previousSelection);
            next.delete(vote.id);
            return next;
          });
          broadcastLiveUpdate('votes');
        } catch (err) {
          if (err?.isSessionExpired) {
            return;
          }
          setError(err.message || 'Échec de la suppression du vote');
        } finally {
          setConfirm(null);
        }
      },
    });
  };

  const exportCSV = () => {
    const header = ['ID','Candidat','Catégorie','Votant','Votes','Montant','Opérateur','Statut','Date','IP'];
    const rows   = votes.map(v => [v.id, v.candidate, v.category, v.voter, v.qty, v.amount, v.operator, v.status, v.date, v.ip]);
    const csv    = '\uFEFF' + [header, ...rows].map(r => r.join(';')).join('\n');
    const blob   = new Blob([csv], { type:'text/csv;charset=utf-8;' });
    const url    = URL.createObjectURL(blob);
    const a      = document.createElement('a'); a.href = url; a.download = 'votes_export.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const total     = votes.filter(v => v.isCountable).reduce((s, v) => s + (v.qty || 0), 0);
  const valid     = votes.filter(v => v.isCountable).reduce((s, v) => s + (v.qty || 0), 0);
  const suspect   = votes.filter(v => v.status === 'suspect').reduce((s, v) => s + (v.qty || 0), 0);
  const cancelled = votes.filter(v => v.status === 'cancelled').reduce((s, v) => s + (v.qty || 0), 0);
  const revenue   = votes.filter(v => v.isCountable).reduce((s, v) => s + v.amount, 0);

  const toggleSelectAll = (checked) => {
    if (checked) {
      setSelected(new Set(sorted.map(v => v.id)));
    } else {
      setSelected(new Set());
    }
  };

  const toggleSelectOne = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const bulkUpdate = async (status, label) => {
    if (selected.size === 0) return;
    const ids = Array.from(selected).filter((id) => {
      const vote = votes.find((currentVote) => currentVote.id === id);
      return !(vote?.protectedSuccessfulVote && status !== 'confirmed');
    });
    if (ids.length === 0) {
      setError('La sélection contient uniquement des votes déjà protégés par un paiement FedaPay confirmé.');
      return;
    }
    if (!window.confirm(`${label} ${ids.length} vote(s) ?`)) return;
    setBulkLoading(true);
    try {
      for (const id of ids) {
        await adminAPI.updateVote(id, { status });
      }
      setVotes(p => p.map(v => selected.has(v.id) ? { ...v, status } : v));
      setSelected(new Set());
      broadcastLiveUpdate('votes');
    } catch (err) {
      if (err?.isSessionExpired) {
        return;
      }
          setError(err.message || 'Échec de la mise à jour groupée');
        } finally {
          setBulkLoading(false);
        }
      };

  if (loading) {
    return (
      <div className="admin-page avotes">
        <div className="loading-container"><Loader /><p>Chargement des votes...</p></div>
      </div>
    );
  }

  return (
    <div className="admin-page avotes">

      {confirm && <ConfirmModal {...confirm} onCancel={() => setConfirm(null)} />}

      <div className="avotes-header">
        <div>
          <h1>Gestion des votes</h1>
          <p>Suivi et audit de toutes les transactions de vote</p>
        </div>
        <div className="avotes-header-actions">
          <button className="ag-btn ag-btn-outline" onClick={() => { setSearch(''); setStatus('Tous'); setCat('Tous'); setOperator('Tous'); setDateFrom(''); setDateTo(''); setMinAmount(''); }}>
            Réinitialiser
          </button>
          <button className="ag-btn ag-btn-outline" onClick={exportCSV}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Exporter CSV
          </button>
        </div>
      </div>

      <div className="avotes-stats">
        {[
          { label:'Votes comptabilisés', value: total,            color:'#D4AF37' },
          { label:'Valides',      value: valid,                   color:'#4ADE80' },
          { label:'Suspects',     value: suspect,                 color:'#FBBF24' },
          { label:'Annulés',      value: cancelled,               color:'#F87171' },
          { label:'Revenus FCFA', value: formatCurrencyAmount(revenue), color:'#D4AF37' },
        ].map((s, i) => (
          <motion.div key={i} className="avotes-stat" initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay: i * 0.07 }}>
            <span className="avotes-stat-val" style={{ color: s.color }}>{s.value}</span>
            <span className="avotes-stat-lbl">{s.label}</span>
          </motion.div>
        ))}
      </div>

      {error && (
        <div className="error-container" style={{ margin: '0 0 1rem 0' }}>
          <p style={{ margin: 0 }}>{error}</p>
          <button className="btn-gold" onClick={retryFetchVotes}>Réessayer</button>
        </div>
      )}

      <div className="avotes-filters">
        <div className="avotes-search-wrap">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="avotes-search-icon">
            <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
            <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <input className="ag-input avotes-search" placeholder="Rechercher par ID, candidat, votant…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="ag-input ag-select avotes-select" value={statusFilter} onChange={e => setStatus(e.target.value)}>
          <option>Tous</option>
          <option value="confirmed">Valides</option>
          <option value="pending">En attente</option>
          <option value="suspect">Suspects</option>
          <option value="failed">Échoués</option>
          <option value="cancelled">Annulés</option>
        </select>
        <select className="ag-input ag-select avotes-select" value={catFilter} onChange={e => setCat(e.target.value)}>
          <option>Tous</option>
          <option>Miss</option>
          <option>Mister</option>
        </select>
        <select className="ag-input ag-select avotes-select" value={operatorFilter} onChange={e => setOperator(e.target.value)}>
          <option>Tous</option>
          <option value="fedapay">FedaPay</option>
          <option value="kkiapay">Kkiapay</option>
          <option>MTN</option>
          <option>Moov</option>
          <option>Flooz</option>
        </select>
        <input type="date" className="ag-input avotes-select" value={dateFrom} onChange={e => setDateFrom(e.target.value)} title="Du" />
        <input type="date" className="ag-input avotes-select" value={dateTo} onChange={e => setDateTo(e.target.value)} title="Au" />
        <input type="number" className="ag-input avotes-select" placeholder="Montant min" value={minAmount} onChange={e => setMinAmount(e.target.value)} min={0} />
        <select className="ag-input ag-select avotes-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="date_desc">Date ↓</option>
          <option value="date_asc">Date ↑</option>
          <option value="amount_desc">Montant ↓</option>
          <option value="amount_asc">Montant ↑</option>
          <option value="qty_desc">Votes ↓</option>
          <option value="qty_asc">Votes ↑</option>
        </select>
      </div>

      <div className="avotes-bulk">
        <span>{selected.size} sélectionné(s)</span>
        <div className="avotes-bulk-actions">
          <button className="ag-btn ag-btn-outline" disabled={selected.size === 0 || bulkLoading} onClick={() => bulkUpdate('confirmed', 'Valider')}>
            ✓ Valider
          </button>
          <button className="ag-btn ag-btn-outline" disabled={selected.size === 0 || bulkLoading} onClick={() => bulkUpdate('suspect', 'Marquer suspect')}>
            ! Suspect
          </button>
          <button className="ag-btn ag-btn-danger" disabled={selected.size === 0 || bulkLoading} onClick={() => bulkUpdate('cancelled', 'Annuler')}>
            ⨯ Annuler
          </button>
        </div>
      </div>

      <motion.div className="ag-card" initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.2 }}>
        <div className="avotes-table-wrap">
          <table className="ag-table ag-table-responsive">
            <thead>
              <tr>
                <th>
                  <input type="checkbox" aria-label="Tout sélectionner" checked={selected.size > 0 && selected.size === sorted.length} onChange={e => toggleSelectAll(e.target.checked)} />
                </th>
                <th>ID</th>
                <th>Candidat</th>
                <th>Votant</th>
                <th>Votes</th>
                <th>Montant</th>
                <th>Opérateur</th>
                <th>Statut</th>
                <th>Date</th>
                <th>IP</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(v => (
                <motion.tr key={v.id} initial={{ opacity:0 }} animate={{ opacity:1 }}>
                  <td data-label="Sélection"><input type="checkbox" checked={selected.has(v.id)} onChange={() => toggleSelectOne(v.id)} aria-label={`Sélectionner le vote ${v.id}`} /></td>
                  <td data-label="ID"><span className="avotes-id">{v.id}</span></td>
                  <td data-label="Candidat">
                    <div>
                      <p className="avotes-cand-name">{v.candidate}</p>
                      <span className={`ag-badge ${v.category === 'Miss' ? 'adash-miss' : 'adash-mister'}`} style={{ fontSize:'0.6rem' }}>{v.category}</span>
                    </div>
                  </td>
                  <td data-label="Votant">
                    <div>
                      <span className="avotes-voter">{v.voter}</span>
                      <br />
                      <span className="avotes-ip">{v.voterPhone}</span>
                    </div>
                  </td>
                  <td data-label="Votes"><span className="avotes-qty">{v.qty}</span></td>
                  <td data-label="Montant"><span className="avotes-amount">{formatCurrencyAmount(v.amount)} F</span></td>
                  <td data-label="Opérateur">
                    <span className="avotes-op" style={{ color: OP_COLOR[v.operator] || '#D4AF37', borderColor: (OP_COLOR[v.operator] || '#D4AF37') + '44' }}>
                      {formatProviderLabel(v.operator)}
                    </span>
                  </td>
                  <td data-label="Statut">
                    <span
                      className={`avotes-status ${STATUS_CONFIG[v.status]?.class || 'status-pending'}`}
                      title={STATUS_CONFIG[v.status]?.title || v.status}
                      aria-label={STATUS_CONFIG[v.status]?.title || v.status}
                    >
                      <span className="avotes-status-icon">{STATUS_CONFIG[v.status]?.label || v.status}</span>
                    </span>
                  </td>
                  <td data-label="Date"><span className="avotes-date">{v.date ? new Date(v.date).toLocaleString('fr-FR') : '—'}</span></td>
                  <td data-label="IP"><span className="avotes-ip">{v.ip}</span></td>
                  <td data-label="Actions">
                    <div className="avotes-actions">
                      {!v.protectedSuccessfulVote && v.status !== 'confirmed' && (
                        <button className="ag-btn ag-btn-ghost" title="Valider" onClick={() => askStatusChange(v, 'confirmed', 'Valider')}>
                          ✓
                        </button>
                      )}
                      {!v.protectedSuccessfulVote && v.status !== 'cancelled' && (
                        <button className="ag-btn ag-btn-outline" title="Suspect" onClick={() => askStatusChange(v, 'suspect', 'Marquer suspect')}>
                          !
                        </button>
                      )}
                      {adminRole === 'superadmin' && (
                        <button className="ag-btn ag-btn-danger" title="Annuler" onClick={() => handleDelete(v)}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M10 11v6M14 11v6M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                        </button>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
              {sorted.length === 0 && (
                <tr><td colSpan={11} style={{ textAlign:'center', padding:'2.5rem', color:'var(--ag-text-3)' }}>Aucun vote trouvé</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
};

export default AdminVotes;
