import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, useOutletContext } from 'react-router-dom';
import { candidatesAPI } from '../services/api';
import CandidateCard from '../components/CandidateCard';
import Loader from '../components/Loader';
import './Candidates.css';

const FILTERS = [
  { key: 'all', label: 'Tous' },
  { key: 'miss', label: 'Miss' },
  { key: 'mister', label: 'Mister' },
];

const SORTS = [
  { key: 'votes', label: 'Votes (décroissant)' },
  { key: 'name', label: 'Nom A→Z' },
];

const Candidates = () => {
  console.log('🔄 Candidates component rendering');

  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('votes');
  const [searchQuery, setSearchQuery] = useState('');
  const { votingBlocked = false } = useOutletContext() || {};

  useEffect(() => {
    const fetchCandidates = async () => {
      try {
        console.log('🔄 Candidates: Début du chargement...');
        setLoading(true);
        setError(null);
        const data = await candidatesAPI.getAll();
        console.log('✅ Candidates: Données reçues:', data);
        setCandidates(data?.data || []);
        console.log('✅ Candidates: État mis à jour');
      } catch (err) {
        console.error('❌ Candidates: Erreur lors du chargement:', err);
        setError(err.message || 'Erreur lors du chargement des candidats');
        // Fallback temporaire pour debug
        setCandidates([
          {
            id: 1,
            first_name: 'Test',
            last_name: 'Candidate',
            category: { name: 'Miss' },
            university: 'Test University',
            photo_path: null,
            votes_count: 0
          }
        ]);
      } finally {
        console.log('🔄 Candidates: Fin du chargement, loading=false');
        setLoading(false);
      }
    };

    fetchCandidates();
  }, []);

  const buildName = (candidate) => `${candidate.first_name || ''} ${candidate.last_name || ''}`.trim();

  const filtered = candidates
    .filter(c => {
      const name = buildName(c).toLowerCase();
      const university = (c.university || '').toLowerCase();
      const matchCat = filter === 'all' || c.category?.name?.toLowerCase() === filter;
      const matchSearch = name.includes(searchQuery.toLowerCase()) ||
                          university.includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    })
    .sort((a, b) => {
      if (sortBy === 'votes') {
        return (b.votes_count || 0) - (a.votes_count || 0);
      }
      return buildName(a).toLowerCase().localeCompare(buildName(b).toLowerCase());
    });

  console.log('🔄 Candidates: Rendu avec loading=', loading, 'error=', error, 'candidates=', candidates.length);

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
            <span className="page-eyebrow">Concours 2026</span>
            <h1>Nos <span className="text-gold">Candidats</span></h1>
            <p>Découvrez les {candidates.length} candidats en compétition et votez pour vos favoris.</p>
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
            {filtered.length} candidat{filtered.length !== 1 ? 's' : ''} trouvé{filtered.length !== 1 ? 's' : ''}
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
              <button className="btn-gold" onClick={() => window.location.reload()}>
                Réessayer
              </button>
            </div>
          ) : (
            <div>
              {filtered.length > 0 ? (
                <div className="candidates-grid">
                  {filtered.map((candidate) => (
                    <CandidateCard key={candidate.id} candidate={candidate} votingBlocked={votingBlocked} />
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
          <motion.div className="cand-cta-box" initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="11" width="18" height="10" rx="2" stroke="#D4AF37" strokeWidth="1.8"/>
              <path d="M9 11V7a3 3 0 016 0v4" stroke="#D4AF37" strokeWidth="1.8" strokeLinecap="round"/>
              <circle cx="12" cy="16" r="1.5" fill="#D4AF37"/>
            </svg>
            <h2>Votez dès maintenant !</h2>
            <p>Créez votre compte gratuitement et soutenez votre candidat favori via Mobile Money.</p>
            {votingBlocked ? (
              <button className="btn-gold candidates-vote-blocked" type="button" disabled>
                Vote bloquer
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
