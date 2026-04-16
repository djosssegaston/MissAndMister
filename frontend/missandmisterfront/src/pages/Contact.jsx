import { useState } from 'react';
import { motion } from 'framer-motion';
import { contactAPI } from '../services/api';
import WhatsAppIcon from '../components/WhatsAppIcon';
import { useToast } from '../components/Toast';
import {
  PROJECT_EMAIL,
  PROJECT_PHONE_DISPLAY,
  PROJECT_PHONE_TEL,
  PROJECT_SOCIAL_LINKS,
  PROJECT_WHATSAPP_URL,
} from '../utils/siteContact';
import './Contact.css';

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay },
});

const CONTACT_INFO = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
        <path d="M22 6l-10 7L2 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    label: 'Email',
    value: PROJECT_EMAIL,
    href: `mailto:${PROJECT_EMAIL}`,
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
      </svg>
    ),
    label: 'Téléphone',
    value: PROJECT_PHONE_DISPLAY,
    href: PROJECT_PHONE_TEL,
  },
  {
    icon: <WhatsAppIcon width={20} height={20} />,
    label: 'WhatsApp',
    value: PROJECT_PHONE_DISPLAY,
    href: PROJECT_WHATSAPP_URL,
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
        <circle cx="12" cy="10" r="3" stroke="currentColor" strokeWidth="1.8"/>
      </svg>
    ),
    label: 'Adresse',
    value: 'Université du Bénin, Cotonou, Bénin',
    href: null,
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8"/>
        <path d="M12 8v4l3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
    label: 'Horaires',
    value: 'Lun – Ven : 8h – 17h',
    href: null,
  },
];

const SOCIAL_LINKS = [
  {
    label: 'Facebook',
    href: PROJECT_SOCIAL_LINKS.facebook,
    display: 'facebook.com/missmisteruniversitybenin',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/></svg>,
  },
  {
    label: 'TikTok',
    href: PROJECT_SOCIAL_LINKS.tiktok,
    display: '@mmub26',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M14 3c.38 2.28 1.92 4.04 4 4.6v3.02a7.14 7.14 0 01-4-1.25v5.26a5.63 5.63 0 11-5.63-5.63c.3 0 .6.03.88.08v3.15a2.57 2.57 0 00-.88-.15 2.55 2.55 0 102.55 2.55V3H14z" fill="currentColor"/></svg>,
  },
  {
    label: 'YouTube',
    href: PROJECT_SOCIAL_LINKS.youtube,
    display: '@missmisteruniversitybenin',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M22 12s0-3.26-.42-4.83a2.68 2.68 0 00-1.89-1.9C18.12 4.85 12 4.85 12 4.85s-6.12 0-7.69.42a2.68 2.68 0 00-1.89 1.9C2 8.74 2 12 2 12s0 3.26.42 4.83a2.68 2.68 0 001.89 1.9c1.57.42 7.69.42 7.69.42s6.12 0 7.69-.42a2.68 2.68 0 001.89-1.9C22 15.26 22 12 22 12z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M10 9.5v5l4.5-2.5L10 9.5z" fill="currentColor"/></svg>,
  },
  {
    label: 'Chaîne WhatsApp',
    href: PROJECT_SOCIAL_LINKS.whatsappChannel,
    display: 'whatsapp.com/channel/0029Vb7AocKIXnlmiZa7GO1y',
    icon: <WhatsAppIcon width={18} height={18} />,
  },
  {
    label: 'WhatsApp',
    href: PROJECT_SOCIAL_LINKS.whatsapp,
    display: 'wa.me/22955748787',
    icon: <WhatsAppIcon width={18} height={18} />,
  },
];

const Contact = () => {
  const { showToast } = useToast();
  const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' });
  const [errors, setErrors]     = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const validate = () => {
    const e = {};
    if (!formData.name.trim())    e.name    = 'Le nom est requis';
    if (!formData.email.trim())   e.email   = "L'email est requis";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) e.email = 'Email invalide';
    if (!formData.subject.trim()) e.subject = 'Le sujet est requis';
    if (!formData.message.trim()) e.message = 'Le message est requis';
    else if (formData.message.trim().length < 20) e.message = 'Le message doit contenir au moins 20 caractères';
    return e;
  };

  const handleChange = e => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    const v = validate();
    if (Object.keys(v).length > 0) { setErrors(v); return; }

    setIsLoading(true);
    try {
      await contactAPI.sendMessage(formData);
      showToast('Votre message a été envoyé avec succès !', 'success');
      setFormData({ name: '', email: '', subject: '', message: '' });
    } catch (error) {
      if (error?.isSessionExpired) {
        return;
      }
      showToast("Erreur lors de l'envoi. Veuillez réessayer.", 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="contact-page">

      {/* ── HERO ── */}
      <section className="contact-hero">
        <div className="contact-hero-bg" aria-hidden="true">
          <div className="contact-orb orb-1" />
          <div className="contact-orb orb-2" />
        </div>
        <div className="container">
          <motion.div className="contact-hero-content" {...fadeUp()}>
            <span className="page-eyebrow">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
              </svg>
              Support &amp; Contact
            </span>
            <h1>Contactez <span className="text-gold">-nous</span></h1>
            <p>Une question, une suggestion ou besoin d'aide ? Notre équipe vous répond dans les plus brefs délais.</p>
          </motion.div>
        </div>
      </section>

      {/* ── CONTENU ── */}
      <section className="contact-content section">
        <div className="container">
          <div className="contact-grid">

            {/* Info */}
            <motion.div className="contact-info" {...fadeUp(0.1)}>
              <h2>Nos coordonnées</h2>
              <div className="section-divider" style={{ marginBottom: '2rem' }} />

              <div className="info-list">
                {CONTACT_INFO.map((item, i) => (
                  <motion.div key={i} className="info-card" {...fadeUp(0.1 + i * 0.08)}>
                    <div className="info-icon">{item.icon}</div>
                    <div className="info-text">
                      <span className="info-label">{item.label}</span>
                      {item.href
                        ? <a href={item.href} className="info-value link">{item.value}</a>
                        : <span className="info-value">{item.value}</span>
                      }
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Réseaux sociaux */}
              <div className="social-block">
                <p className="social-label">Suivez-nous</p>
                <div className="social-links">
                  {SOCIAL_LINKS.map((s, i) => (
                    <a key={i} href={s.href} className="social-btn" aria-label={s.label} target="_blank" rel="noreferrer">{s.icon}</a>
                  ))}
                </div>
                {/* <div className="social-format-list">
                  {SOCIAL_LINKS.map((s, i) => (
                    <a key={i} href={s.href} className="social-format-link" target="_blank" rel="noreferrer">
                      <span className="social-format-icon">{s.icon}</span>
                      <span className="social-format-text">
                        <strong>{s.label}</strong>
                        <span>{s.display}</span>
                      </span>
                    </a>
                  ))}
                </div> */}
              </div>
            </motion.div>

            {/* Formulaire */}
            <motion.div className="contact-form-wrap" {...fadeUp(0.2)}>
              <div className="contact-form-card">
                <h2>Envoyer un message</h2>
                <div className="section-divider" style={{ marginBottom: '2rem' }} />

                <form onSubmit={handleSubmit} noValidate>
                  <div className="form-row">
                    <div className={`cf-group ${errors.name ? 'has-error' : ''}`}>
                      <label htmlFor="cf-name">Nom complet *</label>
                      <input id="cf-name" name="name" type="text" value={formData.name} onChange={handleChange} placeholder="Jean Dupont" disabled={isLoading} />
                      {errors.name && <span className="cf-error">{errors.name}</span>}
                    </div>
                    <div className={`cf-group ${errors.email ? 'has-error' : ''}`}>
                      <label htmlFor="cf-email">Email *</label>
                      <input id="cf-email" name="email" type="email" value={formData.email} onChange={handleChange} placeholder="votre@email.com" disabled={isLoading} />
                      {errors.email && <span className="cf-error">{errors.email}</span>}
                    </div>
                  </div>

                  <div className={`cf-group ${errors.subject ? 'has-error' : ''}`}>
                    <label htmlFor="cf-subject">Sujet *</label>
                    <select className="site-select" id="cf-subject" name="subject" value={formData.subject} onChange={handleChange} disabled={isLoading}>
                      <option value="">Choisissez un sujet...</option>
                      <option value="vote">Question sur le vote</option>
                      <option value="paiement">Problème de paiement</option>
                      <option value="compte">Mon compte</option>
                      <option value="candidature">Candidature</option>
                      <option value="autre">Autre</option>
                    </select>
                    {errors.subject && <span className="cf-error">{errors.subject}</span>}
                  </div>

                  <div className={`cf-group ${errors.message ? 'has-error' : ''}`}>
                    <label htmlFor="cf-message">Message *</label>
                    <textarea id="cf-message" name="message" value={formData.message} onChange={handleChange} placeholder="Décrivez votre demande..." rows={5} disabled={isLoading} />
                    <div className="char-count">{formData.message.length} caractères</div>
                    {errors.message && <span className="cf-error">{errors.message}</span>}
                  </div>

                  <motion.button
                    type="submit"
                    className="btn-gold submit-btn"
                    disabled={isLoading}
                    whileHover={!isLoading ? { scale: 1.03 } : {}}
                    whileTap={!isLoading ? { scale: 0.97 } : {}}
                  >
                    {isLoading ? (
                      <>
                        <motion.span className="btn-spinner" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} />
                        Envoi en cours...
                      </>
                    ) : (
                      <>
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                          <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        Envoyer le message
                      </>
                    )}
                  </motion.button>
                </form>
              </div>
            </motion.div>

          </div>
        </div>
      </section>
    </div>
  );
};

export default Contact;
