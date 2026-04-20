import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useOutletContext } from 'react-router-dom';
import { candidatesAPI } from '../services/api';
import CandidateCard from '../components/CandidateCard';
import Loader from '../components/Loader';
import { PUBLIC_LIVE_UPDATE_INTERVAL_MS, useAutoRefresh } from '../utils/liveUpdates';
import './Candidates.css';

const FILTERS = [
  { key: 'miss', label: 'Miss' },
  { key: 'mister', label: 'Mister' },
];

const SORTS = [
  { key: 'votes_desc', label: 'Votes décroissants' },
  { key: 'order', label: "Numéro d'ordre" },
  { key: 'name', label: 'Nom A→Z' },
];

const compareCandidatesByCategoryAndNumber = (leftCandidate, rightCandidate) => {
  const leftCategory = String(leftCandidate.category?.name || '').toLowerCase();
  const rightCategory = String(rightCandidate.category?.name || '').toLowerCase();
  const categoryCompare = leftCategory.localeCompare(rightCategory, 'fr', { sensitivity: 'base' });

  if (categoryCompare !== 0) {
    return categoryCompare;
  }

  const leftNumber = Number(leftCandidate.public_number ?? Number.MAX_SAFE_INTEGER);
  const rightNumber = Number(rightCandidate.public_number ?? Number.MAX_SAFE_INTEGER);

  if (leftNumber !== rightNumber) {
    return leftNumber - rightNumber;
  }

  return `${leftCandidate.first_name || ''} ${leftCandidate.last_name || ''}`
    .trim()
    .toLowerCase()
    .localeCompare(
      `${rightCandidate.first_name || ''} ${rightCandidate.last_name || ''}`.trim().toLowerCase(),
      'fr',
      { sensitivity: 'base' }
    );
};

const Candidates = () => {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('miss');
  const [sortBy, setSortBy] = useState('votes_desc');
  const [searchQuery, setSearchQuery] = useState('');
  const hasLoadedRef = useRef(false);
  const { votingBlocked = false } = useOutletContext() || {};

  const fetchCandidates = async () => {
    const isInitialLoad = !hasLoadedRef.current;

    try {
      if (isInitialLoad) {
        setLoading(true);
      }

      const data = await candidatesAPI.getAll();
      setCandidates(data?.data || []);
      setError(null);
      hasLoadedRef.current = true;
    } catch (err) {
      console.error('❌ Candidates: Erreur lors du chargement:', err);
      if (isInitialLoad) {
        setError(err.message || 'Erreur lors du chargement des candidats');
      }
    } finally {
      if (isInitialLoad) {
        hasLoadedRef.current = true;
        setLoading(false);
      }
    }
  };

  useAutoRefresh(fetchCandidates, {
    intervalMs: PUBLIC_LIVE_UPDATE_INTERVAL_MS,
    minGapMs: 30000,
    refreshOnFocus: false,
    refreshOnLiveUpdate: false,
    refreshOnStorage: false,
  });

  const retryFetchCandidates = async () => {
    hasLoadedRef.current = false;
    await fetchCandidates();
  };

  const buildName = (candidate) => `${candidate.first_name || ''} ${candidate.last_name || ''}`.trim();
  const activeFilterLabel = FILTERS.find(({ key }) => key === filter)?.label || 'Miss';

  const filtered = candidates
    .filter(c => {
      const name = buildName(c).toLowerCase();
      const university = (c.university || '').toLowerCase();
      const matchCat = c.category?.name?.toLowerCase() === filter;
      const matchSearch = name.includes(searchQuery.toLowerCase()) ||
                          university.includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    })
    .sort((a, b) => {
      if (sortBy === 'votes_desc') {
        const voteGap = Number(b.votes_count || 0) - Number(a.votes_count || 0);

        if (voteGap !== 0) {
          return voteGap;
        }

        return compareCandidatesByCategoryAndNumber(a, b);
      }

      if (sortBy === 'order') {
        return compareCandidatesByCategoryAndNumber(a, b);
      }

      return buildName(a).toLowerCase().localeCompare(buildName(b).toLowerCase());
    });
  return (
    <div className="candidates-page">
      {/* ── HERO ── */}
      <section className="candidates-hero">
        <div className="cand-hero-bg" aria-hidden="true">
          <div className="cand-orb orb-1" />
          <div className="cand-orb orb-2" />
        </div>
        <div className="container">
          <div className="cand-hero-content">
            <h1>Nos <span className="text-gold">Candidats</span></h1>
            <p>Découvrez les candidats par catégorie distincte et soutenez vos favoris en toute clarté.</p>
            <div className="cand-hero-counts">
              <div className="count-pill">
                <span className="count-num">{candidates.filter(c => c.category?.name?.toLowerCase() === 'miss').length}</span>
                <span>Miss</span>
              </div>
              <div className="count-divider" />
              <div className="count-pill">
                <span className="count-num">{candidates.filter(c => c.category?.name?.toLowerCase() === 'mister').length}</span>
                <span>Mister</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FILTRES ── */}
      <section className="candidates-controls">
        <div className="container">
          <motion.div className="controls-bar" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>

            {/* Filtres catégories */}
            <div className="filter-tabs">
              {FILTERS.map(f => (
                <button
                  key={f.key}
                  className={`filter-tab ${filter === f.key ? 'active' : ''}`}
                  onClick={() => setFilter(f.key)}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Recherche + tri */}
            <div className="controls-right">
              <div className="search-wrap">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="search-ico">
                  <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
                  <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <input
                  type="text"
                  placeholder="Rechercher un candidat..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="search-input"
                />
              </div>
              <select
                className="site-select sort-select"
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
              >
                {SORTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
          </motion.div>

          {/* Compteur résultats */}
          <p className="results-count">
            {filtered.length} candidat{filtered.length !== 1 ? 's' : ''} dans la catégorie {activeFilterLabel}
          </p>
        </div>
      </section>

      {/* ── GRILLE ── */}
      <section className="candidates-grid-section section">
        <div className="container">
          {loading ? (
            <div className="loading-container">
              <Loader />
              <p>Chargement des candidats...</p>
            </div>
          ) : error ? (
            <div className="error-container">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="#ef4444" strokeWidth="1.5"/>
                <path d="M15 9l-6 6M9 9l6 6" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <h3>Erreur de chargement</h3>
              <p>{error}</p>
              <button className="btn-gold" onClick={retryFetchCandidates}>
                Réessayer
              </button>
            </div>
          ) : (
            <div>
              {filtered.length > 0 ? (
                <div className="candidates-grid">
                  {filtered.map((candidate, index) => (
                    <CandidateCard
                      key={candidate.public_uid || candidate.slug || candidate.public_number || index}
                      candidate={candidate}
                      votingBlocked={votingBlocked}
                    />
                  ))}
              </div>
              ) : (
                <div className="no-results">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="rgba(212,175,55,0.5)" strokeWidth="1.5" />
                    <path d="M15 9l-6 6M9 9l6 6" stroke="rgba(212,175,55,0.6)" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <h3>Aucun candidat trouvé</h3>
                  <p>Essayez de modifier vos critères de recherche.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ── CTA VOTE ── */}
      <section className="candidates-cta">
        <div className="container">
          <motion.div
            className="cand-cta-box"
            initial={{ opacity: 0, y: 34, scale: 0.97, filter: 'blur(8px)' }}
            whileInView={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            viewport={{ once: false, amount: 0.18 }}
            transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="11" width="18" height="10" rx="2" stroke="#D4AF37" strokeWidth="1.8"/>
              <path d="M9 11V7a3 3 0 016 0v4" stroke="#D4AF37" strokeWidth="1.8" strokeLinecap="round"/>
              <circle cx="12" cy="16" r="1.5" fill="#D4AF37"/>
            </svg>
            <h2>Votez dès maintenant !</h2>
            <p>Créez votre compte gratuitement et soutenez votre candidat favori via Mobile Money.</p>
            {votingBlocked ? (
              <button className="btn-gold candidates-vote-blocked" type="button" disabled>
                Vote bloqué
              </button>
            ) : (
              <Link to="/register">
                <motion.button className="btn-gold" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                  Voter maintenant
                </motion.button>
              </Link>
            )}
          </motion.div>
        </div>
      </section>

    </div>
  );
};

export default Candidates;
