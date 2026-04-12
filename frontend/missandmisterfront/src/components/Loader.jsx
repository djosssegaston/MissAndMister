import { motion } from 'framer-motion';
import logoSrc from '../assets/logo.jpeg';
import './Loader.css';

const Loader = ({
  size = 'medium',
  color = 'primary',
  text = 'Chargement...',
  subtext = 'Préparation d\'une expérience fluide et élégante',
  showText = true,
  fullScreen = false
}) => {
  const containerClasses = [
    'loader-container',
    fullScreen ? 'fullscreen' : '',
    `size-${size}`,
    `theme-${color}`,
  ].filter(Boolean).join(' ');

  return (
    <div className={containerClasses} role="status" aria-live="polite" aria-busy="true">
      <div className="loader-orbit" aria-hidden="true">
        <span className="loader-ring loader-ring-outer" />
        <span className="loader-ring loader-ring-inner" />

        <motion.div
          className="loader-core"
          initial={{ scale: 0.96, opacity: 0.92 }}
          animate={{ scale: [0.96, 1.02, 0.96], opacity: [0.92, 1, 0.92] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
        >
          <span className="loader-core-glow" />
          <span className="loader-logo-frame">
            <img src={logoSrc} alt="" className="loader-logo" loading="eager" decoding="async" />
          </span>
        </motion.div>
      </div>

      {showText && (
        <motion.div
          className="loader-copy"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.3 }}
        >
          <p className="loader-text">{text}</p>
          <span className="loader-subtext">{subtext}</span>
        </motion.div>
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
