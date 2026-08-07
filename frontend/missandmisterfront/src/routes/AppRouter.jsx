import { useEffect, useMemo, useState } from 'react';
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
import NotFound from '../pages/NotFound';
import Privacy from '../pages/Privacy';
import ProjetSocial from '../pages/ProjetSocial';
import PaymentConfirmation from '../pages/PaymentConfirmation';
import Terms from '../pages/Terms';
import Login from '../pages/Login';
import Register from '../pages/Register';
import JSerai from '../pages/JSerai';
import Billetterie from '../pages/Billetterie';
import BilletterieEvent from '../pages/BilletterieEvent';
import BilletterieConfirmation from '../pages/BilletterieConfirmation';
import BilletterieMyTickets from '../pages/BilletterieMyTickets';
import CandidateDashboard from '../pages/CandidateDashboard';
import ChangePassword from '../pages/ChangePassword';

// Admin
import AdminLogin from '../pages/admin/AdminLogin';
import AdminDashboard from '../pages/admin/AdminDashboard';
import AdminCandidates from '../pages/admin/AdminCandidates';
import AdminGallery from '../pages/admin/AdminGallery';
import AdminPartners from '../pages/admin/AdminPartners';
import AdminSocialProjects from '../pages/admin/AdminSocialProjects';
import AdminUsers from '../pages/admin/AdminUsers';
import AdminVotes from '../pages/admin/AdminVotes';
import AdminSettings from '../pages/admin/AdminSettings';
import AdminJSerai from '../pages/admin/AdminJSerai';
import AdminBilletterie from '../pages/admin/AdminBilletterie';
import BilletterieScan from '../pages/BilletterieScan';
import AdminLayout from '../components/AdminLayout';
import SessionExpiredModal from '../components/SessionExpiredModal';
import Loader from '../components/Loader';
import {
  computePublicVotingState,
  hasAdminPreviewSession,
} from '../utils/publicSettings';
import { usePublicBootstrapData } from '../hooks/usePublicBootstrapData';

const computeVotingState = (settings, nowMs) => {
  return computePublicVotingState(settings, nowMs);
};

const MaintenanceScreen = ({ publicSettings, onCountdownComplete }) => {
  const maintenanceEnd = publicSettings?.maintenance_end_at_iso
    ? new Date(publicSettings.maintenance_end_at_iso)
    : null;
  const hasSchedule = Boolean(maintenanceEnd && !Number.isNaN(maintenanceEnd.getTime()));
  const maintenanceEndsAt = hasSchedule ? maintenanceEnd.getTime() : null;

  useEffect(() => {
    if (!hasSchedule) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      if (Date.now() >= (maintenanceEndsAt ?? 0)) {
        window.clearInterval(intervalId);
        onCountdownComplete?.();
      }
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [hasSchedule, maintenanceEndsAt, onCountdownComplete]);

  return (
    <div className="maintenance-page">
      <div className="maintenance-box">
        <h1>Mode maintenance</h1>
      </div>
    </div>
  );
};

const ScrollToTop = () => {
  const location = useLocation();

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }

    const frameId = window.requestAnimationFrame(() => {
      window.scrollTo({
        top: 0,
        left: 0,
        behavior: 'smooth',
      });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [location.pathname, location.search]);

  return null;
};

const PublicLayout = () => {
  const {
    publicSettings,
    publicCandidates,
    publicStats,
    publicPartners,
    bootstrapLoading,
    bootstrapError,
    refreshPublicBootstrap,
  } = usePublicBootstrapData();
  const settingsLoading = bootstrapLoading && !publicSettings;

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const votingState = useMemo(
    () => computeVotingState(publicSettings || {}, Date.now()),
    [publicSettings, tick],
  );
  const adminPreviewEnabled = hasAdminPreviewSession();
  const maintenancePreviewActive = votingState.maintenanceMode && adminPreviewEnabled;

  const outletUser = useMemo(() => {
    try {
      const token = localStorage.getItem('authToken');
      const stored = JSON.parse(localStorage.getItem('user') || 'null');
      return token && stored ? stored : null;
    } catch {
      return null;
    }
  }, [tick]);

  const outletContext = useMemo(
    () => ({
      publicSettings,
      publicCandidates,
      publicStats,
      publicPartners,
      settingsLoading,
      bootstrapLoading,
      bootstrapError,
      maintenancePreviewActive,
      refreshPublicBootstrap,
      user: outletUser,
      ...votingState,
    }),
    [
      bootstrapError,
      bootstrapLoading,
      maintenancePreviewActive,
      outletUser,
      publicCandidates,
      publicPartners,
      publicSettings,
      publicStats,
      refreshPublicBootstrap,
      settingsLoading,
      votingState,
    ],
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
    return <MaintenanceScreen publicSettings={publicSettings} onCountdownComplete={refreshPublicBootstrap} />;
  }

  return (
    <div className="app-wrapper">
      <Navbar votingBlocked={votingState.votingBlocked} />
      {maintenancePreviewActive && (
        <div className="maintenance-preview-banner" role="status" aria-live="polite">
          <span className="maintenance-preview-pill">Aperçu superadmin</span>
          <p>Le mode maintenance est actif. Vous visualisez le site avec les droits complets du superadmin.</p>
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
        <Route path="/terms"          element={<Terms />} />
        <Route path="/privacy"        element={<Privacy />} />
        <Route path="/projet-social"  element={<ProjetSocial />} />
        <Route path="/j-y-serai"      element={<JSerai />} />
        <Route path="/billetterie"    element={<Billetterie />} />
        <Route path="/billetterie/:eventId" element={<BilletterieEvent />} />
        <Route path="/billetterie/confirmation" element={<BilletterieConfirmation />} />
        <Route path="/billetterie/mes-billets" element={<BilletterieMyTickets />} />
        <Route path="/payment/confirmation" element={<PaymentConfirmation />} />
        <Route path="/login"          element={<GuestOnly><Login /></GuestOnly>} />
        <Route path="/register"       element={<GuestOnly><Register /></GuestOnly>} />
        <Route path="*"               element={<NotFound />} />
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
      <Route path="/admin/social-projects" element={<RequireAdmin><WithAdminLayout><AdminSocialProjects /></WithAdminLayout></RequireAdmin>} />
      <Route path="/admin/settings"   element={<RequireAdmin><WithAdminLayout><AdminSettings /></WithAdminLayout></RequireAdmin>} />
      <Route path="/admin/j-serai"   element={<RequireAdmin><WithAdminLayout><AdminJSerai /></WithAdminLayout></RequireAdmin>} />
      <Route path="/admin/billetterie" element={<RequireAdmin><WithAdminLayout><AdminBilletterie /></WithAdminLayout></RequireAdmin>} />
      <Route path="/admin/billetterie/scan" element={<RequireAdmin><BilletterieScan /></RequireAdmin>} />

    </Routes>
  </Router>
);

export default AppRouter;
