import { motion } from 'framer-motion';
import './VoteButton.css';

const VoteButton = ({ onClick, isLoading = false, disabled = false, label = 'Voter', size = 'md' }) => (
  <motion.button
    className={`vote-button size-${size} ${isLoading ? 'loading' : ''}`}
    onClick={onClick}
    disabled={disabled || isLoading}
    whileHover={!disabled && !isLoading ? { scale: 1.04 } : {}}
    whileTap={!disabled && !isLoading ? { scale: 0.97 } : {}}
    aria-label={isLoading ? 'Vote en cours...' : label}
  >
    {isLoading ? (
      <>
        <motion.span className="vb-spinner" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} />
        <span>Traitement...</span>
      </>
    ) : (
      <>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="11" width="18" height="10" rx="2" stroke="currentColor" strokeWidth="2"/>
          <path d="M9 11V7a3 3 0 016 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <circle cx="12" cy="16" r="1.5" fill="currentColor"/>
        </svg>
        <span>{label}</span>
      </>
    )}
    {!isLoading && <span className="vb-shine" aria-hidden="true" />}
  </motion.button>
);

export default VoteButton;