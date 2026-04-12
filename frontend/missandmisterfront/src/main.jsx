import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import logoSrc from './assets/logo.jpeg'

const updateBrandIcons = () => {
  if (typeof document === 'undefined') {
    return;
  }

  const ensureLink = (rel) => {
    const existing = document.querySelector(`link[rel="${rel}"]`);
    if (existing) {
      return existing;
    }

    const link = document.createElement('link');
    link.rel = rel;
    document.head.appendChild(link);
    return link;
  };

  const icon = ensureLink('icon');
  icon.type = 'image/jpeg';
  icon.href = logoSrc;

  const appleTouchIcon = ensureLink('apple-touch-icon');
  appleTouchIcon.type = 'image/jpeg';
  appleTouchIcon.href = logoSrc;
};

updateBrandIcons();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
