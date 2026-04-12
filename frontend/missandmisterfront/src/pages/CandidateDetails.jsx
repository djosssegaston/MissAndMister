import { useRef, useState } from 'react';
import { Link, useParams, useOutletContext } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { candidatesAPI, votesAPI } from '../services/api';
import { useToast } from '../components/Toast';
import Loader from '../components/Loader';
import { getCandidateImageSources } from '../utils/candidateImage';
import { resolveMediaUrl } from '../utils/mediaUrl';
import { useAutoRefresh } from '../utils/liveUpdates';
import './CandidateDetails.css';

const DEFAULT_PRICE_PER_VOTE = 100;

const CandidateDetails = () => {
  const { id } = useParams();
  const { showToast } = useToast();
  const [candidate, setCandidate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const hasLoadedRef = useRef(false);

  const [step, setStep] = useState('form'); // 'form' | 'success'
  const [nbVotes, setNbVotes] = useState(1);
  const [votingLoading, setVotingLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const {
    publicSettings = null,
    votingBlocked = false,
    votingBlockMessage = 'Vote bloquer',
  } = useOutletContext() || {};

  const pricePerVote = Number(publicSettings?.price_per_vote) > 0
    ? Number(publicSettings.price_per_vote)
    : DEFAULT_PRICE_PER_VOTE;

  const fetchCandidate = async () => {
    if (!id) return;

    const isInitialLoad = !hasLoadedRef.current;

    try {
      if (isInitialLoad) {
        setLoading(true);
        setPhotoFailed(false);
        setVideoFailed(false);
      }

      const data = await candidatesAPI.getById(id);
      setPhotoFailed(false);
      setVideoFailed(false);
      setCandidate(data);
      setError(null);
      hasLoadedRef.current = true;
    } catch (err) {
      if (isInitialLoad || err?.status === 404 || err?.status === 403) {
        setCandidate(null);
        setError(err.message || 'Erreur lors du chargement du candidat');
      }
    } finally {
      if (isInitialLoad) {
        hasLoadedRef.current = true;
        setLoading(false);
      }
    }
  };

  useAutoRefresh(fetchCandidate, { enabled: Boolean(id) });

  const retryFetchCandidate = async () => {
    hasLoadedRef.current = false;
    await fetchCandidate();
  };

  const total = (nbVotes || 0) * pricePerVote;
  const photo = getCandidateImageSources(candidate || {}, 'portrait');
  const photoBackdrop = photo.backdrop || photo.src;
  const videoUrl = resolveMediaUrl(candidate?.video_url || candidate?.video_path);

  const incrementVotes = () => {
    setErrors(e => ({ ...e, nbVotes: '' }));
    setNbVotes(v => Math.min(1000, v + 1));
  };

  const decrementVotes = () => {
    setErrors(e => ({ ...e, nbVotes: '' }));
    setNbVotes(v => Math.max(0, v - 1));
  };

  const handlePay = async () => {
    if (votingBlocked) {
      setErrors({ general: votingBlockMessage });
      return;
    }

    if (nbVotes < 1) {
      setErrors({ nbVotes: 'Choisissez au moins 1 vote' });
      return;
    }

    setVotingLoading(true);
    setErrors({});

    try {
      const response = await votesAPI.vote(candidate.id, { amount: total, quantity: nbVotes });

      // Si le backend renvoie une URL de paiement (kkiapay), on redirige
      if (response?.payment_url) {
        window.location.href = response.payment_url;
        return;
      }

      setStep('success');
      showToast(`${nbVotes} vote(s) prêts pour ${candidate.first_name} ${candidate.last_name}`, 'success');
    } catch (err) {
      setErrors({ general: err.message || 'Erreur lors du paiement' });
      showToast('Erreur lors du paiement', 'error');
    } finally {
      setVotingLoading(false);
    }
  };

  const handleReset = () => {
    setStep('form');
    setNbVotes(1);
    setErrors({});
  };

  if (loading) {
    return (
      <div className="cdet-page">
        <div className="container cdet-container">
          <div className="loading-container">
            <Loader />
            <p>Chargement du candidat...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !candidate) {
    return (
      <div className="cdet-page">
        <div className="container cdet-container">
          <div className="error-container">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="#ef4444" strokeWidth="1.5"/>
              <path d="M15 9l-6 6M9 9l6 6" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <h3>Erreur de chargement</h3>
            <p>{error || 'Candidat non trouvé'}</p>
            <button className="btn-gold" type="button" onClick={retryFetchCandidate}>
              Réessayer
            </button>
            <Link to="/candidates">
              <button className="btn-gold">Retour aux candidats</button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="cdet-page">
      <div className="container cdet-container">

        {/* ══════════════════ COLONNE GAUCHE ══════════════════ */}
        <div className="cdet-left">

          {/* 1. Photo */}
          <motion.div className="cdet-photo-card" initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}>
            <div className="cdet-photo-wrap">
            {!photoFailed && photo.src ? (
                <>
                  {photoBackdrop ? (
                    <img
                      src={photoBackdrop}
                      alt=""
                      aria-hidden="true"
                      className="cdet-photo cdet-photo-bg"
                      loading="lazy"
                      decoding="async"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : null}
                  <div className="cdet-photo-overlay" aria-hidden="true" />
                  <img
                    src={photo.src}
                    srcSet={photo.srcSet}
                    sizes="(max-width: 960px) 100vw, 800px"
                    alt={`${candidate.first_name} ${candidate.last_name}`}
                    className="cdet-photo cdet-photo-main"
                    loading="lazy"
                    decoding="async"
                    onError={(e) => {
                      e.currentTarget.removeAttribute('srcset');
                      setPhotoFailed(true);
                    }}
                  />
                </>
              ) : (
                <div className="cdet-photo-placeholder">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="8" r="4" stroke="rgba(212,175,55,0.3)" strokeWidth="1.5"/>
                    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="rgba(212,175,55,0.3)" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </div>
              )}
              <div className="cdet-photo-badges">
                <span className="cdet-badge-num">N°{(candidate.public_number ?? candidate.id).toString().padStart(2, '0')}</span>
                <span className={`cdet-badge-cat ${candidate.category?.name?.toLowerCase() || 'unknown'}`}>{candidate.category?.name || 'Unknown'}</span>
              </div>
            </div>
            <div className="cdet-vote-stats">
              <div className="cdet-vs-item">
                <strong>{(candidate.votes_count || 0).toLocaleString('fr-FR')}</strong>
                <span>Total votes</span>
              </div>
              <div className="cdet-vs-divider" />
              <div className="cdet-vs-item">
                <strong>#1</strong>
                <span>Classement</span>
              </div>
              <div className="cdet-vs-divider" />
              <div className="cdet-vs-item">
                <strong>{candidate.university}</strong>
                <span>Université</span>
              </div>
            </div>
          </motion.div>

          {/* 2. Vidéo de présentation */}
          <motion.div className="cdet-video-card" initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.1 }}>
            <div className="cdet-video-header">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <polygon points="5 3 19 12 5 21 5 3" stroke="#D4AF37" strokeWidth="2" strokeLinejoin="round" fill="rgba(212,175,55,0.15)"/>
              </svg>
              <span>Vidéo de présentation</span>
            </div>

            {videoUrl && !videoFailed ? (
              <div className="cdet-video-wrap">
                <video
                  className="cdet-video"
                  controls
                  preload="metadata"
                  src={videoUrl}
                  onError={() => setVideoFailed(true)}
                >
                  Votre navigateur ne supporte pas la lecture vidéo.
                </video>
              </div>
            ) : (
              <div className="cdet-video-placeholder">
                <div className="cdet-video-placeholder-icon">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                    <polygon points="5 3 19 12 5 21 5 3" stroke="rgba(212,175,55,0.25)" strokeWidth="1.5" strokeLinejoin="round"/>
                  </svg>
                </div>
                <p>{videoFailed ? 'Vidéo indisponible' : 'Vidéo bientôt disponible'}</p>
                <span>
                  {videoFailed
                    ? 'Le média n’a pas pu être chargé. Réessayez dans un instant.'
                    : "Le candidat n'a pas encore uploadé sa vidéo"}
                </span>
              </div>
            )}
          </motion.div>

          {/* 3. Profil */}
          <motion.div className="cdet-profile-card" initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.2 }}>
            <h1 className="cdet-name">{candidate.first_name} {candidate.last_name}</h1>
            <p className="cdet-faculty">{candidate.university}</p>

            <div className="cdet-info-grid">
              {[
                candidate.age && { label:'Âge', value:`${candidate.age} ans` },
                candidate.city && { label:'Ville', value: candidate.city },
                { label:'Catégorie', value: candidate.category?.name || 'Unknown' },
                { label:'Numéro', value:`N°${(candidate.public_number ?? candidate.id).toString().padStart(2, '0')}` },
              ].filter(Boolean).map((info, i) => (
                <div key={i} className="cdet-info-item">
                  <span className="cdet-info-label">{info.label}</span>
                  <span className="cdet-info-value">{info.value}</span>
                </div>
              ))}
            </div>

            <p className="cdet-bio">{candidate.bio || candidate.description || 'Aucune biographie disponible.'}</p>

            {candidate.interests && candidate.interests.length > 0 && (
              <div className="cdet-interests">
                {candidate.interests.map((int, i) => (
                  <span key={i} className="cdet-interest-tag">{int}</span>
                ))}
              </div>
            )}
          </motion.div>

        </div>

        {/* ══════════════════ COLONNE DROITE : VOTE ══════════════════ */}
        <motion.div className="cdet-vote-panel" initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }} transition={{ delay:0.15 }}>
          <div className="cdet-vote-header">
            <div className="cdet-vote-header-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="11" width="18" height="10" rx="2" stroke="#D4AF37" strokeWidth="2"/>
                <path d="M9 11V7a3 3 0 016 0v4" stroke="#D4AF37" strokeWidth="2" strokeLinecap="round"/>
                <circle cx="12" cy="16" r="1.5" fill="#D4AF37"/>
              </svg>
            </div>
            <div>
              <h2>Soutenez {candidate.first_name} {candidate.last_name}</h2>
              <p>Choisissez votre nombre de votes ( {pricePerVote} FCFA / vote )</p>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {step === 'form' && (
              <motion.div key="form" className="cdet-vote-body"
                initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-20 }} transition={{ duration:0.25 }}>

                <div className="cdet-cta-message">
                  Vous êtes sur le point de voter pour <strong>{candidate.first_name} {candidate.last_name}</strong>.
                  Sélectionnez le nombre de votes avant de passer au paiement sécurisé.
                </div>

                <div className="cdet-counter">
                  <button className="cdet-nb-btn" onClick={decrementVotes} disabled={nbVotes <= 0 || votingBlocked}>−</button>
                  <div className="cdet-counter-value">{nbVotes}</div>
                  <button className="cdet-nb-btn" onClick={incrementVotes} disabled={votingBlocked}>+</button>
                </div>
                {errors.nbVotes && <p className="cdet-error">{errors.nbVotes}</p>}

                <motion.div className="cdet-total-preview" initial={{ opacity:0, scale:0.95 }} animate={{ opacity:1, scale:1 }}>
                  <span>Total à payer</span>
                  <strong>{total.toLocaleString('fr-FR')} FCFA</strong>
                </motion.div>
                <p className="cdet-price-hint">Montant calculé automatiquement en temps réel.</p>
                {votingBlocked && <p className="cdet-error">{votingBlockMessage}</p>}
                {errors.general && <p className="cdet-error">{errors.general}</p>}

                <motion.button
                  className="cdet-btn-vote"
                  onClick={handlePay}
                  disabled={nbVotes < 1 || votingLoading || votingBlocked}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                >
                  {votingBlocked ? 'Vote bloquer' : (votingLoading ? 'Paiement en cours...' : 'Payer avec Kkiapay')}
                </motion.button>
              </motion.div>
            )}

            {step === 'success' && (
              <motion.div key="success" className="cdet-vote-body cdet-success"
                initial={{ opacity:0, scale:0.92 }} animate={{ opacity:1, scale:1 }} transition={{ duration:0.35 }}>

                <motion.div className="cdet-success-icon"
                  initial={{ scale:0 }} animate={{ scale:1 }}
                  transition={{ type:'spring', stiffness:300, damping:20, delay:0.1 }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                    <path d="M20 6L9 17l-5-5" stroke="#D4AF37" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </motion.div>

                <h3>Vote prêt à être validé !</h3>
                <p>
                  Vous avez sélectionné <strong>{nbVotes} vote{nbVotes > 1 ? 's' : ''}</strong> pour
                  {' '}<strong>{candidate.first_name} {candidate.last_name}</strong>.
                </p>
                <p className="cdet-success-sub">Le paiement sécurisé Kkiapay a été initié.</p>

                <div className="cdet-success-actions">
                  <button className="cdet-btn-vote" onClick={handleReset}>Voter à nouveau</button>
                  <Link to="/candidates" className="cdet-btn-back">Voir tous les candidats</Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

      </div>
    </div>
  );
};

export default CandidateDetails;
