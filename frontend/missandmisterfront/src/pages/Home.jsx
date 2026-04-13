import { useState, useEffect, useRef } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { motion, useInView } from 'framer-motion';
import { candidatesAPI } from '../services/api';
import CandidateCard from '../components/CandidateCard';
import Loader from '../components/Loader';
import sessionHero from '../assets/session_hero.png';
import sessionMobile from '../assets/session_mobil.png';
import { useAutoRefresh } from '../utils/liveUpdates';
import './Home.css';

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 40 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay, ease: 'easeOut' },
});

const heroVisualMotion = {
  initial: { opacity: 0, y: 40 },
  animate: { opacity: 1, y: [0, -10, 0] },
  transition: {
    opacity: { duration: 0.6, delay: 0.2, ease: 'easeOut' },
    y: { duration: 6, delay: 0.2, repeat: Infinity, ease: 'easeInOut' },
  },
};

const getCountdownState = (remainingSeconds = 0, totalSeconds = 0) => {
  const remaining = Math.max(0, Number.isFinite(remainingSeconds) ? remainingSeconds : 0);
  const total = Math.max(0, Number.isFinite(totalSeconds) ? totalSeconds : 0);

  const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
  const hours = Math.floor((remaining / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((remaining / (1000 * 60)) % 60);
  const seconds = Math.floor((remaining / 1000) % 60);
  const percentLeft = total > 0 ? Math.max(0, Math.min(100, (remaining / total) * 100)) : 0;

  return {
    days,
    hours,
    minutes,
    seconds,
    percentLeft: Math.round(percentLeft),
  };
};

const CountUp = ({ target, suffix = '' }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  const countRef = useRef(null);

  useEffect(() => {
    if (!isInView) return;
    let start = 0;
    const duration = 1800;
    const step = 16;
    const increment = target / (duration / step);
    const timer = setInterval(() => {
      start += increment;
      if (start >= target) { start = target; clearInterval(timer); }
      if (countRef.current) countRef.current.textContent = Math.floor(start).toLocaleString('fr-FR') + suffix;
    }, step);
    return () => clearInterval(timer);
  }, [isInView, target, suffix]);

  return <span ref={ref}><span ref={countRef}>0{suffix}</span></span>;
};

const FILTERS = [
  { key: 'all', label: 'Tous' },
  { key: 'miss', label: 'Miss' },
  { key: 'mister', label: 'Mister' },
];

const SORTS = [
  { key: 'votes', label: 'Votes (décroissant)' },
  { key: 'name', label: 'Nom A→Z' },
];

const HERO_TITLE_LINES = [
  { text: 'MISS & MISTER', className: 'hero-title-line-primary' },
  { text: 'University Bénin', className: 'hero-title-line-secondary' },
];

const HOME_OVERVIEW = [
  {
    title: 'Concours national',
    description: 'Une plateforme éducative, culturelle et citoyenne ouverte aux universités publiques et privées du Bénin.',
    badge: 'Projet officiel',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round"/>
        <path d="M9 22V12h6v10" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    title: 'Excellence et leadership',
    description: 'Le projet valorise l’excellence académique, l’éloquence, la discipline et l’esprit d’initiative des étudiants.',
    badge: 'Valeurs fortes',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    title: 'Participation encadrée',
    description: 'Les candidatures sont gratuites, vérifiées administrativement, puis accompagnées jusqu’à la grande finale.',
    badge: '16 à 25 ans',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"/>
        <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.9"/>
        <path d="M16 5h6M19 2v6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    title: 'Transparence et sécurité',
    description: 'Jury pluriel, vote sécurisé, validation claire et protection active contre les tentatives de fraude.',
    badge: 'Vote sécurisé',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round"/>
        <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
];

const PROGRAM_STEPS = [
  {
    step: '01',
    title: 'Lancement officiel',
    desc: 'Annonce du concours et mobilisation nationale autour des universités béninoises.',
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 11l8-8 8 8-8 8-8-8z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M12 3v18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>,
  },
  {
    step: '02',
    title: 'Inscriptions gratuites',
    desc: 'Les candidats éligibles déposent leurs dossiers selon les modalités définies par le comité.',
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 4h16v16H4z" stroke="currentColor" strokeWidth="1.8"/><path d="M8 12h8M12 8v8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>,
  },
  {
    step: '03',
    title: 'Validation administrative',
    desc: 'Chaque dossier est vérifié avant l’annonce des candidats retenus.',
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M9 11l2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M12 22a10 10 0 100-20 10 10 0 000 20z" stroke="currentColor" strokeWidth="1.8"/></svg>,
  },
  {
    step: '04',
    title: 'Présélection et formation',
    desc: 'Leadership, communication, civisme, image et préparation des projets sociaux.',
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M7 7v12m10-12v12M9 11h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M9 15h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>,
  },
  {
    step: '05',
    title: 'Votes et communication',
    desc: 'Les candidats qualifiés lancent leur campagne digitale et mobilisent le public en ligne.',
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 12h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M12 4v16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.8"/></svg>,
  },
  {
    step: '06',
    title: 'Grande finale nationale',
    desc: 'Épreuves finales, résultats du jury et couronnement des lauréats.',
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>,
  },
];

const AnimatedHeroTitle = () => {
  const [phase, setPhase] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setPhase((value) => !value), 4200);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <motion.h1 className={`hero-title ${phase ? 'hero-title-phase-alt' : ''}`} aria-label="MISS & MISTER University Bénin">
      {HERO_TITLE_LINES.map((line, lineIndex) => (
        <motion.span
          key={line.text}
          className={`hero-title-line ${line.className}`}
          animate={{ y: phase ? (lineIndex === 0 ? -3 : 3) : 0, x: phase ? (lineIndex === 0 ? 2 : -2) : 0 }}
          transition={{ duration: 0.9, ease: 'easeInOut' }}
        >
          {Array.from(line.text).map((char, charIndex) => (
            <motion.span
              key={`${lineIndex}-${charIndex}-${char}`}
              className={`hero-title-char ${char === ' ' ? 'is-space' : ''}`}
              initial={{ opacity: 0, y: 18, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 0.45, delay: lineIndex * 0.16 + charIndex * 0.035, ease: 'easeOut' }}
            >
              {char === ' ' ? '\u00A0' : char}
            </motion.span>
          ))}
        </motion.span>
      ))}
    </motion.h1>
  );
};

const Home = () => {
  const [candidates, setCandidates] = useState([]);
  const [stats, setStats] = useState({
    totalCandidates: 0,
    totalVotes: 0,
    totalUsers: 0,
    totalUniversities: 0
  });
  const [countdown, setCountdown] = useState({
    days: 0, hours: 0, minutes: 0, seconds: 0, percentLeft: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('votes');
  const [searchQuery, setSearchQuery] = useState('');
  const hasLoadedRef = useRef(false);
  const {
    publicSettings = null,
    votingBlocked = false,
  } = useOutletContext() || {};

  const fetchAll = async () => {
    const isInitialLoad = !hasLoadedRef.current;

    try {
      if (isInitialLoad) {
        setLoading(true);
      }

      const [candidatesResponse, statsResponse] = await Promise.all([
        candidatesAPI.getAll(),
        candidatesAPI.getStats(),
      ]);
      setCandidates(candidatesResponse?.data || []);
      setStats(statsResponse || stats);
      setError(null);
      hasLoadedRef.current = true;
    } catch (error) {
      console.error('❌ Erreur lors du chargement des données:', error);
      if (isInitialLoad) {
        setError(error.message || 'Erreur lors du chargement des candidats');
      }
    } finally {
      if (isInitialLoad) {
        hasLoadedRef.current = true;
        setLoading(false);
      }
    }
  };

  useAutoRefresh(fetchAll);

  const retryFetchAll = async () => {
    hasLoadedRef.current = false;
    await fetchAll();
  };

  useEffect(() => {
    if (!publicSettings?.vote_end_at) {
      setCountdown(getCountdownState());
      return;
    }

    const serverRemaining = Number(publicSettings?.countdown_remaining_seconds);
    const serverTotal = Number(publicSettings?.countdown_total_seconds);
    const countdownPaused = Boolean(publicSettings?.countdown_paused);

    if (Number.isFinite(serverRemaining) && Number.isFinite(serverTotal)) {
      const initialRemaining = Math.max(0, serverRemaining * 1000);
      const total = Math.max(0, serverTotal * 1000);

      setCountdown(getCountdownState(initialRemaining, total));

      if (countdownPaused || initialRemaining <= 0) {
        return;
      }

      const startedAt = Date.now();
      const tick = () => {
        const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
        const remaining = Math.max(0, initialRemaining - (elapsedSeconds * 1000));
        setCountdown(getCountdownState(remaining, total));
      };

      const id = setInterval(tick, 1000);
      return () => clearInterval(id);
    }

    const start = publicSettings?.vote_start_at
      ? new Date(`${publicSettings.vote_start_at}T00:00:00`)
      : new Date();
    const end = new Date(`${publicSettings.vote_end_at}T23:59:59`);

    const compute = () => {
      const now = new Date();

      const total = Math.max(0, end - start);
      const remaining = Math.max(0, end - now);

      const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
      const hours = Math.floor((remaining / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((remaining / (1000 * 60)) % 60);
      const seconds = Math.floor((remaining / 1000) % 60);
      const percentLeft = total > 0 ? Math.max(0, Math.min(100, (remaining / total) * 100)) : 0;

      setCountdown({ days, hours, minutes, seconds, percentLeft: Math.round(percentLeft) });
    };

    compute();
    const id = setInterval(compute, 1000);
    return () => clearInterval(id);
  }, [
    publicSettings?.vote_end_at,
    publicSettings?.vote_start_at,
    publicSettings?.countdown_remaining_seconds,
    publicSettings?.countdown_total_seconds,
    publicSettings?.countdown_paused,
  ]);

  const hasCountdown = Boolean(publicSettings?.vote_end_at);
  const paddedHours = String(countdown.hours).padStart(2, '0');
  const paddedMinutes = String(countdown.minutes).padStart(2, '0');
  const paddedSeconds = String(countdown.seconds).padStart(2, '0');
  const countdownProgress = hasCountdown ? countdown.percentLeft : 100;
  const candidateList = Array.isArray(candidates) ? candidates : [];
  const buildCandidateName = (candidate) => `${candidate.first_name || ''} ${candidate.last_name || ''}`.trim();
  const filteredCandidates = candidateList
    .filter((candidate) => {
      const name = buildCandidateName(candidate).toLowerCase();
      const university = (candidate.university || '').toLowerCase();
      const category = candidate.category?.name?.toLowerCase() || '';
      const matchesFilter = filter === 'all' || category === filter;
      const needle = searchQuery.trim().toLowerCase();
      const matchesSearch = !needle || name.includes(needle) || university.includes(needle);
      return matchesFilter && matchesSearch;
    })
    .sort((a, b) => {
      if (sortBy === 'votes') {
        return (b.votes_count || 0) - (a.votes_count || 0);
      }
      return buildCandidateName(a).toLowerCase().localeCompare(buildCandidateName(b).toLowerCase());
    });
  const topCandidates = [...candidateList]
    .sort((a, b) => (b.votes_count || 0) - (a.votes_count || 0))
    .slice(0, 6);

  return (
  <div className="home-page">

    {/* ══════════════════════════════════════════ HERO */}
    <section className="hero-section">
      <picture className="hero-media" aria-hidden="true">
        <source media="(max-width: 600px)" srcSet={sessionMobile} />
        <img
          src={sessionHero}
          alt=""
          loading="eager"
          decoding="async"
          fetchPriority="high"
        />
      </picture>
      <div className="hero-bg" aria-hidden="true">
        <div className="hero-orb orb-1" />
        <div className="hero-orb orb-2" />
        <div className="hero-orb orb-3" />
        <div className="hero-grid-lines" />
      </div>

      <div className="container hero-content">
        <motion.div className="hero-text" {...fadeUp(0)}>
          

          <AnimatedHeroTitle />

          <p className="hero-subtitle">
            Concours universitaire national dédié à l’excellence académique,
            au leadership, à la culture, à l’éloquence et à l’engagement social
            de la jeunesse universitaire béninoise.
          </p>

          <div className="hero-actions">
            {votingBlocked ? (
              <button className="btn-hero-primary btn-hero-disabled" type="button" disabled>
                Vote bloqué
              </button>
            ) : (
              <Link to="/candidates">
                <motion.button className="btn-hero-primary" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="11" width="18" height="10" rx="2" stroke="currentColor" strokeWidth="2"/>
                    <path d="M9 11V7a3 3 0 016 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <circle cx="12" cy="16" r="1.5" fill="currentColor"/>
                  </svg>
                  Voter maintenant
                </motion.button>
              </Link>
            )}
            <Link to="/about">
              <motion.button className="btn-hero-secondary" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                En savoir plus
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </motion.button>
            </Link>
          </div>

          <div className="hero-badges">
            <div className="hero-badge">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/></svg>
              Concours national
            </div>
            <div className="hero-badge">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/><path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              Inscription gratuite
            </div>
            <div className="hero-badge">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M2 10h20" stroke="currentColor" strokeWidth="2"/></svg>
              Vote sécurisé
            </div>
            {/* {publicSettings?.vote_end_at && (
              <div className="hero-badge">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/><path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                {countdown.percentLeft}% du temps de vote restant
              </div>
            )} */}
          </div>
        </motion.div>

        <motion.div className="hero-visual" {...heroVisualMotion}>
          {loading ? (
            <div className="hero-card-main hero-countdown-card home-loading-card">
              <Loader
                size="small"
                color="secondary"
                text="MISS & MISTER UNIVERSITY BENIN 2026"
                subtext="Veuillez vous patientez ........"
              />
            </div>
          ) : (
            <div className="hero-card-main hero-countdown-card">
              <div className="hcm-top">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                    stroke="#D4AF37" strokeWidth="1.5" fill="rgba(212,175,55,0.12)"/>
                </svg>
                <span>MISS &amp; MISTER UNIVERSITY BENIN 2026</span>
              </div>
              <div className="hcm-avatar-row">
                {candidateList.slice(0, 3).map((c, i) => (
                  <div key={c.id} className="hcm-avatar" style={{ zIndex: 3 - i, marginLeft: i > 0 ? '-12px' : '0' }}>
                    {`${c.first_name} ${c.last_name}`.charAt(0)}
                  </div>
                ))}
                <span className="hcm-more">+{Math.max(0, stats.totalCandidates - 3)} candidats</span>
              </div>
              <div className="hcm-stats-row">
                <div className="hcm-stat">
                  <strong>{hasCountdown ? countdown.days : 0}</strong>
                  <span>Jours</span>
                </div>
                <div className="hcm-divider" />
                <div className="hcm-stat">
                  <strong>{hasCountdown ? paddedHours : '00'}</strong>
                  <span>Heures</span>
                </div>
                <div className="hcm-divider" />
                <div className="hcm-stat">
                  <strong>{hasCountdown ? `${paddedMinutes}:${paddedSeconds}` : '00:00'}</strong>
                  <span>Min : Sec</span>
                </div>
              </div>
              <div className="hcm-progress-wrap">
                <div className="hcm-progress-label">
                  <span>Temps restant pour le vote en %</span>
                  <span className="text-gold">{countdownProgress}%</span>
                </div>
                <div className="hcm-progress-bar">
                  <motion.div className="hcm-progress-fill"
                    initial={false}
                    animate={{ width: `${countdownProgress}%` }}
                    transition={{ duration: 0.85, ease: 'easeOut' }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Floating cards */}
          {/* <motion.div className="hero-float-card fc-top"
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}>
            <div className="fc-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="5" width="18" height="16" rx="3" stroke="currentColor" strokeWidth="1.8"/>
                <path d="M8 3v4M16 3v4M3 10h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="fc-copy">
              <span>Jours restants</span>
              <strong>{hasCountdown ? `${countdown.days} jours` : '--'}</strong>
            </div>
          </motion.div> */}

          {/* <motion.div className="hero-float-card fc-middle"
            animate={{ y: [0, 9, 0] }}
            transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut', delay: 0.25 }}>
            <div className="fc-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/>
                <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="fc-copy">
              <span>Heures</span>
              <strong>{hasCountdown ? `${paddedHours} h` : '--'}</strong>
            </div>
          </motion.div> */}

          {/* <motion.div className="hero-float-card fc-bottom"
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}>
            <div className="fc-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/>
                <path d="M12 8v4l2.5 2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="fc-copy">
              <span>Minutes / secondes</span>
              <strong>{hasCountdown ? `${paddedMinutes}m ${paddedSeconds}s` : '--'}</strong>
            </div>
          </motion.div> */}
        </motion.div>
      </div>


      {/* Scroll indicator */}
      <motion.div className="hero-scroll" animate={{ y: [0, 8, 0] }} transition={{ duration: 2, repeat: Infinity }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M12 5v14M5 12l7 7 7-7" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </motion.div>
    </section>

     {/* ══════════════════════════════════════════ STATS */}
    <section className="home-stats section">
      <div className="container">
        <div className="stats-grid">
          {[
            { value: stats.totalCandidates, suffix: '',  label: 'Candidats', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg> },
            { value: stats.totalVotes, suffix: '+', label: 'Votes enregistrés', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="3" y="11" width="18" height="10" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M9 11V7a3 3 0 016 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><circle cx="12" cy="16" r="1.5" fill="currentColor"/></svg> },
            { value: stats.totalUsers, suffix: '+', label: 'Votants inscrits', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg> },
            { value: stats.totalUniversities, suffix: '+', label: 'Universités', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><path d="M9 22V12h6v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> },
          ].map((stat, i) => (
            <motion.div key={i} className="stat-card"
              initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              whileHover={{ y: -6 }}>
              <div className="stat-icon">{stat.icon}</div>
              <div className="stat-value">
                <CountUp target={stat.value} suffix={stat.suffix} />
              </div>
              <p className="stat-label">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>

    {/* ══════════════════════════════════════════ CONCOURS EN BREF */}
    <section className="home-overview section">
      <div className="container">
        <motion.div
          className="section-header text-center"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <span className="section-eyebrow">Extrait du projet</span>
          <h2>Le concours <span className="text-gold">en quelques repères</span></h2>
          <div className="section-divider centered" />
          <p className="section-lead">
            MISS &amp; MISTER UNIVERSITY BENIN met en lumière les étudiants les plus
            méritants, au-delà de l’apparence physique, en valorisant leurs
            compétences intellectuelles, leur éloquence et leur capacité à porter
            des projets utiles à la société.
          </p>
        </motion.div>

        <div className="home-overview-grid">
          {HOME_OVERVIEW.map((card, i) => (
            <motion.article
              key={card.title}
              className="home-overview-card"
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              whileHover={{ y: -6 }}
            >
              <div className="home-overview-top">
                <span className="home-overview-badge">{card.badge}</span>
                <div className="home-overview-icon" aria-hidden="true">{card.icon}</div>
              </div>
              <h3>{card.title}</h3>
              <p>{card.description}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>


    <div className="home-candidates-showcase">
      <section className="home-candidates-intro section">
        <div className="container">
          <motion.div
            className="home-candidates-header text-center"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <span className="home-candidates-eyebrow">Vote en direct</span>
            <h2>Explorez les <span className="text-gold">candidats</span></h2>
            <p>
              Retrouvez rapidement vos favoris, filtrez par catégorie et parcourez les profils les plus soutenus du concours.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── FILTRES ── */}
      <section className="candidates-controls home-candidates-controls">
        <div className="container">
          <div className="home-candidates-panel">
            <motion.div className="controls-bar" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}>

              {/* Filtres catégories */}
              <div className="filter-tabs">
                {FILTERS.map(f => (
                  <button
                    key={f.key}
                    type="button"
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
              {filteredCandidates.length} candidat{filteredCandidates.length !== 1 ? 's' : ''} trouvé{filteredCandidates.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </section>

      {/* ── GRILLE ── */}
      <section className="candidates-grid-section section home-candidates-grid-section">
        <div className="container">
          {error ? (
            <div className="error-container">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="#ef4444" strokeWidth="1.5"/>
                <path d="M15 9l-6 6M9 9l6 6" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <h3>Erreur de chargement</h3>
              <p>{error}</p>
              <button className="btn-gold" onClick={retryFetchAll}>
                Réessayer
              </button>
            </div>
          ) : (
            <div>
              {filteredCandidates.length > 0 ? (
                <>
                  <div className="candidates-grid home-candidates-grid">
                    {filteredCandidates.map((candidate) => (
                      <CandidateCard key={candidate.id} candidate={candidate} votingBlocked={votingBlocked} />
                    ))}
                  </div>
                  <div className="home-candidates-cta">
                    <Link to="/candidates">
                      <motion.button className="btn-gold" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                        Voir tous les candidats
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </motion.button>
                    </Link>
                  </div>
                </>
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
    </div>

   
    {/* ══════════════════════════════════════════ TOP CANDIDATS */}
    <section className="home-top-candidates section">
      <div className="container">
        <motion.div className="section-header text-center"
          initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <span className="section-eyebrow">Classement en direct</span>
          <h2>Top <span className="text-gold">Candidats</span></h2>
          <div className="section-divider centered" />
        </motion.div>

        <div className="top-cand-grid">
          {topCandidates.map((c, i) => (
            <motion.div key={c.id} className={`top-cand-card ${i === 0 ? 'featured' : ''}`}
              initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: i * 0.12 }}
              whileHover={{ y: -8 }}>
              <div className="tc-rank">
                {i === 0
                  ? <svg width="20" height="20" viewBox="0 0 24 24" fill="#D4AF37"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                  : `#${i + 1}`}
              </div>
              <div className="tc-avatar">{`${c.first_name} ${c.last_name}`.charAt(0)}</div>
              <div className="tc-info">
                <h3>{`${c.first_name} ${c.last_name}`}</h3>
                <div className="tc-meta">
                  <span className={`tc-cat ${c.category?.name?.toLowerCase() || 'miss'}`}>{c.category?.name || 'Miss'}</span>
                  <span className="tc-univ">{c.university || 'Université'}</span>
                </div>
              </div>
              <div className="tc-votes">
                <strong>{(c.votes_count || 0).toLocaleString('fr-FR')}</strong>
                <span>votes</span>
              </div>
              {votingBlocked ? (
                <span className="tc-vote-btn tc-vote-btn-disabled">Vote bloqué</span>
              ) : (
                <Link to={`/candidates/${c.id}`} className="tc-vote-btn">Voter</Link>
              )}
            </motion.div>
          ))}
        </div>

        <div className="section-cta">
          <Link to="/candidates">
            <motion.button className="btn-gold" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              Voir tous les candidats
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </motion.button>
          </Link>
        </div>
      </div>
    </section>

    {/* ══════════════════════════════════════════ COMMENT VOTER */}
    <section className="home-how section">
      <div className="container">
        <motion.div className="section-header text-center"
          initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <span className="section-eyebrow">Simple et rapide</span>
          <h2>Le <span className="text-gold">parcours</span> du concours</h2>
          <div className="section-divider centered" />
        </motion.div>

        <div className="steps-grid">
          {PROGRAM_STEPS.map((s, i) => (
            <motion.div key={i} className="step-card"
              initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              whileHover={{ y: -6 }}>
              <div className="step-num">{s.step}</div>
              <div className="step-icon">{s.icon}</div>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
              {i < PROGRAM_STEPS.length - 1 && <div className="step-connector" />}
            </motion.div>
          ))}
        </div>
      </div>
    </section>

    {/* ══════════════════════════════════════════ MOBILE MONEY */}
    <section className="home-mm section">
      <div className="container">
        <motion.div className="mm-box"
          initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <div className="mm-left">
            <span className="section-eyebrow">Paiement sécurisé</span>
            <h2>Payez via <span className="text-gold">Mobile Money</span></h2>
            <p>Tous les opérateurs Mobile Money du Bénin sont acceptés. Vos transactions sont sécurisées et instantanées.</p>
            <div className="mm-operators">
              {[
                { name: 'MTN MoMo', color: '#FFD700', letter: 'M' },
                { name: 'Moov Money', color: '#0066CC', letter: 'Mo' },
                { name: 'Flooz', color: '#FF6B00', letter: 'F' },
              ].map((op, i) => (
                <div key={i} className="mm-op">
                  <div className="mm-op-icon" style={{ background: op.color + '22', border: `1.5px solid ${op.color}44`, color: op.color }}>{op.letter}</div>
                  <span>{op.name}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="mm-right">
            <div className="mm-phone-card">
              <div className="mm-phone-header">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="11" width="18" height="10" rx="2" stroke="#D4AF37" strokeWidth="1.8"/>
                  <path d="M9 11V7a3 3 0 016 0v4" stroke="#D4AF37" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
                Simulateur de vote
              </div>
              <div className="mm-phone-body">
                <div className="mm-sim-row"><span>Candidat</span><strong>Sophie AKAKPO</strong></div>
                <div className="mm-sim-row"><span>Nombre de votes</span><strong className="text-gold">10</strong></div>
                <div className="mm-sim-row"><span>Opérateur</span><strong>MTN MoMo</strong></div>
                <div className="mm-sim-row"><span>Numéro</span><strong>+229 97 ••• ••• </strong></div>
                <div className="mm-sim-divider" />
                <div className="mm-sim-row total"><span>Total</span><strong>1 000 FCFA</strong></div>
              </div>
              <div className="mm-phone-footer">
                <div className="mm-sim-btn">Confirmer le paiement</div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>

    {/* ══════════════════════════════════════════ CTA FINAL */}
    <section className="home-cta section">
      <div className="container">
        <motion.div className="cta-final"
          initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <div className="cta-final-orb" aria-hidden="true" />
          <span className="section-eyebrow">Ne manquez pas l'événement</span>
          <h2>Soutenez votre<br /><span className="text-gold">candidat favori</span></h2>
          <p>Le concours se termine bientôt. Chaque vote peut faire basculer le classement !</p>
          <div className="cta-final-actions">
            <Link to="/login">
              <motion.button className="btn-hero-primary" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                Connectez-vous
              </motion.button>
            </Link>
            <Link to="/candidates">
              <motion.button className="btn-hero-secondary" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                Voir les candidats
              </motion.button>
            </Link>
          </div>
        </motion.div>
      </div>
    </section>

  </div>
  );
};

export default Home;
