import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { authAPI } from '../services/api';
import logoSrc from '../assets/logo.jpeg';
import './Navbar.css';

const BASE_NAV_LINKS = [
  { to: '/',           label: 'Accueil' },
  { to: '/candidates', label: 'Candidats' },
  { to: '/gallery',    label: 'Galerie' },
  { to: '/about',      label: 'À propos' },
  { to: '/faq',        label: 'FAQ' },
  { to: '/contact',    label: 'Contact' },
];

const Navbar = ({ votingBlocked = false }) => {
  const location  = useLocation();
  const navigate  = useNavigate();
  const [scrolled,     setScrolled]     = useState(false);
  const [menuOpen,     setMenuOpen]     = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [logoutConfirm, setLogoutConfirm] = useState(false);

  const token = localStorage.getItem('authToken');
  const user  = (() => { try { return JSON.parse(localStorage.getItem('user')); } catch { return null; } })();
  const isAuthenticated = Boolean(token && user && user.role !== 'admin' && user.role !== 'superadmin');
  const navLinks = isAuthenticated
    ? BASE_NAV_LINKS
    : [...BASE_NAV_LINKS, { to: '/login', label: 'Se connecter' }, { to: '/register', label: "S'inscrire" }];

  // Candidat connecté = rôle 'candidate' stocké dans user
  const isCandidate = isAuthenticated && user.role === 'candidate';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => { setMenuOpen(false); setUserMenuOpen(false); }, [location]);

  const handleLogout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      navigate('/');
      setUserMenuOpen(false);
      setLogoutConfirm(false);
    }
  };

  const isActive = to => to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);

  return (
    <header className={`navbar ${scrolled ? 'scrolled' : ''}`}>
      <div className="navbar-inner">

        {/* ── Logo ── */}
        <Link to="/" className="navbar-logo" translate="no">
          <div className="logo-icon">
            <img src={logoSrc} alt="Miss & Mister logo" className="navbar-logo-image" height="150" width="150" />
          </div>
         
        </Link>

        {/* ── Nav desktop ── */}
        <nav className="navbar-links" aria-label="Navigation principale">
          {navLinks.map(link => (
            <Link key={link.to} to={link.to} className={`nav-link ${isActive(link.to) ? 'active' : ''}`}>
              {link.label}
              {isActive(link.to) && <motion.div className="nav-link-dot" layoutId="nav-dot" />}
            </Link>
          ))}
        </nav>

        {/* ── Actions droite ── */}
        <div className="navbar-actions">

          {/* Bouton Voter — toujours visible */}
          {votingBlocked ? (
            <button className="btn-nav-vote btn-nav-vote-blocked" type="button" disabled>
              Vote bloqué
            </button>
          ) : (
            <Link to="/candidates">
              <motion.button className="btn-nav-vote" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="11" width="18" height="10" rx="2" stroke="currentColor" strokeWidth="2"/>
                  <path d="M9 11V7a3 3 0 016 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <circle cx="12" cy="16" r="1.5" fill="currentColor"/>
                </svg>
                Voter
              </motion.button>
            </Link>
          )}

          {/* Menu candidat connecté */}
          {isAuthenticated && (
            <div className="user-menu-wrap">
              <button className="user-menu-btn" onClick={() => setUserMenuOpen(p => !p)} aria-expanded={userMenuOpen}>
                <div className="user-avatar">{user.name?.charAt(0) ?? 'C'}</div>
                <span className="user-name">{user.name?.split(' ')[0]}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className={`user-chevron ${userMenuOpen ? 'open' : ''}`}>
                  <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>

              <AnimatePresence>
                {userMenuOpen && (
                  <motion.div className="user-dropdown"
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    transition={{ duration: 0.18 }}>
                    <div className="user-dropdown-header">
                      <p className="ud-name">{user.name}</p>
                      <p className="ud-email">{user.email}</p>
                    </div>
                    <div className="user-dropdown-body">
                      {isCandidate && (
                        <Link to="/dashboard" className="ud-item">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                            <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.8"/>
                            <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.8"/>
                            <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.8"/>
                            <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.8"/>
                          </svg>
                          Mon espace candidat
                        </Link>
                      )}
                    </div>
                    <div className="user-dropdown-footer">
                      <button className="ud-logout" onClick={() => setLogoutConfirm(true)}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                          <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        Se déconnecter
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Burger mobile */}
          <button className="navbar-burger" onClick={() => setMenuOpen(p => !p)} aria-label="Menu" aria-expanded={menuOpen}>
            <span className={`burger-line ${menuOpen ? 'open' : ''}`} />
            <span className={`burger-line ${menuOpen ? 'open' : ''}`} />
            <span className={`burger-line ${menuOpen ? 'open' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Menu mobile ── */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div className="mobile-menu"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}>
            <nav className="mobile-nav">
              {navLinks.map((link, i) => (
                <motion.div key={link.to} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                  <Link to={link.to} className={`mobile-nav-link ${isActive(link.to) ? 'active' : ''}`}>
                    {link.label}
                  </Link>
                </motion.div>
              ))}

              <div className="mobile-nav-divider" />

              {/* Bouton voter mobile */}
              {votingBlocked ? (
                <button className="mobile-vote-btn mobile-vote-btn-blocked" type="button" disabled>
                  Vote bloqué
                </button>
              ) : (
                <Link to="/candidates" className="mobile-vote-btn">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="11" width="18" height="10" rx="2" stroke="currentColor" strokeWidth="2"/>
                    <path d="M9 11V7a3 3 0 016 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <circle cx="12" cy="16" r="1.5" fill="currentColor"/>
                  </svg>
                  Voter maintenant
                </Link>
              )}

              {isAuthenticated && (
                <>
                  {isCandidate && <Link to="/dashboard" className="mobile-nav-link">Mon espace candidat</Link>}
                  <button className="mobile-logout" onClick={() => setLogoutConfirm(true)}>Se déconnecter</button>
                </>
              )}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {logoutConfirm && (
          <motion.div className="confirm-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="confirm-modal" initial={{ scale: 0.92, y: 20, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.9, y: 20, opacity: 0 }}>
              <div className="confirm-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="1.8"/>
                  <path d="M12 9v4M12 17h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </div>
              <h3>Confirmer la déconnexion</h3>
              <p>Vous serez redirigé vers l’accueil.</p>
              <div className="confirm-actions">
                <button className="confirm-btn ghost" onClick={() => setLogoutConfirm(false)}>Annuler</button>
                <button className="confirm-btn danger" onClick={handleLogout}>Se déconnecter</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Navbar;
