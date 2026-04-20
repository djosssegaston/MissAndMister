import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { partnersAPI } from '../services/api';
import Loader from './Loader';
import WhatsAppIcon from './WhatsAppIcon';
import { resolveMediaUrl } from '../utils/mediaUrl';
import { PUBLIC_LIVE_UPDATE_INTERVAL_MS, useAutoRefresh } from '../utils/liveUpdates';
import { PARTNER_WHATSAPP_URL } from '../utils/siteContact';
import './PartnerShowcase.css';

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 28 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay, ease: 'easeOut' },
});

const normalizePartner = (item) => ({
  id: item.id,
  name: item.name || 'Partenaire',
  websiteUrl: item.website_url || '',
  logoUrl: resolveMediaUrl(item.logo_url || item.logo_path || null),
  sortOrder: Number(item.sort_order || 0),
  isActive: Boolean(item.is_active),
});

const PartnerLogoCard = ({ partner }) => {
  const [failed, setFailed] = useState(false);
  const initials = (partner.name || 'P').trim().charAt(0).toUpperCase();

  const cardContent = (
    <>
      <div className="partner-logo-frame" aria-hidden="true">
        {!failed && partner.logoUrl ? (
          <img
            src={partner.logoUrl}
            alt={partner.name}
            className="partner-logo-image"
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
          />
        ) : (
          <div className="partner-logo-placeholder">
            <span>{initials}</span>
          </div>
        )}
      </div>
      <span className="partner-logo-name">{partner.name}</span>
    </>
  );

  if (partner.websiteUrl) {
    return (
      <motion.a
        className="partner-logo-card is-link"
        href={partner.websiteUrl}
        target="_blank"
        rel="noreferrer"
        aria-label={`Ouvrir le site de ${partner.name}`}
        whileHover={{ y: -4 }}
        whileTap={{ scale: 0.98 }}
      >
        {cardContent}
      </motion.a>
    );
  }

  return (
    <motion.article
      className="partner-logo-card"
      whileHover={{ y: -4 }}
    >
      {cardContent}
    </motion.article>
  );
};

const PartnerShowcase = ({
  eyebrow = 'Partenaires',
  title = 'Des acteurs qui accompagnent le concours',
  description = 'Découvrez les institutions, entreprises et structures qui soutiennent l’aventure Miss & Mister University Bénin.',
  contactTitle = 'Devenir partenaire',
  contactDescription = 'Vous souhaitez associer votre institution, votre marque ou votre entreprise au concours ? Contactez directement le comité organisateur sur WhatsApp.',
  contactButtonLabel = 'Discuter sur WhatsApp',
  contactButtonVariant = 'whatsapp',
  className = '',
}) => {
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const hasLoadedRef = useRef(false);

  const fetchPartners = async () => {
    const isInitialLoad = !hasLoadedRef.current;

    try {
      if (isInitialLoad) {
        setLoading(true);
      }

      const response = await partnersAPI.getAll();
      setPartners((response?.data || []).map(normalizePartner));
      setError(null);
      hasLoadedRef.current = true;
    } catch (partnersError) {
      if (isInitialLoad) {
        setError(partnersError.message || 'Impossible de charger les partenaires pour le moment.');
      }
    } finally {
      if (isInitialLoad) {
        hasLoadedRef.current = true;
        setLoading(false);
      }
    }
  };

  useAutoRefresh(fetchPartners, { intervalMs: PUBLIC_LIVE_UPDATE_INTERVAL_MS });

  const retryFetchPartners = async () => {
    hasLoadedRef.current = false;
    await fetchPartners();
  };

  const activePartners = useMemo(
    () => partners.filter((partner) => partner.logoUrl),
    [partners],
  );

  const carouselItems = useMemo(() => {
    if (activePartners.length === 0) {
      return [];
    }

    return [...activePartners, ...activePartners];
  }, [activePartners]);

  const carouselDuration = Math.max(24, Math.min(60, carouselItems.length * 4));
  const hasPartners = activePartners.length > 0;

  return (
    <section className={`partners-section section ${className}`.trim()}>
      <div className="container">
        <motion.div className="partners-header text-center" {...fadeUp(0)}>
          <span className="section-eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
          <div className="section-divider centered" />
          <p>{description}</p>
        </motion.div>

        <div className="partners-body">
          {loading ? (
            <div className="partners-state-card partners-loading-card">
              <Loader
                size="small"
                color="secondary"
                text="Chargement des partenaires"
                subtext="Veuillez patienter un instant..."
              />
            </div>
          ) : error ? (
            <div className="partners-state-card partners-error-card">
              <h3>Erreur de chargement</h3>
              <p>{error}</p>
              <button type="button" className="btn-gold" onClick={retryFetchPartners}>
                Réessayer
              </button>
            </div>
          ) : hasPartners ? (
            <div className="partners-carousel-shell" aria-label="Carousel des partenaires">
              <div
                className="partners-carousel-track"
                style={{ '--partners-duration': `${carouselDuration}s` }}
              >
                {carouselItems.map((partner, index) => (
                  <PartnerLogoCard
                    key={`${partner.id}-${index}`}
                    partner={partner}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="partners-state-card partners-empty-card">
              <div className="partners-empty-icon" aria-hidden="true">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <path d="M4 7h16M7 7v12m10-12v12M9 11h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </div>
              <h3>Aucun logo partenaire pour le moment</h3>
              <p>Votre logo peut apparaître ici. Contactez le comité pour rejoindre l’aventure.</p>
            </div>
          )}
        </div>

        <motion.div className="partners-contact-card" {...fadeUp(0.08)}>
          <div className="partners-contact-copy">
            <span className="section-eyebrow">Partenariat</span>
            <h3>{contactTitle}</h3>
            <p>{contactDescription}</p>
          </div>

          <a
            className={`partner-whatsapp-btn ${contactButtonVariant === 'gold' ? 'is-gold' : ''}`.trim()}
            href={PARTNER_WHATSAPP_URL}
            target="_blank"
            rel="noreferrer"
          >
            <WhatsAppIcon width={18} height={18} />
            <span>{contactButtonLabel}</span>
          </a>
        </motion.div>
      </div>
    </section>
  );
};

export default PartnerShowcase;
