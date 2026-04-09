import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Modal from './Modal';
import { SESSION_EXPIRED_EVENT, clearStoredSession, getSessionLoginPath } from '../services/api';

const defaultModalState = {
  isOpen: false,
  scope: 'user',
  loginPath: '/login',
  title: 'Session expirée',
  message: 'Votre session a expiré. Veuillez vous reconnecter pour continuer.',
};

const SessionExpiredModal = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [modalState, setModalState] = useState(defaultModalState);

  const fallbackScope = useMemo(
    () => (location.pathname.startsWith('/admin') ? 'admin' : 'user'),
    [location.pathname],
  );

  useEffect(() => {
    const handleSessionExpired = (event) => {
      const detail = event?.detail || {};
      const scope = detail.scope || fallbackScope;

      setModalState({
        isOpen: true,
        scope,
        loginPath: detail.loginPath || getSessionLoginPath(scope, location.pathname),
        title: detail.title || defaultModalState.title,
        message: detail.message || defaultModalState.message,
      });
    };

    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
  }, [fallbackScope, location.pathname]);

  const handleReconnect = () => {
    const scope = modalState.scope || fallbackScope;
    const loginPath = modalState.loginPath || getSessionLoginPath(scope, location.pathname);

    clearStoredSession(scope);
    setModalState((prev) => ({ ...prev, isOpen: false }));
    navigate(loginPath, { replace: true });
  };

  return (
    <Modal
      isOpen={modalState.isOpen}
      onClose={() => {}}
      title={modalState.title}
      size="small"
      showCloseButton={false}
      closeOnOverlayClick={false}
    >
      <div className="session-expired-modal">
        <div className="session-expired-icon" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 8v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M12 17h.01" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
          </svg>
        </div>
        <p className="session-expired-message">{modalState.message}</p>
        <button type="button" className="btn btn-warning session-expired-button" onClick={handleReconnect}>
          Reconnecter
        </button>
      </div>
    </Modal>
  );
};

export default SessionExpiredModal;
