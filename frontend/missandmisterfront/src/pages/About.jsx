import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import './About.css';

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.6, delay: i * 0.12, ease: 'easeOut' },
  }),
};

const values = [
  {
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
      </svg>
    ),
    title: 'Excellence',
    description: "Promouvoir l'excellence académique et personnelle de chaque étudiant participant au concours.",
  },
  {
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
      </svg>
    ),
    title: 'Élégance',
    description: 'Célébrer la beauté, le charme naturel et le raffinement de notre jeunesse universitaire.',
  },
  {
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8"/>
        <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
    title: 'Talent',
    description: 'Mettre en lumière les compétences multiples et les talents extraordinaires de notre jeunesse.',
  },
  {
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
        <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    title: 'Intégrité',
    description: 'Garantir un processus de vote transparent, sécurisé et équitable pour tous.',
  },
];

const timeline = [
  { year: '2020', event: 'Première édition du concours Miss & Mister University Bénin.' },
  { year: '2022', event: 'Expansion à 10+ universités représentées à travers le Bénin.' },
  { year: '2024', event: 'Plus de 5 000 votes enregistrés lors de la quatrième édition.' },
  { year: '2026', event: 'Digitalisation complète avec une plateforme de vote sécurisée.' },
];

const team = [
  { name: 'Université du Bénin', role: 'Commanditaire officiel', initials: 'UB' },
  { name: 'AndroCréa', role: 'Prestataire technique', initials: 'AC' },
  { name: 'Comité Organisateur', role: 'Direction du concours', initials: 'CO' },
];

const About = () => (
  <div className="about-page">

    {/* ── HERO ── */}
    <section className="about-hero">
      <div className="about-hero-bg" aria-hidden="true">
        <div className="about-orb orb-1" />
        <div className="about-orb orb-2" />
      </div>
      <div className="container">
        <motion.div className="about-hero-content" variants={fadeUp} initial="hidden" animate="visible">
          <span className="page-eyebrow">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
            Miss &amp; Mister University Bénin
          </span>
          <h1>À Propos du <span className="text-gold">Concours</span></h1>
          <center><p className="about-hero-subtitle">
            Une célébration de l'excellence, de l'élégance et du talent de la jeunesse universitaire béninoise depuis 2020.
          </p></center>
        
          <div className="about-hero-center ">
            {[
              { value: '7+', label: 'Éditions' },
              { value: '20+', label: 'Universités' },
              { value: '10K+', label: 'Votants' },
            ].map((s, i) => (
              <motion.div key={i} className="hero-stat-item" custom={i + 1} variants={fadeUp} initial="hidden" animate="visible">
                <strong>{s.value}</strong>
                <span>{s.label}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>

    {/* ── MISSION ── */}
    <section className="about-mission section">
      <div className="container">
        <div className="mission-grid">
          <motion.div className="mission-text" variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <span className="section-eyebrow">Notre Mission</span>
            <h2>Valoriser la jeunesse <span className="text-gold">universitaire béninoise</span></h2>
            <div className="section-divider" />
            <p>
              Le concours <strong>Miss &amp; Mister University Bénin</strong> a pour mission de
              célébrer et promouvoir l'excellence académique, l'élégance et le talent de la
              jeunesse universitaire béninoise via une plateforme moderne et sécurisée.
            </p>
            <p>
              Nous encourageons le développement personnel, l'engagement communautaire et
              la représentation positive de nos universités sur la scène nationale et internationale.
            </p>
            <Link to="/candidates">
              <motion.button className="btn-gold" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" style={{ marginRight: '8px' }}>
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2"/>
                </svg>
                Voir les candidats
              </motion.button>
            </Link>
          </motion.div>

          <motion.div className="mission-visual" variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={1}>
            <div className="card-stack">
              <div className="stack-card sc-3" />
              <div className="stack-card sc-2" />
              <div className="stack-card sc-1">
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                    stroke="#D4AF37" strokeWidth="1.5" fill="rgba(212,175,55,0.12)"/>
                </svg>
                <h3>Miss &amp; Mister<br />University Bénin</h3>
                <p>Édition 2026</p>
                <span className="card-badge">Officiel</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>

    {/* ── VALEURS ── */}
    <section className="about-values section">
      <div className="container">
        <motion.div className="section-header" variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
          <span className="section-eyebrow">Ce qui nous guide</span>
          <h2>Nos <span className="text-gold">Valeurs</span></h2>
          <div className="section-divider centered" />
        </motion.div>
        <div className="values-grid">
          {values.map((v, i) => (
            <motion.div
              key={i}
              className="value-card"
              custom={i}
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              whileHover={{ y: -8 }}
            >
              <div className="value-icon">{v.icon}</div>
              <h3>{v.title}</h3>
              <p>{v.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>

    {/* ── TIMELINE ── */}
    <section className="about-history section">
      <div className="container">
        <motion.div className="section-header" variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
          <span className="section-eyebrow">Notre parcours</span>
          <h2>Notre <span className="text-gold">Histoire</span></h2>
          <div className="section-divider centered" />
        </motion.div>
        <div className="timeline">
          <div className="timeline-line" />
          {timeline.map((item, i) => (
            <motion.div
              key={i}
              className={`timeline-item ${i % 2 === 0 ? 'tl-left' : 'tl-right'}`}
              custom={i}
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
            >
              <div className="timeline-dot" />
              <div className="timeline-content">
                <span className="timeline-year">{item.year}</span>
                <p>{item.event}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>

    {/* ── ÉQUIPE ── */}
    <section className="about-team section">
      <div className="container">
        <motion.div className="section-header" variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
          <span className="section-eyebrow">Les acteurs</span>
          <h2>Qui <span className="text-gold">sommes-nous ?</span></h2>
          <div className="section-divider centered" />
        </motion.div>
        <div className="team-grid">
          {team.map((member, i) => (
            <motion.div key={i} className="team-card" custom={i} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} whileHover={{ y: -6 }}>
              <div className="team-avatar">{member.initials}</div>
              <h3>{member.name}</h3>
              <p>{member.role}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>

    {/* ── CTA ── */}
    <section className="about-cta section">
      <div className="container">
        <motion.div className="cta-box" variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
          <span className="section-eyebrow">Prêt à participer ?</span>
          <h2>Rejoignez <span className="text-gold">l'Aventure</span></h2>
          <p>Soutenez vos candidats préférés et faites partie de l'histoire du concours 2026.</p>
          <div className="cta-actions">
            <Link to="/register">
              <motion.button className="btn-gold" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                Créer un compte
              </motion.button>
            </Link>
            <Link to="/candidates">
              <motion.button className="btn-outline" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                Voir les candidats
              </motion.button>
            </Link>
          </div>
        </motion.div>
      </div>
    </section>

  </div>
);

export default About;