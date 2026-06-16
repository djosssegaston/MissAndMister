import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Loader from '../components/Loader';
import { socialProjectsAPI } from '../services/api';
import { resolveMediaUrl } from '../utils/mediaUrl';
import './ProjetSocial.css';

const normalizeProject = (item) => ({
  id: item.id,
  name: item.name || '',
  theme: item.theme || '',
  candidate1: item.candidate1 ? {
    fullName: item.candidate1.full_name || '',
    university: item.candidate1.university || '',
    photoUrl: resolveMediaUrl(item.candidate1.photo_url || null),
  } : null,
  candidate2: item.candidate2 ? {
    fullName: item.candidate2.full_name || '',
    university: item.candidate2.university || '',
    photoUrl: resolveMediaUrl(item.candidate2.photo_url || null),
  } : null,
});

const ProjectCard = ({ project, index }) => {
  const [img1Failed, setImg1Failed] = useState(false);
  const [img2Failed, setImg2Failed] = useState(false);

  return (
    <motion.article
      className="projet-social-card"
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, delay: index * 0.1, ease: [0.22, 1, 0.36, 1] }}
    >
      <h2 className="psc-title">{project.name}</h2>

      <div className="psc-candidates">
        <div className="psc-candidate">
          <div className="psc-photo-wrap">
            {!img1Failed && project.candidate1?.photoUrl ? (
              <img
                src={project.candidate1.photoUrl}
                alt={project.candidate1.fullName}
                className="psc-photo"
                loading="lazy"
                decoding="async"
                onError={() => setImg1Failed(true)}
              />
            ) : (
              <div className="psc-photo-placeholder">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke="#D4AF37" strokeWidth="1.5" strokeLinecap="round"/>
                  <circle cx="12" cy="7" r="4" stroke="#D4AF37" strokeWidth="1.5"/>
                </svg>
              </div>
            )}
          </div>
          <h3 className="psc-name">{project.candidate1?.fullName || 'Candidat'}</h3>
          <p className="psc-univ">{project.candidate1?.university || ''}</p>
        </div>

        <div className="psc-divider">
          <span>&amp;</span>
        </div>

        <div className="psc-candidate">
          <div className="psc-photo-wrap">
            {!img2Failed && project.candidate2?.photoUrl ? (
              <img
                src={project.candidate2.photoUrl}
                alt={project.candidate2.fullName}
                className="psc-photo"
                loading="lazy"
                decoding="async"
                onError={() => setImg2Failed(true)}
              />
            ) : (
              <div className="psc-photo-placeholder">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke="#D4AF37" strokeWidth="1.5" strokeLinecap="round"/>
                  <circle cx="12" cy="7" r="4" stroke="#D4AF37" strokeWidth="1.5"/>
                </svg>
              </div>
            )}
          </div>
          <h3 className="psc-name">{project.candidate2?.fullName || 'Candidat'}</h3>
          <p className="psc-univ">{project.candidate2?.university || ''}</p>
        </div>
      </div>

      <div className="psc-theme-box">
        <p>{project.theme}</p>
      </div>
    </motion.article>
  );
};

const ProjetSocial = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await socialProjectsAPI.getAll();
        if (!cancelled) {
          const rows = (response?.data || []).map(normalizeProject);
          setProjects(rows);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Impossible de charger les projets sociaux.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <section className="section projet-social-page">
      <div className="container">
        <motion.div
          className="psp-header"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <h1>Projets Sociaux</h1>
          <p>
            Découvrez les binômes de candidats engagés autour de projets sociaux
            porteurs de sens et de changement.
          </p>
        </motion.div>

        {loading && (
          <div className="psp-loading">
            <Loader
              size="small"
              color="secondary"
              text="Chargement des projets"
              subtext="Préparation des binômes..."
            />
          </div>
        )}

        {error && (
          <div className="psp-error">
            <p>{error}</p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => window.location.reload()}
            >
              Réessayer
            </button>
          </div>
        )}

        {!loading && !error && projects.length === 0 && (
          <div className="psp-empty">
            <div className="psp-empty-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" stroke="#D4AF37" strokeWidth="1.5"/>
                <path d="M12 6v6l4 2" stroke="#D4AF37" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <h2>Aucun projet social pour le moment</h2>
            <p>Les binômes de projets sociaux seront bientôt disponibles. Revenez nous visiter !</p>
          </div>
        )}

        {!loading && !error && projects.length > 0 && (
          <div className="psp-grid">
            {projects.map((project, index) => (
              <ProjectCard key={project.id} project={project} index={index} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default ProjetSocial;
