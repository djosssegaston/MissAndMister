import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { authAPI } from '../services/api';
import logo from '../assets/logo.jpeg';
import './AdminLayout.css';

const MOBILE_BREAKPOINT = 900;

const NAV_ITEMS = [
  { to: '/admin/dashboard', label: 'Tableau de bord', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.8"/><rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.8"/><rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.8"/><rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.8"/></svg>, exact: true },
  { to: '/admin/candidates', label: 'Candidats', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.8"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg> },
  { to: '/admin/gallery', label: 'Galerie', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.8"/><circle cx="8.5" cy="9" r="1.5" fill="currentColor"/><path d="M21 16l-5.5-5.5L6 20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  { to: '/admin/partners', label: 'Partenaires', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M8.5 14.5l-1.2 1.2a3.5 3.5 0 01-4.95-4.95l3-3a3.5 3.5 0 014.95 0l1.1 1.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M15.5 9.5l1.2-1.2a3.5 3.5 0 014.95 4.95l-3 3a3.5 3.5 0 01-4.95 0l-1.1-1.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M9.8 12.2l4.4-.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg> },
  { to: '/admin/votes', label: 'Votes', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="11" width="18" height="10" rx="2" stroke="currentColor" strokeWidth="1.8"/><path d="M9 11V7a3 3 0 016 0v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><circle cx="12" cy="16" r="1.5" fill="currentColor"/></svg> },
  { to: '/admin/users', label: 'Utilisateurs', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg> },
  { to: '/admin/settings', label: 'Paramètres', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8"/><path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg> },
];

const getIsMobileViewport = () => {
  if (typeof window === 'undefined') return false;
  return window.innerWidth <= MOBILE_BREAKPOINT;
};

const AdminLayout = ({ children }) => {
  const location  = useLocation();
  const navigate  = useNavigate();
  const [isMobileViewport, setIsMobileViewport] = useState(getIsMobileViewport);
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
  const sidebarRef = useRef(null);
  const topbarBurgerRef = useRef(null);

  // Vérifier l'authentification au montage du composant
  useEffect(() => {
    const token = localStorage.getItem('adminAuthToken');
    const user = localStorage.getItem('adminUser');
    
    if (!token || !user) {
      navigate('/admin/login');
      return;
    }

    try {
      const userData = JSON.parse(user);
      const role = userData.role || (userData.roles && userData.roles[0]);
      if (!role || (role !== 'admin' && role !== 'superadmin')) {
        navigate('/admin/login');
        return;
      }
    } catch {
      // Token ou user invalide
      localStorage.removeItem('adminAuthToken');
      localStorage.removeItem('adminUser');
      navigate('/admin/login');
      return;
    }
  }, [navigate]);

  useEffect(() => {
    if (!logoutConfirmOpen) return undefined;

    const handleEscape = (event) => {
      if (event.key === 'Escape' && !logoutPending) {
        setLogoutConfirmOpen(false);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [logoutConfirmOpen, logoutPending]);

  useEffect(() => {
    const syncViewport = () => setIsMobileViewport(getIsMobileViewport());
    syncViewport();

    window.addEventListener('resize', syncViewport);
    return () => window.removeEventListener('resize', syncViewport);
  }, []);

  useEffect(() => {
    if (isMobileViewport) {
      setMobileSidebarOpen(false);
    }
  }, [isMobileViewport, location.pathname]);

  useEffect(() => {
    if (!isMobileViewport || !mobileSidebarOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileViewport, mobileSidebarOpen]);

  const isActive = item => item.exact
    ? location.pathname === item.to
    : location.pathname.startsWith(item.to);

  const sidebarExpanded = isMobileViewport ? mobileSidebarOpen : !desktopSidebarCollapsed;

  const closeMobileSidebar = () => {
    if (!isMobileViewport) {
      return;
    }

    const activeElement = typeof document !== 'undefined' ? document.activeElement : null;

    if (activeElement instanceof HTMLElement && sidebarRef.current?.contains(activeElement)) {
      if (topbarBurgerRef.current instanceof HTMLElement) {
        topbarBurgerRef.current.focus();
      } else {
        activeElement.blur();
      }
    }

    setMobileSidebarOpen(false);
  };

  const handleSidebarToggle = () => {
    if (isMobileViewport) {
      if (mobileSidebarOpen) {
        closeMobileSidebar();
      } else {
        setMobileSidebarOpen(true);
      }
      return;
    }

    setDesktopSidebarCollapsed((previousState) => !previousState);
  };

  const handleSidebarLinkClick = () => {
    if (isMobileViewport) {
      closeMobileSidebar();
    }
  };

  const handleLogoutRequest = () => {
    setLogoutConfirmOpen(true);
  };

  const handleLogoutConfirm = async () => {
    setLogoutPending(true);

    try {
      await authAPI.logout();
    } catch (error) {
      console.warn('Déconnexion API admin non aboutie, nettoyage local appliqué.', error);
    } finally {
      localStorage.removeItem('adminAuthToken');
      localStorage.removeItem('adminUser');
      setLogoutPending(false);
      setLogoutConfirmOpen(false);
      navigate('/admin/login');
    }
  };

  return (
    <div className="admin-layout">
      {/* ── SIDEBAR ── */}
      <aside
        id="admin-sidebar"
        ref={sidebarRef}
        className={`admin-sidebar ${sidebarExpanded ? 'open' : 'collapsed'} ${isMobileViewport ? 'mobile' : 'desktop'} ${mobileSidebarOpen ? 'mobile-open' : ''}`}
        inert={isMobileViewport && !mobileSidebarOpen ? '' : undefined}
      >
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <div className="sidebar-logo-icon">
              <img src={logo} alt="Miss & Mister logo" className="sidebar-logo-image" />
            </div>
            {sidebarExpanded && (
              <div className="sidebar-logo-text">
                <span className="slt-main">Admin</span>
                <span className="slt-sub">Miss &amp; Mister</span>
              </div>
            )}
          </div>
          <button
            className={`sidebar-toggle ${sidebarExpanded ? 'active' : ''}`}
            onClick={handleSidebarToggle}
            aria-label={sidebarExpanded ? 'Réduire le menu' : 'Ouvrir le menu'}
            aria-expanded={sidebarExpanded}
            aria-controls="admin-sidebar"
            type="button"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              {isMobileViewport && sidebarExpanded ? (
                <>
                  <path d="M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </>
              ) : (
                <path d={sidebarExpanded ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              )}
            </svg>
          </button>
        </div>

        <nav className="sidebar-nav">
          <p className="sidebar-nav-label">{sidebarExpanded ? 'Gestion' : ''}</p>
          {NAV_ITEMS.map(item => (
            <Link
              key={item.to}
              to={item.to}
              className={`sidebar-nav-item ${isActive(item) ? 'active' : ''}`}
              title={!sidebarExpanded && !isMobileViewport ? item.label : ''}
              onClick={handleSidebarLinkClick}
            >
              <span className="sni-icon">{item.icon}</span>
              {sidebarExpanded && <span className="sni-label">{item.label}</span>}
              {isActive(item) && sidebarExpanded && <motion.div className="sni-indicator" layoutId="sidebar-indicator" />}
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <Link
            to="/"
            className="sidebar-back-btn"
            title={!sidebarExpanded && !isMobileViewport ? 'Voir le site' : ''}
            onClick={handleSidebarLinkClick}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
            </svg>
            {sidebarExpanded && <span>Voir le site</span>}
          </Link>
          <button
            className="sidebar-logout-btn"
            onClick={handleLogoutRequest}
            title={!sidebarExpanded && !isMobileViewport ? 'Déconnexion' : ''}
            type="button"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {sidebarExpanded && <span>Déconnexion</span>}
          </button>
        </div>
      </aside>

      <AnimatePresence>
        {isMobileViewport && mobileSidebarOpen && (
          <motion.div
            className="admin-sidebar-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeMobileSidebar}
          />
        )}
      </AnimatePresence>

      {/* ── MAIN ── */}
      <div className={`admin-main ${!isMobileViewport && desktopSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        {/* Topbar */}
        <div className="admin-topbar">
          <div className="topbar-left">
            <button
              ref={topbarBurgerRef}
              className={`topbar-burger ${sidebarExpanded ? 'active' : ''}`}
              onClick={handleSidebarToggle}
              type="button"
              aria-label={sidebarExpanded ? 'Fermer le menu latéral' : 'Ouvrir le menu latéral'}
              aria-expanded={sidebarExpanded}
              aria-controls="admin-sidebar"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                {sidebarExpanded && isMobileViewport ? (
                  <>
                    <path d="M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path d="M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </>
                ) : (
                  <path d="M3 12h18M3 6h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                )}
              </svg>
            </button>
            <h2 className="topbar-title">
              {NAV_ITEMS.find(i => isActive(i))?.label ?? 'Administration'}
            </h2>
          </div>
          <div className="topbar-right">
            <div className="topbar-date">
              {new Date().toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
            </div>
            <div className="topbar-admin">
              <div className="topbar-avatar">A</div>
              <span>Administrateur</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <main className="admin-content">
          {children}
        </main>
      </div>

      <AnimatePresence>
        {logoutConfirmOpen && (
          <motion.div
            className="admin-confirm-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !logoutPending && setLogoutConfirmOpen(false)}
          >
            <motion.div
              className="admin-confirm-modal"
              initial={{ opacity: 0, y: 18, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.96 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="admin-logout-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="admin-confirm-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h3 id="admin-logout-title">Confirmer la déconnexion</h3>
              <p>
                Voulez-vous vraiment vous déconnecter de l&apos;espace administrateur ?
              </p>
              <div className="admin-confirm-actions">
                <button
                  type="button"
                  className="admin-confirm-cancel"
                  onClick={() => setLogoutConfirmOpen(false)}
                  disabled={logoutPending}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  className="admin-confirm-submit"
                  onClick={handleLogoutConfirm}
                  disabled={logoutPending}
                >
                  {logoutPending ? 'Déconnexion...' : 'Se déconnecter'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminLayout;
