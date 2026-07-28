import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { FiCamera, FiCheckCircle, FiXCircle, FiRefreshCw, FiArrowLeft, FiAlertTriangle } from 'react-icons/fi';
import { scanAPI } from '../services/api';

const SCAN_ELEMENT_ID = 'qr-reader';
const SCAN_CONFIG = { fps: 15, qrbox: { width: 220, height: 220 }, aspectRatio: 1.0 };

const STATUS = {
  IDLE: 'idle',
  SCANNING: 'scanning',
  PROCESSING: 'processing',
  VALIDATED: 'validated',
  ALREADY_USED: 'already_used',
  INVALID: 'invalid',
  NOT_FOUND: 'not_found',
  ERROR: 'error',
};

export default function BilletterieScan() {
  const navigate = useNavigate();
  const [status, setStatus] = useState(STATUS.IDLE);
  const [ticketInfo, setTicketInfo] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [validatedAt, setValidatedAt] = useState(null);
  const scannerRef = useRef(null);
  const isScanningRef = useRef(false);
  const lastDecodedRef = useRef('');
  const processingRef = useRef(false);

  const stopScanner = useCallback(async () => {
    try {
      if (scannerRef.current && isScanningRef.current) {
        await scannerRef.current.stop();
        isScanningRef.current = false;
      }
    } catch {
      // Ignore
    }
  }, []);

  const startScanner = useCallback(async () => {
    try {
      setStatus(STATUS.SCANNING);
      setTicketInfo(null);
      setErrorMessage('');
      setValidatedAt(null);
      lastDecodedRef.current = '';
      processingRef.current = false;

      await stopScanner();

      const html5Qrcode = new Html5Qrcode(SCAN_ELEMENT_ID);
      scannerRef.current = html5Qrcode;

      await html5Qrcode.start(
        { facingMode: 'environment' },
        SCAN_CONFIG,
        async (decodedText) => {
          // Prevent duplicate scans
          if (decodedText === lastDecodedRef.current || processingRef.current) return;
          lastDecodedRef.current = decodedText;
          processingRef.current = true;

          await handleScan(decodedText);
        },
        () => {},
      );

      isScanningRef.current = true;
    } catch (err) {
      console.error('Scanner error:', err);
      setStatus(STATUS.ERROR);
      setErrorMessage("Impossible d'accéder à la caméra. Vérifiez les permissions.");
    }
  }, [stopScanner]);

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, [stopScanner]);

  const handleScan = useCallback(async (decodedText) => {
    await stopScanner();
    setStatus(STATUS.PROCESSING);

    let payload;
    try {
      payload = JSON.parse(decodedText);
    } catch {
      setStatus(STATUS.INVALID);
      setErrorMessage("Format QR code invalide. Ce n'est pas un billet valide.");
      processingRef.current = false;
      return;
    }

    const { code, token, sig } = payload;
    if (!code || !token || !sig) {
      setStatus(STATUS.INVALID);
      setErrorMessage('QR code incompatible. Ce billet est potentiellement falsifié.');
      processingRef.current = false;
      return;
    }

    try {
      // SINGLE API CALL — verify + confirm in one shot
      const result = await scanAPI.validate(code, token, sig);

      setTicketInfo(result.ticket || null);
      setValidatedAt(new Date());
      setStatus(STATUS.VALIDATED);
      processingRef.current = false;
    } catch (err) {
      const code_status = err.status || err.payload?.status;
      const message = err.message || 'Erreur lors de la vérification.';

      if (code_status === 403) {
        setStatus(STATUS.INVALID);
        setErrorMessage(message);
      } else if (code_status === 404) {
        setStatus(STATUS.NOT_FOUND);
        setErrorMessage(message);
      } else if (code_status === 409) {
        setStatus(STATUS.ALREADY_USED);
        setErrorMessage(message);
        setTicketInfo(err.payload?.ticket || null);
      } else if (code_status === 422) {
        setStatus(STATUS.INVALID);
        setErrorMessage(message);
      } else {
        setStatus(STATUS.ERROR);
        setErrorMessage(message);
      }
      processingRef.current = false;
    }
  }, [stopScanner]);

  const renderIcon = () => {
    switch (status) {
      case STATUS.VALIDATED:
        return <FiCheckCircle size={72} color="#22c55e" />;
      case STATUS.ALREADY_USED:
        return <FiAlertTriangle size={72} color="#f59e0b" />;
      case STATUS.INVALID:
      case STATUS.NOT_FOUND:
      case STATUS.ERROR:
        return <FiXCircle size={72} color="#ef4444" />;
      default:
        return null;
    }
  };

  return (
    <div style={s.container}>
      {/* Header */}
      <div style={s.header}>
        <button onClick={() => navigate('/admin/billetterie')} style={s.backBtn}>
          <FiArrowLeft size={20} />
        </button>
        <h1 style={s.title}>Scanner billet</h1>
        <div style={{ width: 40 }} />
      </div>

      {/* Camera / Result overlay */}
      <div style={s.scannerBox}>
        <div id={SCAN_ELEMENT_ID} style={s.scannerEl} />

        {/* Idle overlay */}
        {status === STATUS.IDLE && (
          <div style={s.overlay}>
            <FiCamera size={44} color="#D4AF37" />
            <p style={s.overlayText}>Appuyez pour activer la caméra</p>
          </div>
        )}

        {/* Processing */}
        {status === STATUS.PROCESSING && (
          <div style={s.overlay}>
            <div style={s.spinner} />
            <p style={s.overlayText}>Vérification...</p>
          </div>
        )}

        {/* Result overlay */}
        {(status === STATUS.VALIDATED || status === STATUS.INVALID || status === STATUS.NOT_FOUND || status === STATUS.ALREADY_USED || status === STATUS.ERROR) && (
          <div style={{ ...s.overlay, backgroundColor: 'rgba(0,0,0,0.92)' }}>
            {renderIcon()}
            <p style={{
              ...s.overlayText,
              color: status === STATUS.VALIDATED ? '#22c55e' : status === STATUS.ALREADY_USED ? '#f59e0b' : '#ef4444',
              fontSize: 15,
              fontWeight: 700,
              marginTop: 12,
            }}>
              {errorMessage || (status === STATUS.VALIDATED ? 'Billet validé !' : '')}
            </p>
            {ticketInfo && (
              <div style={s.quickInfo}>
                <span>{ticketInfo.holder_name}</span>
                <span style={{ color: '#D4AF37' }}>{ticketInfo.ticket_type}</span>
                <span style={{ color: '#888' }}>{ticketInfo.event_title}</span>
              </div>
            )}
            {validatedAt && (
              <p style={{ color: '#888', fontSize: 12, margin: '8px 0 0' }}>
                {validatedAt.toLocaleTimeString('fr-FR')}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Action */}
      <div style={s.actions}>
        {(status === STATUS.IDLE || status === STATUS.SCANNING) && (
          <button onClick={startScanner} style={s.primaryBtn}>
            <FiCamera size={18} /> {status === STATUS.IDLE ? 'Activer la caméra' : 'Caméra active'}
          </button>
        )}

        {status === STATUS.PROCESSING && (
          <div style={{ ...s.primaryBtn, opacity: 0.6, cursor: 'default' }}>
            <div style={{ ...s.spinner, width: 18, height: 18, borderWidth: 2 }} /> Validation en cours...
          </div>
        )}

        {(status === STATUS.VALIDATED || status === STATUS.INVALID || status === STATUS.NOT_FOUND || status === STATUS.ALREADY_USED || status === STATUS.ERROR) && (
          <button onClick={startScanner} style={s.primaryBtn}>
            <FiRefreshCw size={18} /> Scanner un autre billet
          </button>
        )}
      </div>

      <p style={s.hint}>
        {status === STATUS.VALIDATED
          ? 'Ce billet est maintenant enregistré comme utilisé.'
          : 'Scannez le QR code du billet pour valider l\'entrée.'}
      </p>
    </div>
  );
}

const s = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#0a0a0a',
    color: '#fff',
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '0 16px',
    userSelect: 'none',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 480,
    padding: '14px 0',
  },
  backBtn: {
    background: 'none',
    border: 'none',
    color: '#D4AF37',
    cursor: 'pointer',
    padding: 8,
    borderRadius: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    color: '#D4AF37',
    margin: 0,
  },
  scannerBox: {
    width: '100%',
    maxWidth: 360,
    aspectRatio: '1',
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#111',
    border: '2px solid #D4AF37',
  },
  scannerEl: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)',
    gap: 10,
    padding: 16,
  },
  overlayText: {
    color: '#ccc',
    fontSize: 14,
    margin: 0,
    textAlign: 'center',
  },
  quickInfo: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    fontSize: 14,
    color: '#fff',
    textAlign: 'center',
  },
  spinner: {
    width: 32,
    height: 32,
    border: '3px solid #333',
    borderTopColor: '#D4AF37',
    borderRadius: '50%',
    animation: 'spin 0.6s linear infinite',
  },
  actions: {
    width: '100%',
    maxWidth: 360,
    marginTop: 16,
  },
  primaryBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    padding: '14px 20px',
    backgroundColor: '#D4AF37',
    color: '#000',
    border: 'none',
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
  },
  hint: {
    color: '#555',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 24,
  },
};
