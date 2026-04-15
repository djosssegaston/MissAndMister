import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getCandidateImageSources } from '../utils/candidateImage';
import { formatCandidatePublicNumber, getCandidatePublicPath } from '../utils/candidatePublic';
import './CandidateCard.css';

const CandidateCard = ({ candidate, votingBlocked = false }) => {
  // Transform backend data to frontend format
  const transformedCandidate = {
    publicPath: getCandidatePublicPath(candidate),
    name: `${candidate.first_name} ${candidate.last_name}`,
    category: candidate.category?.name || 'Unknown',
    university: candidate.university || 'Non spécifiée',
    votes: candidate.votes_count || 0,
    number: formatCandidatePublicNumber(candidate.public_number),
  };

  const { publicPath, number, name, category, university, votes } = transformedCandidate;
  const [photoFailed, setPhotoFailed] = useState(false);
  const photo = getCandidateImageSources(candidate, 'portrait');
  const backdrop = photo.backdrop || photo.src;

  return (
    <motion.div className="candidate-card" whileHover={{ y: -8 }} transition={{ duration: 0.25 }}>
      {/* Photo */}
      <div className="cc-photo-wrap">
        {!photoFailed && photo.src
          ? <>
              {backdrop ? (
                <img
                  src={backdrop}
                  alt=""
                  aria-hidden="true"
                  className="cc-photo cc-photo-bg"
                  loading="lazy"
                  decoding="async"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : null}
              <div className="cc-photo-overlay" aria-hidden="true" />
              <img
                src={photo.src}
                srcSet={photo.srcSet}
                sizes="(max-width: 600px) 100vw, (max-width: 1100px) 50vw, 33vw"
                alt={name}
                className="cc-photo cc-photo-main"
                loading="lazy"
                decoding="async"
                onError={(e) => {
                  e.currentTarget.removeAttribute('srcset');
                  setPhotoFailed(true);
                }}
              />
            </>
          : (
            <div className="cc-photo-placeholder">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="8" r="4" stroke="rgba(212,175,55,0.3)" strokeWidth="1.5"/>
                <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="rgba(212,175,55,0.3)" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
          )
        }
        <div className="cc-number-badge">N°{number}</div>
        <div className={`cc-cat-badge ${category.toLowerCase()}`}>{category}</div>
      </div>

      {/* Infos */}
      <div className="cc-body">
        <h3 className="cc-name">{name}</h3>
        <div className="cc-meta">
          <span className="cc-univ">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
            </svg>
            {university}
          </span>
        </div>

        {/* Votes */}
        <div className="cc-votes-row">
          <div className="cc-votes-info">
            <span className="cc-votes-num">{votes.toLocaleString('fr-FR')}</span>
            <span className="cc-votes-label">votes</span>
          </div>
          <div className="cc-votes-bar-wrap">
            <motion.div
              className="cc-votes-bar"
              initial={{ width: 0 }}
              whileInView={{ width: `${Math.min((votes / 2000) * 100, 100)}%` }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="cc-footer">
        {votingBlocked ? (
          <button type="button" className="cc-btn-vote cc-btn-vote-blocked" disabled>
            Vote bloqué
          </button>
        ) : (
          <Link to={publicPath} className="cc-btn-vote">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="11" width="18" height="10" rx="2" stroke="currentColor" strokeWidth="2"/>
              <path d="M9 11V7a3 3 0 016 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="12" cy="16" r="1.5" fill="currentColor"/>
            </svg>
            Voter
          </Link>
        )}
        <Link to={publicPath} className="cc-btn-profile">
          Profil
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Link>
      </div>
    </motion.div>
  );
};

export default CandidateCard;
