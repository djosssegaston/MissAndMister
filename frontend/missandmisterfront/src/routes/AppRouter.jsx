import { useCallback, useEffect, useMemo, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Outlet, Navigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import Home from '../pages/Home';
import About from '../pages/About';
import Candidates from '../pages/Candidates';
import CandidateDetails from '../pages/CandidateDetails';
import Gallery from '../pages/Gallery';
import FAQ from '../pages/FAQ';
import Contact from '../pages/Contact';
import Login from '../pages/Login';
import Register from '../pages/Register';
import CandidateDashboard from '../pages/CandidateDashboard';
import ChangePassword from '../pages/ChangePassword';

// Admin
import AdminLogin from '../pages/admin/AdminLogin';
import AdminDashboard from '../pages/admin/AdminDashboard';
import AdminCandidates from '../pages/admin/AdminCandidates';
import AdminGallery from '../pages/admin/AdminGallery';
import AdminUsers from '../pages/admin/AdminUsers';
import AdminVotes from '../pages/admin/AdminVotes';
import AdminSettings from '../pages/admin/AdminSettings';
import AdminLayout from '../components/AdminLayout';
import SessionExpiredModal from '../components/SessionExpiredModal';
import { settingsAPI } from '../services/api';
import { useAutoRefresh } from '../utils/liveUpdates';

const parseDateBoundary = (value, endOfDay = false) => {
  if (!value || typeof value !== 'string') return null;
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = new Date(isDateOnly ? `${value}T${endOfDay ? '23:59:59' : '00:00:00'}` : value);
  return Number.isNaN(date.getTime()) ? null : date;
};

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
  const now = settings?.server_time ? new Date(settings.server_time) : new Date();
  const safeNow = Number.isNaN(now.getTime()) ? new Date() : now;

  if (typeof settings?.voting_blocked === 'boolean') {
    return {
      maintenanceMode: settings?.voting_block_reason === 'maintenance',
      votingBlocked: settings.voting_blocked,
      votingBlockReason: settings?.voting_block_reason || 'open',
      votingBlockMessage: settings?.voting_block_message || (settings.voting_blocked ? 'Vote bloquer' : 'Vote ouvert'),
    };
  }

  const maintenanceMode = Boolean(settings?.maintenance_mode);
  if (maintenanceMode) {
    return {
      maintenanceMode: true,
      votingBlocked: true,
      votingBlockReason: 'maintenance',
      votingBlockMessage: 'Plateforme en maintenance',
    };
  }

  const startAt = parseDateBoundary(settings?.vote_start_at, false);
  const endAt = parseDateBoundary(settings?.vote_end_at, true);
  const votingOpen = settings?.voting_open !== false;

  if (!votingOpen) {
    return {
      maintenanceMode: false,
      votingBlocked: true,
      votingBlockReason: 'toggle_off',
      votingBlockMessage: 'Vote bloquer',
    };
  }

  if (startAt && safeNow < startAt) {
    return {
      maintenanceMode: false,
      votingBlocked: true,
      votingBlockReason: 'not_started',
      votingBlockMessage: 'Les votes ne sont pas encore ouverts',
    };
  }

  if (endAt && safeNow > endAt) {
    return {
      maintenanceMode: false,
      votingBlocked: true,
      votingBlockReason: 'ended',
      votingBlockMessage: 'Vote bloquer',
    };
  }

  return {
    maintenanceMode: false,
    votingBlocked: false,
    votingBlockReason: 'open',
    votingBlockMessage: 'Vote ouvert',
  };
};

const MaintenanceScreen = ({ publicSettings, onCountdownComplete }) => {
  const serverRemaining = Number(publicSettings?.maintenance_remaining_seconds);
  const hasSchedule = Number.isFinite(serverRemaining) && serverRemaining > 0;
  const [countdown, setCountdown] = useState(() => getCountdownState(
    hasSchedule ? serverRemaining * 1000 : 0,
    hasSchedule ? serverRemaining * 1000 : 0,
  ));

  useEffect(() => {
    if (!hasSchedule) {
      setCountdown(getCountdownState());
      return;
    }

    const initialRemaining = Math.max(0, serverRemaining * 1000);
    const total = initialRemaining;
    setCountdown(getCountdownState(initialRemaining, total));

    let intervalId = null;
    const tick = () => {
      const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
      const remaining = Math.max(0, initialRemaining - (elapsedSeconds * 1000));
      setCountdown(getCountdownState(remaining, total));

      if (remaining <= 0) {
        clearInterval(intervalId);
        onCountdownComplete?.();
      }
    };

    const startedAt = Date.now();
    intervalId = window.setInterval(tick, 1000);
    return () => clearInterval(intervalId);
  }, [hasSchedule, onCountdownComplete, serverRemaining]);

  const paddedHours = String(countdown.hours).padStart(2, '0');
  const paddedMinutes = String(countdown.minutes).padStart(2, '0');
  const paddedSeconds = String(countdown.seconds).padStart(2, '0');
  const maintenanceEndLabel = publicSettings?.maintenance_end_at_iso
    ? new Date(publicSettings.maintenance_end_at_iso).toLocaleString('fr-FR', {
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
          Les votes et l&apos;accès public sont momentanement suspendus.
          Le site redeviendra accessible automatiquement des la fin de cette maintenance.
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
            ? `Reprise prevue le ${maintenanceEndLabel}.`
            : 'La date de reprise n’a pas encore ete renseignee.'}
        </p>
      </div>
    </div>
  );
};

const PublicLayout = () => {
  const [publicSettings, setPublicSettings] = useState(null);
  const [settingsLoading, setSettingsLoading] = useState(true);

  const fetchPublicSettings = useCallback(async () => {
    try {
      const data = await settingsAPI.getPublic();
      setPublicSettings(data || {});
    } catch (error) {
      console.error('Erreur chargement settings publics:', error);
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  useAutoRefresh(fetchPublicSettings);

  const votingState = useMemo(() => computeVotingState(publicSettings || {}), [publicSettings]);
  const outletContext = useMemo(
    () => ({ publicSettings, settingsLoading, ...votingState }),
    [publicSettings, settingsLoading, votingState],
  );

  if (votingState.maintenanceMode) {
    return <MaintenanceScreen publicSettings={publicSettings} onCountdownComplete={fetchPublicSettings} />;
  }

  return (
    <div className="app-wrapper">
      <Navbar votingBlocked={votingState.votingBlocked} />
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
    <SessionExpiredModal />
    <Routes>

      {/* ── Pages publiques ── */}
      <Route element={<PublicLayout />}>
        <Route path="/"               element={<Home />} />
        <Route path="/about"          element={<About />} />
        <Route path="/candidates"     element={<Candidates />} />
        <Route path="/candidates/:id" element={<CandidateDetails />} />
        <Route path="/gallery"        element={<Gallery />} />
        <Route path="/faq"            element={<FAQ />} />
        <Route path="/contact"        element={<Contact />} />
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
      <Route path="/admin/users"      element={<RequireAdmin><WithAdminLayout><AdminUsers /></WithAdminLayout></RequireAdmin>} />
      <Route path="/admin/votes"      element={<RequireAdmin><WithAdminLayout><AdminVotes /></WithAdminLayout></RequireAdmin>} />
      <Route path="/admin/settings"   element={<RequireAdmin><WithAdminLayout><AdminSettings /></WithAdminLayout></RequireAdmin>} />

      {/* 404 */}
      <Route path="*" element={<Navigate to="/" replace />} />

    </Routes>
  </Router>
);

export default AppRouter;
