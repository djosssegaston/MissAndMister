import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { authAPI } from '../services/api';
import { useToast } from '../components/Toast';
import logo from '../assets/logo.jpeg';
import './Login.css';

const Login = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [errors, setErrors]     = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPwd, setShowPwd]   = useState(false);

  const validate = () => {
    const e = {};
    if (!formData.email.trim()) e.email = "L'email est requis";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) e.email = 'Email invalide';
    if (!formData.password) e.password = 'Le mot de passe est requis';
    return e;
  };

  const handleChange = e => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    const v = validate();
    if (Object.keys(v).length > 0) { setErrors(v); return; }

    setIsLoading(true);
    try {
      const response = await authAPI.login(formData);
      const session = await authAPI.resolveSession(response, 'user');
      
      // Store token and user data
      localStorage.setItem('authToken', session.token);
      localStorage.setItem('user', JSON.stringify(session.user));
      
      showToast('Connexion réussie !', 'success');
      
      // Redirect based on user role
      if (session.user.role === 'admin' || session.user.role === 'superadmin') {
        navigate('/admin/dashboard');
      } else if (session.user.must_change_password) {
        navigate('/change-password');
      } else if (session.user.role === 'candidate') {
        navigate('/dashboard');
      } else {
        navigate('/');
      }
    } catch (err) {
      setErrors({ general: err.message || 'Email ou mot de passe incorrect' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-page">

      {/* Fond décoratif */}
      <div className="auth-bg" aria-hidden="true">
        <div className="auth-orb orb-1" />
        <div className="auth-orb orb-2" />
      </div>

      <div className="auth-container">

        {/* Panneau gauche */}
        <motion.div
          className="auth-left"
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="auth-brand">
            <div className="auth-logo">
              <img src={logo} alt="Miss & Mister logo" className="auth-logo-image" />
            </div>
            <span>Miss &amp; Mister University Bénin</span>
          </div>

          <div className="auth-left-content">
            <h1>Veillez <span className="text-gold">nous rejoindre</span></h1>
            <p>Connectez-vous pour suivre le classement en temps réel.</p>

            <div className="auth-features">
              {[
                { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>, text: 'Vote sécurisé par Mobile Money' },
                { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>, text: 'Résultats en temps réel' },
                { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>, text: 'Historique de vos votes' },
              ].map((f, i) => (
                <div key={i} className="auth-feature-item">
                  <span className="auth-feature-icon">{f.icon}</span>
                  <span>{f.text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="auth-left-footer">
            <p>Édition 2026 · Concours officiel</p>
          </div>
        </motion.div>

        {/* Panneau droite — formulaire */}
        <motion.div
          className="auth-right"
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <div className="auth-form-card">
            <div className="auth-form-header">
              <h2>Connexion</h2>
              <p>Entrez vos identifiants pour accéder à votre compte</p>
            </div>

            {errors.general && (
              <motion.div className="auth-alert error" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} role="alert">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                  <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                {errors.general}
              </motion.div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <div className={`lf-group ${errors.email ? 'has-error' : ''}`}>
                <label htmlFor="login-email">Adresse email</label>
                <div className="lf-input-wrap">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="lf-icon">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" strokeWidth="1.8"/>
                    <path d="M22 6l-10 7L2 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                  <input
                    id="login-email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="votre@email.com"
                    autoComplete="email"
                    disabled={isLoading}
                  />
                </div>
                {errors.email && <span className="lf-error">{errors.email}</span>}
              </div>

              <div className={`lf-group ${errors.password ? 'has-error' : ''}`}>
                <div className="lf-label-row">
                  <label htmlFor="login-pwd">Mot de passe</label>
                  <Link to="/register" className="lf-forgot">Créer un compte</Link>
                </div>
                <div className="lf-input-wrap">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="lf-icon">
                    <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.8"/>
                    <path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                  <input
                    id="login-pwd"
                    name="password"
                    type={showPwd ? 'text' : 'password'}
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    disabled={isLoading}
                  />
                  <button type="button" className="lf-eye" onClick={() => setShowPwd(p => !p)} aria-label={showPwd ? 'Masquer' : 'Afficher'}>
                    {showPwd
                      ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19M1 1l22 22" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                      : <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="1.8"/><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8"/></svg>
                    }
                  </button>
                </div>
                {errors.password && <span className="lf-error">{errors.password}</span>}
              </div>

              <motion.button
                type="submit"
                className="lf-submit"
                disabled={isLoading}
                whileHover={!isLoading ? { scale: 1.02 } : {}}
                whileTap={!isLoading ? { scale: 0.98 } : {}}
              >
                {isLoading ? (
                  <>
                    <motion.span className="lf-spinner" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} />
                    Connexion...
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Se connecter
                  </>
                )}
              </motion.button>
            </form>
            <div className="auth-divider"><span>ou</span></div>

            <p className="auth-switch">
              Pas encore de compte ?{' '}
              <Link to="/register" className="auth-switch-link">Créer un compte</Link>
            </p>
          </div>
        </motion.div>

      </div>
    </div>
  );
};

export default Login;
