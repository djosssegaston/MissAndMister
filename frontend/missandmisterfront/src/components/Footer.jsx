import { Link } from 'react-router-dom';
import logo from '../assets/logo.jpeg';
import WhatsAppIcon from './WhatsAppIcon';
import { PROJECT_EMAIL, PROJECT_PHONE_DISPLAY, PROJECT_SOCIAL_LINKS } from '../utils/siteContact';
import './Footer.css';

const Footer = () => (
  <footer className="footer">
    <div className="footer-inner">

      <div className="footer-grid">
        {/* Brand */}
        <div className="footer-brand">
          <div className="footer-logo" translate="no">
            <div className="footer-logo-icon">
              <img src={logo} alt="Miss & Mister logo" className="footer-logo-image" />
            </div>
            <div>
              <p className="footer-logo-main">Miss &amp; Mister</p>
              <p className="footer-logo-sub">University Bénin</p>
            </div>
          </div>
          <p className="footer-desc">
            La plateforme officielle du concours Miss &amp; Mister University Bénin, première édition 2026.
          </p>
          <div className="footer-socials">
            {[
              { label: 'Facebook', href: PROJECT_SOCIAL_LINKS.facebook, icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/></svg> },
              { label: 'TikTok', href: PROJECT_SOCIAL_LINKS.tiktok, icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M14 3c.38 2.28 1.92 4.04 4 4.6v3.02a7.14 7.14 0 01-4-1.25v5.26a5.63 5.63 0 11-5.63-5.63c.3 0 .6.03.88.08v3.15a2.57 2.57 0 00-.88-.15 2.55 2.55 0 102.55 2.55V3H14z" fill="currentColor"/></svg> },
              { label: 'YouTube', href: PROJECT_SOCIAL_LINKS.youtube, icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M22 12s0-3.26-.42-4.83a2.68 2.68 0 00-1.89-1.9C18.12 4.85 12 4.85 12 4.85s-6.12 0-7.69.42a2.68 2.68 0 00-1.89 1.9C2 8.74 2 12 2 12s0 3.26.42 4.83a2.68 2.68 0 001.89 1.9c1.57.42 7.69.42 7.69.42s6.12 0 7.69-.42a2.68 2.68 0 001.89-1.9C22 15.26 22 12 22 12z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M10 9.5v5l4.5-2.5L10 9.5z" fill="currentColor"/></svg> },
              { label: 'Chaîne WhatsApp', href: PROJECT_SOCIAL_LINKS.whatsappChannel, icon: <WhatsAppIcon width={16} height={16} /> },
              { label: 'WhatsApp', href: PROJECT_SOCIAL_LINKS.whatsapp, icon: <WhatsAppIcon width={16} height={16} /> },
            ].map((s, i) => (
              <a key={i} href={s.href} className="footer-social-btn" aria-label={s.label} target="_blank" rel="noreferrer">{s.icon}</a>
            ))}
          </div>
        </div>

        {/* Navigation */}
        <div className="footer-col">
          <h4>Navigation</h4>
          <ul>
            {[
              { to: '/', label: 'Accueil' },
              { to: '/candidates', label: 'Candidats' },
              { to: '/gallery', label: 'Galerie' },
              { to: '/about', label: 'À propos' },
            ].map(l => <li key={l.to}><Link to={l.to}>{l.label}</Link></li>)}
          </ul>
        </div>

        {/* Support */}
        <div className="footer-col">
          <h4>Support</h4>
          <ul>
            {[
              { to: '/faq', label: 'FAQ' },
              { to: '/contact', label: 'Contact' },
              { to: '/terms', label: "Conditions d'utilisation" },
              { to: '/privacy', label: 'Confidentialité' },
            ].map(l => <li key={l.to}><Link to={l.to}>{l.label}</Link></li>)}
          </ul>
        </div>

        {/* Contact */}
        <div className="footer-col">
          <h4>Contact</h4>
          <div className="footer-contact-list">
            {[
              { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" strokeWidth="1.8"/><path d="M22 6l-10 7L2 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>, text: PROJECT_EMAIL },
              { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>, text: PROJECT_PHONE_DISPLAY },
              { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" stroke="currentColor" strokeWidth="1.8"/><circle cx="12" cy="10" r="3" stroke="currentColor" strokeWidth="1.8"/></svg>, text: 'Cotonou, Bénin' },
            ].map((c, i) => (
              <div key={i} className="footer-contact-item">
                <span className="footer-contact-icon">{c.icon}</span>
                <span>{c.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <p>© {new Date().getFullYear()} Miss &amp; Mister University Bénin. Tous droits réservés.</p>
        <p>
          Développé par{' '}
          <a
            href="https://androcrea.pythonanywhere.com/"
            target="_blank"
            rel="noreferrer"
            className="footer-signature-link"
          >
            AndroCréa
          </a>
        </p>
      </div>
    </div>
  </footer>
);

export default Footer;
