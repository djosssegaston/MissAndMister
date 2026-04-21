import { Link } from 'react-router-dom';

const NotFound = () => {
  return (
    <section className="section">
      <div className="container">
        <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', maxWidth: '720px', margin: '0 auto' }}>
          <span className="section-badge">404</span>
          <h1 style={{ marginTop: '1rem' }}>Page introuvable</h1>
          <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>
            Le lien que vous avez ouvert n&apos;existe plus ou n&apos;est plus disponible.
          </p>
          <div style={{ marginTop: '1.5rem' }}>
            <Link to="/" className="btn-gold">
              Retour à l&apos;accueil
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default NotFound;
