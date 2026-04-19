import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { candidatesAPI, paymentAPI } from '../services/api';
import { getCandidatePublicPath } from '../utils/candidatePublic';
import { broadcastLiveUpdate } from '../utils/liveUpdates';
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

const parseVoteTotal = (value) => {
  const total = Number(value);
  return Number.isFinite(total) && total >= 0 ? Math.round(total) : null;
};

const formatVoteLabel = (value) => {
  const quantity = parseQuantity(value);
  return `${quantity.toLocaleString('fr-FR')} vote${quantity > 1 ? 's' : ''}`;
};

const formatAmountLabel = (amount, currency) => {
  if (amount > 0) {
    return `${amount.toLocaleString('fr-FR')} ${currency}`;
  }

  return `-- ${currency}`;
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
    candidatePublicId: (searchParams.get('candidate') || '').trim(),
    amount: 0,
    quantity: 1,
    currency: 'XOF',
  });

  const [paymentState, setPaymentState] = useState(() => (
    queryStatus === 'success' ? 'success' : (queryStatus === 'failed' ? 'failed' : 'processing')
  ));
  const [message, setMessage] = useState('Nous vérifions la confirmation du paiement auprès du serveur sécurisé.');
  const [candidateTotalVotes, setCandidateTotalVotes] = useState(null);
  const [isSyncing, setIsSyncing] = useState(SYNCABLE_STATES.has(queryStatus) && reference !== '');
  const candidateName = paymentDetails.candidateName;
  const amount = paymentDetails.amount;
  const quantity = paymentDetails.quantity;
  const currency = paymentDetails.currency;
  const formattedAmount = formatAmountLabel(amount, currency);
  const narrativeAmount = amount > 0 ? formattedAmount : 'un montant en attente de confirmation';
  const candidateLink = paymentDetails.candidatePublicId
    ? getCandidatePublicPath({ public_uid: paymentDetails.candidatePublicId })
    : '/candidates';

  const statusNotice = useMemo(() => {
    if (paymentState === 'success') {
      return {
        tone: 'success',
        label: 'Confirmation officielle',
        body: candidateTotalVotes !== null
          ? `Félicitations, votre vote a été enregistré avec succès. Grâce à votre participation, le candidat ${candidateName} totalise désormais ${candidateTotalVotes.toLocaleString('fr-FR')} votes. Au nom du candidat et de toute l’équipe de MissAndMister University Bénin, nous vous remercions pour votre engagement et votre soutien.`
          : `Félicitations, votre vote a été enregistré avec succès. Le compteur du candidat ${candidateName} est en cours d’actualisation. Au nom du candidat et de toute l’équipe de MissAndMister University Bénin, nous vous remercions pour votre engagement et votre soutien.`,
      };
    }

    if (paymentState === 'failed') {
      return {
        tone: 'failed',
        label: 'Vote annulé',
        body: `Nous vous informons que votre tentative de vote en faveur du candidat ${candidateName}, portant sur ${formatVoteLabel(quantity)} pour un montant de ${narrativeAmount}, a été annulée en raison de l’absence de confirmation du paiement. Nous vous invitons à reprendre l’opération et finaliser votre paiement.`,
      };
    }

    return {
      tone: 'processing',
      label: 'Suivi automatique',
      body: message,
    };
  }, [candidateName, candidateTotalVotes, message, narrativeAmount, paymentState, quantity]);

  const stateCopy = useMemo(() => {
    if (paymentState === 'success') {
      return {
        eyebrow: 'Paiement confirmé',
        title: 'Votre vote a bien été validé',
        subtitle: `Le paiement sécurisé a été confirmé et votre soutien en faveur de ${candidateName} est désormais pris en compte.`,
        detail: 'Le tableau du candidat est actualisé automatiquement afin de refléter votre participation.',
      };
    }

    if (paymentState === 'failed') {
      return {
        eyebrow: 'Paiement non confirmé',
        title: 'Le vote n’a pas été comptabilisé',
        subtitle: 'La plateforme n’a reçu aucune confirmation de paiement. Le scrutin reste donc inchangé.',
        detail: 'Vous pouvez relancer l’opération en toute sécurité dès que vous le souhaitez.',
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
    if (paymentState !== 'success') {
      setCandidateTotalVotes(null);
      return undefined;
    }

    const identifier = String(paymentDetails.candidatePublicId || '').trim();
    if (!identifier) {
      return undefined;
    }

    let cancelled = false;

    const fetchCandidateVotes = async () => {
      try {
        const payload = await candidatesAPI.getById(identifier);
        const nextTotalVotes = parseVoteTotal(payload?.votes_count ?? payload?.votes);

        if (!cancelled && nextTotalVotes !== null) {
          setCandidateTotalVotes(nextTotalVotes);
        }
      } catch (error) {
        if (!cancelled) {
          setCandidateTotalVotes(null);
        }
      }
    };

    void fetchCandidateVotes();

    return () => {
      cancelled = true;
    };
  }, [paymentDetails.candidatePublicId, paymentState]);

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
          candidatePublicId: String(payload?.candidate_public_uid || payload?.candidate_slug || '').trim(),
          amount: parseAmount(payload?.amount),
          quantity: parseQuantity(payload?.quantity),
          currency: (String(payload?.currency || 'XOF').trim() || 'XOF'),
        });

        if (cancelled) {
          return;
        }

        if (nextState === 'success') {
          setPaymentState('success');
          setMessage('Votre paiement a été confirmé. Nous finalisons l’actualisation du compteur du candidat.');
          broadcastLiveUpdate('votes');
          setIsSyncing(false);
          stopPolling();
          return;
        }

        if (nextState === 'failed') {
          setPaymentState('failed');
          setMessage('Le paiement n’a pas pu être confirmé. Aucun vote n’a été comptabilisé.');
          broadcastLiveUpdate('votes');
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
                <div className={`payment-confirmation-alert is-${statusNotice.tone}`}>
                  <span className="payment-confirmation-alert-label">{statusNotice.label}</span>
                  <p className="payment-confirmation-message">{statusNotice.body}</p>
                </div>
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
                <strong>{formattedAmount}</strong>
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
