import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { paymentAPI, billetterieAPI } from '../services/api';
import './BilletterieConfirmation.css';

const WHATSAPP_PHONE = '22955748787';

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

  const eventName = orderData?.event_name || orderData?.event?.title || 'l\'événement';
  const ticketCount = orderData?.ticket_count || 0;

  const whatsappLink = useMemo(() => {
    const text = `Bonjour, je suis un acheteur de billet pour l'événement ${eventName}. Ma référence: ${reference}`;
    return `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(text)}`;
  }, [eventName, reference]);

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
        detail: 'Vous pouvez retrouver vos billets dans votre espace personnel à tout moment.',
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
                <p className="billetterie-confirmation-detail">{stateCopy.detail}</p>
              </div>
            </div>

            <div className="billetterie-confirmation-meta">
              <article className="billetterie-meta-card">
                <span>Référence</span>
                <strong>{reference || 'En attente'}</strong>
              </article>
              <article className="billetterie-meta-card">
                <span>Événement</span>
                <strong>{eventName}</strong>
              </article>
              <article className="billetterie-meta-card">
                <span>Billets</span>
                <strong>{ticketCount}</strong>
              </article>
              <article className="billetterie-meta-card">
                <span>Commande</span>
                <strong>{orderId || orderData?.id || '—'}</strong>
              </article>
            </div>

            {paymentState === 'success' && (
              <div className="billetterie-confirmation-note">
                {emailResent
                  ? 'Un nouvel email de confirmation vous a été envoyé. Vérifiez votre boîte de réception.'
                  : 'Vos billets sont disponibles dans votre espace "Mes billets".'}
              </div>
            )}

            <div className="billetterie-confirmation-actions">
              {paymentState === 'success' ? (
                <>
                  <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="billetterie-action-whatsapp">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                    Partager sur WhatsApp
                  </a>
                  <Link to="/billetterie/mes-billets" className="billetterie-action-primary">
                    Mes billets
                  </Link>
                  {!emailResent && (
                    <button
                      className="billetterie-action-secondary"
                      onClick={handleResendEmail}
                      disabled={emailResending}
                    >
                      {emailResending ? 'Envoi...' : 'Renvoyer l\'email'}
                    </button>
                  )}
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
