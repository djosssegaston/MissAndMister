import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Outlet, Navigate, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import Home from '../pages/Home';
import About from '../pages/About';
import Candidates from '../pages/Candidates';
import CandidateDetails from '../pages/CandidateDetails';
import Gallery from '../pages/Gallery';
import FAQ from '../pages/FAQ';
import Contact from '../pages/Contact';
import PaymentConfirmation from '../pages/PaymentConfirmation';
import Login from '../pages/Login';
import Register from '../pages/Register';
import CandidateDashboard from '../pages/CandidateDashboard';
import ChangePassword from '../pages/ChangePassword';

// Admin
import AdminLogin from '../pages/admin/AdminLogin';
import AdminDashboard from '../pages/admin/AdminDashboard';
import AdminCandidates from '../pages/admin/AdminCandidates';
import AdminGallery from '../pages/admin/AdminGallery';
import AdminPartners from '../pages/admin/AdminPartners';
import AdminUsers from '../pages/admin/AdminUsers';
import AdminVotes from '../pages/admin/AdminVotes';
import AdminSettings from '../pages/admin/AdminSettings';
import AdminLayout from '../components/AdminLayout';
import SessionExpiredModal from '../components/SessionExpiredModal';
import Loader from '../components/Loader';
import { settingsAPI } from '../services/api';
import { useAutoRefresh } from '../utils/liveUpdates';
import {
  computePublicVotingState,
  getMaintenanceSnapshot,
  hasAdminPreviewSession,
  readCachedPublicSettings,
  writeCachedPublicSettings,
} from '../utils/publicSettings';

const getCountdownState = (remainingMs = 0, totalMs = 0) => {
  const remaining = Math.max(0, Number.isFinite(remainingMs) ? remainingMs : 0);
  const total = Math.max(0, Number.isFinite(totalMs) ? totalMs : 0);

  return {
    days: Math.floor(remaining / (1000 * 60 * 60 * 24)),
    hours: Math.floor((remaining / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((remaining / (1000 * 60)) % 60),
    seconds: Math.floor((remaining / 1000) % 60),
    percentLeft: total > 0 ? Math.max(0, Math.min(100, Math.round((remaining / total) * 100))) : 0,
  };
};

const computeVotingState = (settings) => {
  return computePublicVotingState(settings);
};

const MaintenanceScreen = ({ publicSettings, onCountdownComplete }) => {
  const [countdown, setCountdown] = useState(() => {
    const { maintenanceRemainingMs } = getMaintenanceSnapshot(publicSettings || {}, Date.now());
    return getCountdownState(maintenanceRemainingMs, maintenanceRemainingMs);
  });
  const maintenanceEnd = publicSettings?.maintenance_end_at_iso
    ? new Date(publicSettings.maintenance_end_at_iso)
    : null;
  const hasSchedule = Boolean(maintenanceEnd && !Number.isNaN(maintenanceEnd.getTime()));
  const maintenanceEndsAt = hasSchedule ? maintenanceEnd.getTime() : null;

  useEffect(() => {
    if (!hasSchedule) {
      setCountdown(getCountdownState());
      return;
    }

    const initialRemaining = Math.max(0, (maintenanceEndsAt ?? 0) - Date.now());
    const total = initialRemaining;
    setCountdown(getCountdownState(initialRemaining, total));

    let intervalId = null;
    const startedAt = Date.now();
    const tick = () => {
      const elapsedMs = Date.now() - startedAt;
      const remaining = Math.max(0, initialRemaining - elapsedMs);
      setCountdown(getCountdownState(remaining, total));

      if (remaining <= 0) {
        clearInterval(intervalId);
        onCountdownComplete?.();
      }
    };

    intervalId = window.setInterval(tick, 1000);
    return () => clearInterval(intervalId);
  }, [hasSchedule, maintenanceEndsAt, onCountdownComplete]);

  const paddedHours = String(countdown.hours).padStart(2, '0');
  const paddedMinutes = String(countdown.minutes).padStart(2, '0');
  const paddedSeconds = String(countdown.seconds).padStart(2, '0');
  const maintenanceEndLabel = maintenanceEnd
    ? maintenanceEnd.toLocaleString('fr-FR', {
        dateStyle: 'full',
        timeStyle: 'short',
      })
    : null;

  return (
    <div className="maintenance-page">
      <div className="maintenance-box">
        <span className="maintenance-pill">Maintenance en cours</span>
        <h1>Plateforme temporairement indisponible</h1>
        <p>
          Les votes et l&apos;accès public sont momentanément suspendus.
          Le site redeviendra accessible automatiquement dès la fin de cette maintenance.
        </p>

        <div className="maintenance-countdown-shell">
          <div className="hero-card-main maintenance-countdown-card">
            <div className="hcm-top">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="#D4AF37" strokeWidth="1.5" fill="rgba(212,175,55,0.12)"/>
              </svg>
              <span>Temps restant avant la reprise</span>
            </div>

            <div className="hcm-stats-row">
              <div className="hcm-stat">
                <strong>{hasSchedule ? countdown.days : '--'}</strong>
                <span>Jours</span>
              </div>
              <div className="hcm-divider" />
              <div className="hcm-stat">
                <strong>{hasSchedule ? paddedHours : '--'}</strong>
                <span>Heures</span>
              </div>
              <div className="hcm-divider" />
              <div className="hcm-stat">
                <strong>{hasSchedule ? `${paddedMinutes}:${paddedSeconds}` : '--:--'}</strong>
                <span>Min : Sec</span>
              </div>
            </div>

            <div className="hcm-progress-wrap">
              <div className="hcm-progress-label">
                <span>Reouverture du site</span>
                <span className="text-gold">{hasSchedule ? `${countdown.percentLeft}%` : '--'}</span>
              </div>
              <div className="hcm-progress-bar">
                <div className="hcm-progress-fill" style={{ width: hasSchedule ? `${countdown.percentLeft}%` : '0%' }} />
              </div>
            </div>
          </div>
        </div>

        <p className="maintenance-meta">
          {maintenanceEndLabel
            ? `Reprise prévue le ${maintenanceEndLabel}.`
            : 'La date de reprise n’a pas encore été renseignée.'}
        </p>
      </div>
    </div>
  );
};

const ScrollToTop = () => {
  const location = useLocation();

  useLayoutEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }

    const root = document.documentElement;
    const previousBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    window.scrollTo(0, 0);
    root.style.scrollBehavior = previousBehavior;

    return undefined;
  }, [location.pathname, location.search, location.hash]);

  return null;
};

const PublicLayout = () => {
  const cachedSettings = readCachedPublicSettings();
  const [publicSettings, setPublicSettings] = useState(cachedSettings);
  const [settingsLoading, setSettingsLoading] = useState(!cachedSettings);

  const fetchPublicSettings = useCallback(async () => {
    try {
      const data = await settingsAPI.getPublic();
      const nextSettings = data || {};
      setPublicSettings(nextSettings);
      writeCachedPublicSettings(nextSettings);
    } catch (error) {
      console.error('Erreur chargement settings publics:', error);
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  useAutoRefresh(fetchPublicSettings);

  const votingState = useMemo(() => computeVotingState(publicSettings || {}), [publicSettings]);
  const adminPreviewEnabled = hasAdminPreviewSession();
  const maintenancePreviewActive = votingState.maintenanceMode && adminPreviewEnabled;
  const outletContext = useMemo(
    () => ({ publicSettings, settingsLoading, maintenancePreviewActive, ...votingState }),
    [publicSettings, settingsLoading, maintenancePreviewActive, votingState],
  );

  if (settingsLoading && !publicSettings) {
    return (
      <div className="maintenance-page">
        <div className="maintenance-box">
          <Loader
            size="small"
            color="secondary"
            text="Chargement de la plateforme"
            subtext="Préparation de l’expérience officielle..."
          />
        </div>
      </div>
    );
  }

  if (votingState.maintenanceMode && !adminPreviewEnabled) {
    return <MaintenanceScreen publicSettings={publicSettings} onCountdownComplete={fetchPublicSettings} />;
  }

  return (
    <div className="app-wrapper">
      <Navbar votingBlocked={votingState.votingBlocked} />
      {maintenancePreviewActive && (
        <div className="maintenance-preview-banner" role="status" aria-live="polite">
          <span className="maintenance-preview-pill">Aperçu administrateur</span>
          <p>Le mode maintenance est actif. Vous visualisez le site avec vos droits d’administration.</p>
        </div>
      )}
      <main className="main-content">
        <Outlet context={outletContext} />
      </main>
      <Footer />
    </div>
  );
};

const DashboardLayout = ({ children }) => (
  <div className="app-wrapper">
    <main className="main-content">
      {children}
    </main>
    <Footer />
  </div>
);

const WithAdminLayout = ({ children }) => (
  <AdminLayout>{children}</AdminLayout>
);

const getStoredSession = () => {
  const token = localStorage.getItem('authToken');
  try {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    return { token, user };
  } catch {
    return { token, user: null };
  }
};

const getStoredAdminSession = () => {
  const token = localStorage.getItem('adminAuthToken');
  try {
    const user = JSON.parse(localStorage.getItem('adminUser') || 'null');
    return { token, user };
  } catch {
    return { token, user: null };
  }
};

const GuestOnly = ({ children, admin = false }) => {
  const { token, user } = admin ? getStoredAdminSession() : getStoredSession();

  if (!token || !user) {
    return children;
  }

  if (admin) {
    return (user.role === 'admin' || user.role === 'superadmin')
      ? <Navigate to="/admin/dashboard" replace />
      : children;
  }

  if (user.role === 'admin' || user.role === 'superadmin') {
    return <Navigate to="/admin/dashboard" replace />;
  }

  if (user.must_change_password) {
    return <Navigate to="/change-password" replace />;
  }

  if (user.role === 'candidate') {
    return <Navigate to="/dashboard" replace />;
  }

  return <Navigate to="/" replace />;
};

const RequireAdmin = ({ children }) => {
  const { token, user } = getStoredAdminSession();
  if (!token || !user || (user.role !== 'admin' && user.role !== 'superadmin')) {
    return <Navigate to="/admin/login" replace />;
  }
  return children;
};

const RequireCandidate = ({ children }) => {
  const { token, user } = getStoredSession();
  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== 'candidate') {
    return <Navigate to="/" replace />;
  }

  if (user.must_change_password) {
    return <Navigate to="/change-password" replace />;
  }

  return children;
};

const RequirePasswordChange = ({ children }) => {
  const { token, user } = getStoredSession();
  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (!user.must_change_password) {
    return <Navigate to={user.role === 'candidate' ? '/dashboard' : '/'} replace />;
  }

  return children;
};

const AppRouter = () => (
  <Router>
    <ScrollToTop />
    <SessionExpiredModal />
    <Routes>

      {/* ── Pages publiques ── */}
      <Route element={<PublicLayout />}>
        <Route path="/"               element={<Home />} />
        <Route path="/about"          element={<About />} />
        <Route path="/candidates"     element={<Candidates />} />
        <Route path="/candidates/:identifier" element={<CandidateDetails />} />
        <Route path="/gallery"        element={<Gallery />} />
        <Route path="/faq"            element={<FAQ />} />
        <Route path="/contact"        element={<Contact />} />
        <Route path="/payment/confirmation" element={<PaymentConfirmation />} />
        <Route path="/login"          element={<GuestOnly><Login /></GuestOnly>} />
        <Route path="/register"       element={<GuestOnly><Register /></GuestOnly>} />
      </Route>

      {/* ── Dashboard candidat (pas de Navbar globale) ── */}
      <Route path="/change-password" element={<RequirePasswordChange><DashboardLayout><ChangePassword /></DashboardLayout></RequirePasswordChange>} />
      <Route path="/dashboard" element={<RequireCandidate><DashboardLayout><CandidateDashboard /></DashboardLayout></RequireCandidate>} />

      {/* ── Admin ── */}
      <Route path="/admin/login" element={<GuestOnly admin={true}><AdminLogin /></GuestOnly>} />

      {/* Redirection /admin → /admin/dashboard */}
      <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />

      <Route path="/admin/dashboard"  element={<RequireAdmin><WithAdminLayout><AdminDashboard /></WithAdminLayout></RequireAdmin>} />
      <Route path="/admin/candidates" element={<RequireAdmin><WithAdminLayout><AdminCandidates /></WithAdminLayout></RequireAdmin>} />
      <Route path="/admin/gallery"    element={<RequireAdmin><WithAdminLayout><AdminGallery /></WithAdminLayout></RequireAdmin>} />
      <Route path="/admin/partners"   element={<RequireAdmin><WithAdminLayout><AdminPartners /></WithAdminLayout></RequireAdmin>} />
      <Route path="/admin/users"      element={<RequireAdmin><WithAdminLayout><AdminUsers /></WithAdminLayout></RequireAdmin>} />
      <Route path="/admin/votes"      element={<RequireAdmin><WithAdminLayout><AdminVotes /></WithAdminLayout></RequireAdmin>} />
      <Route path="/admin/settings"   element={<RequireAdmin><WithAdminLayout><AdminSettings /></WithAdminLayout></RequireAdmin>} />

      {/* 404 */}
      <Route path="*" element={<Navigate to="/" replace />} />

    </Routes>
  </Router>
);

export default AppRouter;
