import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { paymentAPI } from '../services/api';
import { getCandidatePublicPath } from '../utils/candidatePublic';
import './PaymentConfirmation.css';

const SYNCABLE_STATES = new Set(['success', 'processing', 'pending', 'opening', 'initiated', 'failed']);

const parseAmount = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
};

const parseQuantity = (value) => {
  const quantity = Number(value);
  return Number.isFinite(quantity) && quantity > 0 ? Math.round(quantity) : 1;
};

const buildStateFromStatuses = (paymentStatus, voteStatus, fallback = 'processing') => {
  if (paymentStatus === 'succeeded' && voteStatus === 'confirmed') {
    return 'success';
  }

  if (paymentStatus === 'failed' || voteStatus === 'failed') {
    return 'failed';
  }

  if (['initiated', 'processing', 'pending', 'succeeded'].includes(paymentStatus) || voteStatus === 'pending') {
    return 'processing';
  }

  return fallback;
};

const PaymentConfirmation = () => {
  const [searchParams] = useSearchParams();
  const reference = (searchParams.get('reference') || '').trim();
  const queryStatus = (searchParams.get('status') || 'processing').trim().toLowerCase();
  const [paymentDetails, setPaymentDetails] = useState({
    candidateName: 'ce candidat',
    candidateSlug: (searchParams.get('candidate') || '').trim(),
    amount: 0,
    quantity: 1,
    currency: 'XOF',
  });

  const [paymentState, setPaymentState] = useState(() => (
    queryStatus === 'success' ? 'success' : (queryStatus === 'failed' ? 'failed' : 'processing')
  ));
  const [message, setMessage] = useState('Nous vérifions la confirmation du paiement auprès du serveur sécurisé.');
  const [isSyncing, setIsSyncing] = useState(SYNCABLE_STATES.has(queryStatus) && reference !== '');
  const candidateName = paymentDetails.candidateName;
  const amount = paymentDetails.amount;
  const quantity = paymentDetails.quantity;
  const currency = paymentDetails.currency;
  const candidateLink = paymentDetails.candidateSlug
    ? getCandidatePublicPath({ slug: paymentDetails.candidateSlug })
    : '/candidates';

  const stateCopy = useMemo(() => {
    if (paymentState === 'success') {
      return {
        eyebrow: 'Paiement confirmé',
        title: 'Votre vote a bien été validé',
        subtitle: `Félicitations et merci pour votre soutien. Votre paiement a été confirmé et votre vote pour ${candidateName} est désormais bien pris en compte.`,
        detail: 'Vous pouvez revenir soutenir encore davantage ce candidat pour augmenter ses chances de victoire.',
      };
    }

    if (paymentState === 'failed') {
      return {
        eyebrow: 'Paiement non finalisé',
        title: 'Le vote n’a pas été comptabilisé',
        subtitle: 'Le paiement a été interrompu, annulé ou refusé. Aucun vote n’a été validé sur la plateforme.',
        detail: 'Vous pouvez relancer un paiement sécurisé quand vous êtes prêt.',
      };
    }

    return {
      eyebrow: 'Confirmation en cours',
      title: 'Vérification du paiement sécurisé',
      subtitle: 'FedaPay a pris en charge le règlement. Nous attendons maintenant la confirmation finale côté serveur avant de valider le vote.',
      detail: 'Cette page se met à jour automatiquement. Gardez-la ouverte quelques instants.',
    };
  }, [candidateName, paymentState]);

  useEffect(() => {
    if (!reference || !SYNCABLE_STATES.has(queryStatus)) {
      return undefined;
    }

    let cancelled = false;
    let attempts = 0;
    let timerId = null;

    const stopPolling = () => {
      if (timerId) {
        window.clearTimeout(timerId);
        timerId = null;
      }
    };

    const scheduleNext = () => {
      timerId = window.setTimeout(() => {
        void syncPayment();
      }, 2500);
    };

    const syncPayment = async () => {
      if (cancelled) {
        return;
      }

      attempts += 1;
      setIsSyncing(true);

      try {
        const payload = await paymentAPI.syncPublic(reference);
        const paymentStatus = String(payload?.payment_status || '').toLowerCase();
        const voteStatus = String(payload?.vote_status || '').toLowerCase();
        const nextState = buildStateFromStatuses(paymentStatus, voteStatus, 'processing');
        setPaymentDetails({
          candidateName: String(payload?.candidate_name || 'ce candidat').trim() || 'ce candidat',
          candidateSlug: String(payload?.candidate_slug || '').trim(),
          amount: parseAmount(payload?.amount),
          quantity: parseQuantity(payload?.quantity),
          currency: (String(payload?.currency || 'XOF').trim() || 'XOF'),
        });

        if (cancelled) {
          return;
        }

        if (nextState === 'success') {
          setPaymentState('success');
          setMessage(`Merci pour votre engagement. ${payload?.candidate_name || 'Ce candidat'} vient de recevoir ${parseQuantity(payload?.quantity)} vote${parseQuantity(payload?.quantity) > 1 ? 's' : ''} confirmé${parseQuantity(payload?.quantity) > 1 ? 's' : ''}.`);
          setIsSyncing(false);
          stopPolling();
          return;
        }

        if (nextState === 'failed') {
          setPaymentState('failed');
          setMessage('Le paiement n’a pas pu être confirmé. Aucun vote n’a été comptabilisé.');
          setIsSyncing(false);
          stopPolling();
          return;
        }

        setPaymentState('processing');
        setMessage('Le paiement est en cours de confirmation. Nous mettons cette page à jour automatiquement.');

        if (attempts < 12) {
          scheduleNext();
        } else {
          setIsSyncing(false);
          setMessage('La transaction est encore en attente côté serveur. Actualisez cette page dans quelques instants si nécessaire.');
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        if (attempts < 12) {
          setPaymentState('processing');
          setMessage('Le paiement est peut-être déjà en cours de confirmation. Nouvelle vérification automatique...');
          scheduleNext();
        } else {
          setIsSyncing(false);
          setPaymentState('processing');
          setMessage(error?.message || 'Impossible de vérifier la transaction pour le moment.');
        }
      }
    };

    void syncPayment();

    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [queryStatus, reference]);

  return (
    <div className="payment-confirmation-page">
      <section className="payment-confirmation-hero">
        <div className="payment-confirmation-bg" aria-hidden="true">
          <div className="payment-confirmation-orb orb-1" />
          <div className="payment-confirmation-orb orb-2" />
          <div className="payment-confirmation-grid" />
        </div>

        <div className="container">
          <motion.div
            className={`payment-confirmation-shell is-${paymentState}`}
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
          >
            <span className="payment-confirmation-pill">{stateCopy.eyebrow}</span>

            <div className="payment-confirmation-top">
              <div className={`payment-confirmation-icon is-${paymentState}`} aria-hidden="true">
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
                  <div className="payment-confirmation-spinner" />
                )}
              </div>

              <div className="payment-confirmation-copy">
                <h1>{stateCopy.title}</h1>
                <p className="payment-confirmation-lead">{stateCopy.subtitle}</p>
                <p className="payment-confirmation-message">{message}</p>
                <p className="payment-confirmation-detail">{stateCopy.detail}</p>
              </div>
            </div>

            <div className="payment-confirmation-meta">
              <article className="payment-meta-card">
                <span>Reference</span>
                <strong>{reference || 'En attente'}</strong>
              </article>
              <article className="payment-meta-card">
                <span>Candidat</span>
                <strong>{candidateName}</strong>
              </article>
              <article className="payment-meta-card">
                <span>Votes</span>
                <strong>{quantity}</strong>
              </article>
              <article className="payment-meta-card">
                <span>Montant</span>
                <strong>{amount > 0 ? `${amount.toLocaleString('fr-FR')} ${currency}` : `-- ${currency}`}</strong>
              </article>
            </div>

            <div className="payment-confirmation-actions">
              <Link to={candidateLink} className="payment-action-primary">
                {paymentState === 'success' ? 'Soutenir encore ce candidat' : 'Retour au candidat'}
              </Link>
              <Link to="/candidates" className="payment-action-secondary">
                Decouvrir les candidats
              </Link>
            </div>

            {paymentState === 'success' ? (
              <div className="payment-confirmation-note">
                Chaque vote confirme votre soutien et renforce les chances de victoire de votre candidat.
              </div>
            ) : null}

            {paymentState === 'processing' && isSyncing ? (
              <div className="payment-confirmation-note">
                Confirmation automatique en cours...
              </div>
            ) : null}
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default PaymentConfirmation;
