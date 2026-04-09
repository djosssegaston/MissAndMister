import { motion } from 'framer-motion';
import './Loader.css';

const Loader = ({
  size = 'medium',
  color = 'primary',
  text = 'Chargement...',
  showText = true,
  fullScreen = false
}) => {
  const spinnerVariants = {
    animate: {
      rotate: 360,
      transition: {
        duration: 1,
        repeat: Infinity,
        ease: 'linear'
      }
    }
  };

  const containerClasses = `loader-container ${fullScreen ? 'fullscreen' : ''} ${size}`;

  return (
    <div className={containerClasses}>
      <motion.div
        className={`loader-spinner ${color}`}
        variants={spinnerVariants}
        animate="animate"
      >
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle
            cx="20"
            cy="20"
            r="16"
            stroke="currentColor"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
            strokeDasharray="25 75"
            className="loader-circle"
          />
        </svg>
      </motion.div>

      {showText && (
        <motion.p
          className="loader-text"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {text}
        </motion.p>
      )}
    </div>
  );
};

// Loader spécifique pour les tableaux
export const TableLoader = ({ columns }) => {
  return (
    <div className="table-loader">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="table-row-loader">
          {columns.map((_, colIndex) => (
            <div key={colIndex} className="table-cell-loader">
              <div className="skeleton"></div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

// Loader pour les cartes
export const CardLoader = ({ count = 3 }) => {
  return (
    <div className="card-loader-grid">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="card-loader">
          <div className="card-image-loader">
            <div className="skeleton"></div>
          </div>
          <div className="card-content-loader">
            <div className="skeleton skeleton-title"></div>
            <div className="skeleton skeleton-text"></div>
            <div className="skeleton skeleton-text skeleton-short"></div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default Loader;