import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { paymentAPI, billetterieAPI } from '../services/api';
import './BilletterieConfirmation.css';

const SYNCABLE_STATES = new Set(['processing', 'pending', 'opening', 'initiated', 'failed']);

const buildStateFromStatus = (paymentStatus, fallback = 'processing') => {
  if (paymentStatus === 'succeeded') return 'success';
  if (paymentStatus === 'failed') return 'failed';
  if (['initiated', 'processing', 'pending'].includes(paymentStatus)) return 'processing';
  return fallback;
};

const BilletterieConfirmation = () => {
  const [searchParams] = useSearchParams();
  const reference = (searchParams.get('reference') || '').trim();
  const orderId = (searchParams.get('orderId') || searchParams.get('order_id') || '').trim();
  const queryStatus = (searchParams.get('status') || 'processing').trim().toLowerCase();

  const [paymentState, setPaymentState] = useState(() => (
    queryStatus === 'success' ? 'success' : (queryStatus === 'failed' ? 'failed' : 'processing')
  ));
  const [message, setMessage] = useState('Nous vérifions la confirmation du paiement auprès du serveur sécurisé.');
  const [isSyncing, setIsSyncing] = useState(SYNCABLE_STATES.has(queryStatus) && reference !== '');
  const [orderData, setOrderData] = useState(null);
  const [emailResent, setEmailResent] = useState(false);
  const [emailResending, setEmailResending] = useState(false);

  const eventName = orderData?.event_name || 'l\'événement';
  const ticketCount = orderData?.ticket_count || 0;
  const ticketTypeNames = orderData?.ticket_type_names || [];

  const handleResendEmail = async () => {
    if (!reference || emailResending) return;
    setEmailResending(true);
    try {
      await billetterieAPI.resendEmail(reference);
      setEmailResent(true);
    } catch {
      // silent
    } finally {
      setEmailResending(false);
    }
  };

  const stateCopy = useMemo(() => {
    if (paymentState === 'success') {
      return {
        eyebrow: 'Paiement confirmé',
        title: 'Achat validé',
        subtitle: 'Le paiement a été confirmé. Vos billets sont prêts.',
        detail: '',
      };
    }
    if (paymentState === 'failed') {
      return {
        eyebrow: 'Paiement non confirmé',
        title: 'Le paiement a échoué',
        subtitle: 'La transaction n\'a pas abouti. Aucun billet n\'a été émis.',
        detail: 'Vous pouvez réessayer l\'achat depuis la page de l\'événement.',
      };
    }
    return {
      eyebrow: 'Confirmation en cours',
      title: 'Vérification du paiement',
      subtitle: 'Nous attendons la confirmation du paiement pour valider vos billets.',
      detail: 'Cette page se met à jour automatiquement. Gardez-la ouverte.',
    };
  }, [paymentState]);

  // Fetch order data immediately when status is already success (e.g. direct redirect from callback)
  useEffect(() => {
    if (!reference || queryStatus !== 'success') return;
    let cancelled = false;
    billetterieAPI.getOrderPublic(reference).then((orderResp) => {
      if (!cancelled) setOrderData(orderResp?.data || orderResp);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [reference, queryStatus]);

  useEffect(() => {
    if (!reference || !SYNCABLE_STATES.has(queryStatus)) return;
    let cancelled = false;
    let attempts = 0;
    let timerId = null;

    const stopPolling = () => {
      if (timerId) { window.clearTimeout(timerId); timerId = null; }
    };

    const scheduleNext = () => {
      timerId = window.setTimeout(() => void syncPayment(), 2500);
    };

    const syncPayment = async () => {
      if (cancelled) return;
      attempts += 1;
      setIsSyncing(true);

      try {
        const payload = await paymentAPI.syncPublic(reference);
        const paymentStatus = String(payload?.payment_status || '').toLowerCase();
        const nextState = buildStateFromStatus(paymentStatus, 'processing');

        if (cancelled) return;

        if (nextState === 'success') {
          setPaymentState('success');
          setMessage('Paiement confirmé. Génération de vos billets...');
          try {
            const orderResp = await billetterieAPI.getOrderPublic(reference);
            setOrderData(orderResp?.data || orderResp);
          } catch {
            // order fetch is best-effort
          }
          setIsSyncing(false);
          stopPolling();
          return;
        }

        if (nextState === 'failed') {
          setPaymentState('failed');
          setMessage('Le paiement n\'a pas pu être confirmé.');
          setIsSyncing(false);
          stopPolling();
          return;
        }

        setPaymentState('processing');
        setMessage('Le paiement est en cours de confirmation.');

        if (attempts < 12) {
          scheduleNext();
        } else {
          setIsSyncing(false);
          setMessage('La transaction est encore en attente. Actualisez la page dans quelques instants.');
        }
      } catch (err) {
        if (cancelled) return;
        if (attempts < 12) {
          setPaymentState('processing');
          setMessage('Nouvelle vérification automatique...');
          scheduleNext();
        } else {
          setIsSyncing(false);
          setPaymentState('processing');
          setMessage(err?.message || 'Impossible de vérifier la transaction.');
        }
      }
    };

    void syncPayment();
    return () => { cancelled = true; stopPolling(); };
  }, [queryStatus, reference]);

  return (
    <div className="billetterie-confirmation-page">
      <section className="billetterie-confirmation-hero">
        <div className="billetterie-confirmation-bg" aria-hidden="true">
          <div className="bil-confirmation-orb orb-1" />
          <div className="bil-confirmation-orb orb-2" />
          <div className="bil-confirmation-grid" />
        </div>

        <div className="container">
          <motion.div
            className={`billetterie-confirmation-shell is-${paymentState}`}
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
          >
            <span className="billetterie-confirmation-pill">{stateCopy.eyebrow}</span>

            <div className="billetterie-confirmation-top">
              <div className={`billetterie-confirmation-icon is-${paymentState}`} aria-hidden="true">
                {paymentState === 'success' ? (
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
                    <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : paymentState === 'failed' ? (
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
                    <path d="M15 9l-6 6M9 9l6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
                  </svg>
                ) : (
                  <div className="billetterie-confirmation-spinner" />
                )}
              </div>

              <div className="billetterie-confirmation-copy">
                <h1>{stateCopy.title}</h1>
                <p className="billetterie-confirmation-lead">{stateCopy.subtitle}</p>
                <div className={`billetterie-confirmation-alert is-${paymentState}`}>
                  <span className="billetterie-confirmation-alert-label">Notification</span>
                  <p className="billetterie-confirmation-message">{message}</p>
                </div>
                {stateCopy.detail ? <p className="billetterie-confirmation-detail">{stateCopy.detail}</p> : null}
              </div>
            </div>

            <div className="billetterie-confirmation-meta">
              <article className="billetterie-meta-card">
                <span>Événement</span>
                <strong>{eventName}</strong>
              </article>
              <article className="billetterie-meta-card">
                <span>Type de billet</span>
                <strong>{ticketTypeNames.length > 0 ? ticketTypeNames.join(', ') : 'Billet'}</strong>
              </article>
              <article className="billetterie-meta-card">
                <span>Nombre de billets</span>
                <strong>{ticketCount}</strong>
              </article>
            </div>

            {paymentState === 'success' && (
              <div className="billetterie-confirmation-note">
                {emailResent
                  ? 'Un nouvel email de confirmation vous a été envoyé. Vérifiez votre boîte de réception.'
                  : 'Vos billets (PDF) vous ont été envoyés par email. Vérifiez votre boîte de réception et vos spams.'}
              </div>
            )}

            <div className="billetterie-confirmation-actions">
              {paymentState === 'success' ? (
                <>
                  {!emailResent && (
                    <button
                      className="billetterie-action-primary"
                      onClick={handleResendEmail}
                      disabled={emailResending}
                    >
                      {emailResending ? 'Envoi...' : 'Renvoyer l\'email'}
                    </button>
                  )}
                  <Link to="/billetterie" className="billetterie-action-secondary">
                    Retour à la billetterie
                  </Link>
                </>
              ) : paymentState === 'failed' ? (
                <>
                  <Link to="/billetterie" className="billetterie-action-primary">
                    Retour à la billetterie
                  </Link>
                  <button
                    className="billetterie-action-secondary"
                    onClick={() => window.location.reload()}
                  >
                    Réessayer
                  </button>
                </>
              ) : (
                <button
                  className="billetterie-action-secondary"
                  onClick={() => window.location.reload()}
                >
                  Vérifier à nouveau
                </button>
              )}
            </div>

            {paymentState === 'processing' && isSyncing && (
              <div className="billetterie-confirmation-note">
                Confirmation automatique en cours...
              </div>
            )}
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default BilletterieConfirmation;
