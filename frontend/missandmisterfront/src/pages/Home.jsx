import { useState, useEffect } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import PartnerShowcase from '../components/PartnerShowcase';
import Loader from '../components/Loader';
import WhatsAppIcon from '../components/WhatsAppIcon';
import sessionHero from '../assets/session_hero.png';
import sessionMobile from '../assets/session_mobil.png';
import sessionMobileAlt from '../assets/session_mobil1.png';
import initiatorVisual from '../assets/logo1.jpeg';
import { getCandidatePublicPath } from '../utils/candidatePublic';
import { PARTNER_WHATSAPP_URL, PROJECT_PHONE_DISPLAY } from '../utils/siteContact';
import { getVotingWindowSnapshot } from '../utils/publicSettings';
import './Home.css';

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 40 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay, ease: 'easeOut' },
});

const buildRevealProps = (index = 0, distance = 38) => {
  const variant = index % 3;
  const initial = variant === 0
    ? { opacity: 0, x: -distance, y: 26, scale: 0.94, filter: 'blur(10px)' }
    : variant === 1
      ? { opacity: 0, y: distance, scale: 0.94, filter: 'blur(10px)' }
      : { opacity: 0, x: distance, y: 26, scale: 0.94, filter: 'blur(10px)' };

  return {
    initial,
    whileInView: { opacity: 1, x: 0, y: 0, scale: 1, filter: 'blur(0px)' },
    viewport: { once: false, amount: 0.16 },
    transition: {
      duration: 0.78,
      delay: Math.min(index * 0.06, 0.24),
      ease: [0.22, 1, 0.36, 1],
    },
  };
};

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

const HERO_TITLE_LINES = [
  { text: 'MISS & MISTER', className: 'hero-title-line-primary' },
  { text: 'University Bénin 2026', className: 'hero-title-line-secondary' },
];
const OFFICIAL_MARKERS = [
  {
    value: '1ère',
    accent: 'édition',
    label: 'Édition inaugurale 2026',
    detail: 'Le concours ouvre officiellement son histoire avec une première édition nationale ambitieuse.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    value: '16-26',
    accent: 'ans',
    label: 'Public universitaire ciblé',
    detail: 'Étudiants régulièrement inscrits dans les universités publiques et privées du Bénin.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"/>
        <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.9"/>
        <path d="M17 11h5M19.5 8.5v5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    value: '100%',
    accent: 'gratuite',
    label: 'Inscription au concours',
    detail: 'La participation est ouverte et gratuite, avec validation administrative avant publication.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7H14.5a3.5 3.5 0 010 7H6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    value: 'Cadre',
    accent: 'officiel',
    label: 'Plateforme du concours',
    detail: 'Une vitrine institutionnelle pensée pour présenter le projet, ses talents, ses partenaires et sa vision.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M3 5h18v14H3z" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round"/>
        <path d="M8 9h8M8 13h8M8 17h5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"/>
      </svg>
    ),
  },
];

const HOME_OVERVIEW = [
  {
    title: 'Concours national universitaire',
    description: 'Un événement éducatif, culturel et citoyen qui rassemble les étudiants des universités publiques et privées autour de l’excellence, du leadership et de l’engagement.',
    badge: 'Édition inaugurale',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round"/>
        <path d="M9 22V12h6v10" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    title: 'Jeunesse universitaire',
    description: 'Destiné aux étudiants âgés de 16 à 26 ans, issus des universités publiques et privées du Bénin, désireux de se démarquer et d’impacter positivement la société.',
    badge: 'Public cible',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"/>
        <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.9"/>
      </svg>
    ),
  },
  {
    title: 'Former des leaders, révéler des talents',
    description: 'Le concours met en avant l’intelligence, l’éloquence, la discipline, la culture et l’engagement social à travers des profils complets, cohérents et inspirants.',
    badge: 'Valeurs fortes',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    title: 'Universités et partenaires',
    description: 'Une plateforme nationale de collaboration qui connecte étudiants, universités, entreprises et institutions pour accompagner la jeunesse dans son développement et son impact social.',
    badge: 'Réseau d\'opportunités',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M8.5 14.5l-1.2 1.2a3.5 3.5 0 01-4.95-4.95l3-3a3.5 3.5 0 014.95 0l1.1 1.1" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M15.5 9.5l1.2-1.2a3.5 3.5 0 014.95 4.95l-3 3a3.5 3.5 0 01-4.95 0l-1.1-1.1" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
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
    title: 'Sensibilisation & communication',
    desc: 'Campagne d’information dans les universités et sur les réseaux sociaux pour mobiliser un maximum de participants.',
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 4h16v16H4z" stroke="currentColor" strokeWidth="1.8"/><path d="M8 12h8M12 8v8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>,
  },
  {
    step: '03',
    title: 'Inscriptions des candidats',
    desc: 'Les étudiants intéressés soumettent leur candidature en ligne ou via les canaux officiels du concours.',
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M9 11l2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M12 22a10 10 0 100-20 10 10 0 000 20z" stroke="currentColor" strokeWidth="1.8"/></svg>,
  },
  {
    step: '04',
    title: 'Étude et sélection des dossiers',
    desc: 'Analyse rigoureuse des candidatures selon des critères d’éligibilité, de qualité du profil et de motivation.',
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M7 7v12m10-12v12M9 11h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M9 15h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>,
  },
  {
    step: '05',
    title: 'Publication des candidats retenus',
    desc: 'Annonce officielle des candidats sélectionnés pour la phase de pré-sélection.',
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 12h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M12 4v16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.8"/></svg>,
  },
  {
    step: '06',
    title: 'Présentation des candidats',
    desc: 'Publication progressive des visuels des candidats par université sur les plateformes digitales du concours.',
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>,
  },
  {
    step: '07',
    title: 'Vote de pré-sélection en ligne',
    desc: 'Mobilisation des candidats pour obtenir des votes du public, comptant dans l’évaluation globale.',
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>,
  },
  {
    step: '08',
    title: 'Épreuves de pré-sélection',
    desc: 'Épreuves de culture générale, prises de parole et présentation scénique pour mesurer l’aisance, la connaissance et la prestance des candidats.',
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 12h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M12 4v16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.8"/></svg>,
  },
  {
    step: '09',
    title: 'Évaluation globale',
    desc: 'Notation basée sur le vote en ligne (40 %), la culture générale (30 %) et la parade individuelle (30 %).',
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M7 7v12m10-12v12M9 11h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M9 15h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>,
  },
  {
    step: '10',
    title: 'Publication des résultats de pré-sélection',
    desc: 'Annonce officielle des candidats retenus pour la phase finale.',
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 4h16v16H4z" stroke="currentColor" strokeWidth="1.8"/><path d="M8 12h8M12 8v8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>,
  },
];

const INITIATOR_PILLARS = [
  'Créer un cadre crédible de valorisation, de motivation et d’expression pour les étudiants béninois.',
  'Faire dialoguer universités, entreprises, institutions et partenaires sociaux autour d’une vision commune.',
  'Installer un concours durable qui révèle des ambassadeurs universitaires utiles à la société.',
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
  const [countdown, setCountdown] = useState({
    days: 0, hours: 0, minutes: 0, seconds: 0, percentLeft: 0,
  });
  const [showIntro, setShowIntro] = useState(true);
  const {
    publicSettings = null,
    publicCandidates = [],
    publicStats = null,
    bootstrapLoading = false,
    votingBlocked = false,
  } = useOutletContext() || {};
  const resultsPublicEnabled = Boolean(publicSettings?.results_public);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      setShowIntro(false);
    }, 1800);

    return () => window.clearTimeout(timerId);
  }, []);

  useEffect(() => {
    if (!publicSettings?.vote_end_at) {
      setCountdown(getCountdownState());
      return;
    }

    const { remainingMs, totalMs } = getVotingWindowSnapshot(publicSettings || {});
    const countdownPaused = Boolean(publicSettings?.countdown_paused);

    if (Number.isFinite(remainingMs) && Number.isFinite(totalMs) && totalMs > 0) {
      const initialRemaining = Math.max(0, remainingMs);
      const total = Math.max(0, totalMs);

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

    const start = publicSettings?.vote_start_at_iso
      ? new Date(publicSettings.vote_start_at_iso)
      : publicSettings?.vote_start_at
        ? new Date(`${publicSettings.vote_start_at}T00:00:00`)
        : new Date();
    const end = publicSettings?.vote_end_at_effective_iso
      ? new Date(publicSettings.vote_end_at_effective_iso)
      : publicSettings?.vote_end_at_iso
        ? new Date(publicSettings.vote_end_at_iso)
        : new Date(`${publicSettings.vote_end_at}T23:59:59`);

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
  }, [publicSettings]);

  const hasCountdown = Boolean(publicSettings?.vote_end_at);
  const paddedHours = String(countdown.hours).padStart(2, '0');
  const paddedMinutes = String(countdown.minutes).padStart(2, '0');
  const paddedSeconds = String(countdown.seconds).padStart(2, '0');
  const countdownProgress = hasCountdown ? countdown.percentLeft : 100;
  const stats = publicStats || {
    totalCandidates: 0,
    totalVotes: 0,
    totalUsers: 0,
    totalUniversities: 0,
  };
  const candidateList = Array.isArray(publicCandidates) ? publicCandidates : [];
  const loading = bootstrapLoading && candidateList.length === 0 && !publicStats;
  const topCandidates = [...candidateList]
    .sort((a, b) => (b.votes_count || 0) - (a.votes_count || 0))
    .slice(0, 6);

  return (
  <div className="home-page">
    <AnimatePresence>
      {showIntro && (
        <motion.div
          className="home-intro-loader"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
        >
          <Loader
            size="medium"
            color="secondary"
            text="MISS & MISTER UNIVERSITY BENIN 2026"
            subtext="Veuillez patienter..."
            fullScreen
          />
        </motion.div>
      )}
    </AnimatePresence>

    {/* ══════════════════════════════════════════ HERO */}
    <section className="hero-section">
      <div className="hero-media" aria-hidden="true">
        <img
          src={sessionHero}
          alt=""
          className="hero-media-desktop"
          loading="eager"
          decoding="async"
          fetchPriority="high"
        />
        <div className="hero-media-mobile">
          <img
            src={sessionMobile}
            alt=""
            className="hero-media-mobile-image is-primary"
            loading="eager"
            decoding="async"
            fetchPriority="high"
          />
          <img
            src={sessionMobileAlt}
            alt=""
            className="hero-media-mobile-image is-secondary"
            loading="eager"
            decoding="async"
          />
        </div>
      </div>
      <div className="hero-bg" aria-hidden="true">
        <div className="hero-orb orb-1" />
        <div className="hero-orb orb-2" />
        <div className="hero-orb orb-3" />
        <div className="hero-grid-lines" />
      </div>

      <div className="container hero-content">
        <motion.div className="hero-text" {...fadeUp(0)}>
          

          <div translate="no" className="notranslate">
            <AnimatedHeroTitle />
          </div>

          <p className="hero-subtitle">
            Plateforme officielle du concours universitaire national, première édition 2026,
            conçue pour révéler l’excellence académique, le leadership, la culture,
            l’éloquence et l’engagement social de la jeunesse universitaire béninoise.
          </p>

          <div className="hero-actions">
            <motion.a
              className="btn-hero-primary"
              href={PARTNER_WHATSAPP_URL}
              target="_blank"
              rel="noreferrer"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
            >
              <WhatsAppIcon width={18} height={18} />
              Devenir partenaire
            </motion.a>
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
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/></svg>
              Édition inaugurale 2026
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
                subtext="Veuillez patienter..."
              />
            </div>
          ) : (
            <div className="hero-card-main hero-countdown-card">
              <div className="hcm-top">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                    stroke="#D4AF37" strokeWidth="1.5" fill="rgba(212,175,55,0.12)"/>
                </svg>
                <span>MISS & MISTER <br /> UNIVERSITY BENIN 2026</span>
              </div>
              <div className="hcm-avatar-row">
                {candidateList.slice(0, 3).map((c, i) => (
                  <div key={c.public_uid || c.slug || c.public_number || i} className="hcm-avatar" style={{ zIndex: 3 - i, marginLeft: i > 0 ? '-12px' : '0' }}>
                    {`${c.first_name} ${c.last_name}`.charAt(0)}
                  </div>
                ))}
                {candidateList.length > 3 && (
                  <span className="hcm-more">+{Math.max(0, candidateList.length - 3)} candidats</span>
                )}
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

  

    {/* ══════════════════════════════════════════ CONCOURS EN BREF */}
    <section className="home-overview section">
      <div className="container">
        <motion.div
          className="section-header text-center"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.2 }}
        >
        
          <h2>Le concours <span className="text-gold">en quelques repères</span></h2>
          <div className="section-divider centered" />
          <p className="section-lead">
            MISS &amp; MISTER UNIVERSITY BENIN met en lumière les étudiants les plus méritants, bien au-delà de l’apparence physique, en valorisant leur intelligence, leur leadership, leur éloquence et leur engagement social.
            Ce concours national offre une plateforme unique permettant aux jeunes universitaires de révéler leur potentiel, de développer leurs compétences et de porter des projets à impact au service de la société.

            À travers un processus structuré et équitable, il vise à former et promouvoir une nouvelle génération de leaders responsables, capables de représenter dignement leur université et de contribuer au développement du Bénin.
          </p>
        </motion.div>

        <div className="home-overview-grid">
          {HOME_OVERVIEW.map((card, i) => (
            <motion.article
              key={card.title}
              className="home-overview-card"
              {...buildRevealProps(i)}
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

    <section className="home-initiator section">
      <div className="container">
        <div className="initiator-grid">
          <motion.div
            className="initiator-copy"
            initial={{ opacity: 0, x: -42, y: 18 }}
            whileInView={{ opacity: 1, x: 0, y: 0 }}
            viewport={{ once: false, amount: 0.2 }}
            transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="section-eyebrow">Vision de l’initiateur</span>
            <h2>Une initiative pensée pour <span className="text-gold">faire rayonner la jeunesse universitaire</span></h2>
            <div className="section-divider" />
            <p>
              À l’origine de MISS &amp; MISTER UNIVERSITY BENIN, il y a une volonté claire :
              offrir au Bénin un cadre sérieux, inspirant et structuré où les étudiants peuvent
              être révélés pour leurs idées, leur leadership, leur culture et leur capacité
              à porter des actions utiles à la société.
            </p>
            <p>
              Au-delà d’un simple concours, cette initiative vise à bâtir une véritable plateforme nationale de valorisation du capital humain universitaire, capable de connecter les universités, les institutions, les entreprises, les médias et les partenaires autour d’un objectif commun : investir durablement dans les talents de la jeunesse béninoise.
            </p>

            <div className="initiator-points" aria-label="Axes portés par l’initiateur du projet">
              {INITIATOR_PILLARS.map((point) => (
                <div key={point} className="initiator-point">
                  <span className="initiator-point-icon" aria-hidden="true">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M5 12.5l4.2 4.2L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </span>
                  <span>{point}</span>
                </div>
              ))}
            </div>

           
          </motion.div>

          <motion.div
            className="initiator-visual"
            initial={{ opacity: 0, x: 42, y: 18 }}
            whileInView={{ opacity: 1, x: 0, y: 0 }}
            viewport={{ once: false, amount: 0.2 }}
            transition={{ duration: 0.72, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="initiator-visual-card">
              <div className="initiator-visual-orb" aria-hidden="true" />
              <img
                src={initiatorVisual}
                alt="Identité visuelle officielle du projet Miss & Mister University Bénin"
                className="initiator-image"
                loading="lazy"
                decoding="async"
              />
              <div className="initiator-visual-badge">
                <span className="initiator-badge-label">Initiateur</span>
                <strong>Delphin DOSSA EZOUN-AGNAN </strong>
              </div>
              <div className="initiator-quote-card">
                <p>
                  “Valoriser des étudiants capables de représenter dignement leurs universités
                  et d’inspirer leurs pairs.”
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>

       {/* ══════════════════════════════════════════ STATS */}
    <section className="home-stats section">
      <div className="container">
        <motion.div
          className="section-header text-center"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.2 }}
        >
          <span className="section-eyebrow">Repères officiels</span>
          <h2>Une plateforme qui présenter le <span className="text-gold"> Miss & Mister</span></h2>
          <div className="section-divider centered" />
          <p className="section-lead">
            MISS &amp; MISTER UNIVERSITY BENIN n’est pas uniquement un espace de vote :
            c’est la vitrine institutionnelle de la première édition d’un concours
            universitaire éducatif, culturel et citoyen.
          </p>
        </motion.div>

        <div className="stats-grid">
          {OFFICIAL_MARKERS.map((stat, i) => (
            <motion.div key={i} className="stat-card"
              {...buildRevealProps(i)}
              whileHover={{ y: -6 }}>
              <div className="stat-icon">{stat.icon}</div>
              <div className="stat-value stat-value-text">
                <span className="stat-value-part">{stat.value}</span>
                <span className="stat-value-part">{stat.accent}</span>
              </div>
              <p className="stat-label">{stat.label}</p>
              <p className="stat-detail">{stat.detail}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>

     <section className="home-discover section">
      <div className="container">
        <motion.div
          className="home-discover-card"
          initial={{ opacity: 0, y: 32, scale: 0.97 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: false, amount: 0.18 }}
          transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="home-discover-copy">
            <span className="section-eyebrow">Candidats retenus</span>
            <h2>Découvrir les candidats</h2>
            <p>
              Consultez les profils officiels, les universités représentées et les parcours
              des candidats qualifiés pour cette édition inaugurale.
            </p>
           
         
          </div>

          <Link to="/candidates" className="home-discover-action">
            <motion.button className="btn-gold" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              Découvrir les candidats
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </motion.button>
          </Link>
        </motion.div>
      </div>
    </section>

    

    

   

    {/* ══════════════════════════════════════════ TOP CANDIDATS */}
    {resultsPublicEnabled && (
      <section className="home-top-candidates section">
        <div className="container">
          <motion.div className="section-header text-center"
            initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: false, amount: 0.2 }}>
            <span className="section-eyebrow">Classement en direct</span>
            <h2>Top <span className="text-gold">Candidats</span></h2>
            <div className="section-divider centered" />
          </motion.div>

          <div className="top-cand-grid">
            {topCandidates.map((c, i) => (
              <motion.div key={c.public_uid || c.slug || c.public_number || i} className={`top-cand-card ${i === 0 ? 'featured' : ''}`}
                {...buildRevealProps(i)}
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
                  <Link to={getCandidatePublicPath(c)} className="tc-vote-btn">Voter</Link>
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
    )}

    {/* ══════════════════════════════════════════ COMMENT VOTER */}
    <section className="home-how section">
      <div className="container">
        <motion.div className="section-header text-center"
          initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: false, amount: 0.2 }}>
          <h2>Le <span className="text-gold">parcours</span> du concours <span className="text-gold">(phase de pré-sélection)</span></h2>
          <div className="section-divider centered" />
        </motion.div>

        <div className="steps-grid">
          {PROGRAM_STEPS.map((s, i) => (
            <motion.div key={i} className="step-card"
              {...buildRevealProps(i)}
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
          initial={{ opacity: 0, y: 30, scale: 0.98 }} whileInView={{ opacity: 1, y: 0, scale: 1 }} viewport={{ once: false, amount: 0.18 }} transition={{ duration: 0.72 }}>
          {/* <div className="mm-left">
            <span className="section-eyebrow">Paiement sécurisé</span>
            <h2>Payez via <span className="text-gold">Mobile Money</span></h2>
            <p>Tous les opérateurs Mobile Money du Bénin, du Togo, du Sénégal et de la Côte d&apos;Ivoire sont acceptés. Les transactions sont sécurisées, rapides et suivies en temps réel.</p>
            <div className="mm-operators">
              {[
                { name: 'MTN MoMo', color: '#FFD700', letter: 'M' },
                { name: 'Moov Money', color: '#0066CC', letter: 'Mo' },
                { name: 'Orange', color: '#FF6B00', letter: 'F' },
              ].map((op, i) => (
                <div key={i} className="mm-op">
                  <div className="mm-op-icon" style={{ background: op.color + '22', border: `1.5px solid ${op.color}44`, color: op.color }}>{op.letter}</div>
                  <span>{op.name}</span>
                </div>
              ))}
            </div>
          </div> */}
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

      <PartnerShowcase
  
      title="Nos partenaires"
      description="Découvrez les institutions, entreprises et médias qui accompagnent cette édition de MISS & MISTER University Bénin."
      contactTitle="Vous souhaitez devenir partenaire ?"
      contactDescription="Envoyez un message WhatsApp au comité organisateur pour proposer votre collaboration et faire apparaître votre logo dans le carrousel public."
      contactButtonLabel="Contacter l’équipe"
      contactButtonVariant="gold"
    />


    {/* ══════════════════════════════════════════ CTA FINAL */}
    <section className="home-cta section">
      <div className="container">
        <motion.div className="cta-final"
          initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: false, amount: 0.18 }}>
          <div className="cta-final-orb" aria-hidden="true" />
          <span className="section-eyebrow">Première édition 2026</span>
          <h2>Rejoignez<br /><span className="text-gold">l’aventure</span></h2>
          <p>La plateforme officielle du concours réunit étudiants, universités et partenaires autour de l’excellence, du leadership et de l’engagement social.</p>
          <div className="cta-final-actions">
            <Link to="/candidates">
              <motion.button className="btn-hero-primary" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                Découvrir les candidats
              </motion.button>
            </Link>
            <motion.a
              className="btn-hero-secondary"
              href={PARTNER_WHATSAPP_URL}
              target="_blank"
              rel="noreferrer"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
            >
              <WhatsAppIcon width={16} height={16} />
              Devenir partenaire
            </motion.a>
          </div>
        </motion.div>
      </div>
    </section>

  </div>
  );
};

export default Home;
