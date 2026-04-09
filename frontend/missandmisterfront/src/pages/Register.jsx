import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { authAPI } from '../services/api';
import { useToast } from '../components/Toast';
import logo from '../assets/logo.jpeg';
import './Login.css';  /* Réutilise les styles auth communs */
import './Register.css';

const PasswordStrength = ({ password }) => {
  const score = [
    password.length >= 10,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;

  const labels = ['', 'Faible', 'Moyen', 'Bon', 'Fort'];
  const colors = ['', '#ef4444', '#f59e0b', '#3b82f6', '#22c55e'];

  if (!password) return null;

  return (
    <div className="pwd-strength">
      <div className="pwd-bars">
        {[1,2,3,4].map(i => (
          <div key={i} className="pwd-bar" style={{ background: i <= score ? colors[score] : 'rgba(255,255,255,0.08)' }} />
        ))}
      </div>
      <span style={{ color: colors[score], fontSize: '0.73rem', fontWeight: 600 }}>{labels[score]}</span>
    </div>
  );
};

const Register = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [errors, setErrors]     = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPwd, setShowPwd]   = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);

  const phoneIsValid = (raw = '') => {
    const cleaned = raw.replace(/[\s-]/g, '');
    return /^(\+229|00229)?[0-9]{8}$/.test(cleaned) || /^[0-9]{8}$/.test(cleaned);
  };

  const validate = () => {
    const e = {};
    if (!formData.name.trim() || formData.name.trim().length < 2) e.name = 'Le nom doit contenir au moins 2 caractères';
    if (!formData.email.trim()) e.email = "L'email est requis";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) e.email = 'Email invalide';
    if (!formData.phone.trim()) e.phone = 'Le téléphone est requis';
    else if (!phoneIsValid(formData.phone)) e.phone = 'Format attendu : 97xxxxxx ou +22997xxxxxx';
    if (!formData.password) e.password = 'Le mot de passe est requis';
    else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{10,}$/.test(formData.password)) e.password = '10 caractères minimum avec majuscule, minuscule, chiffre et symbole';
    if (formData.password !== formData.confirmPassword) e.confirmPassword = 'Les mots de passe ne correspondent pas';
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
      const { confirmPassword, ...rest } = formData;
      const payload = {
        ...rest,
        name: rest.name.trim(),
        email: rest.email.trim(),
        phone: rest.phone.replace(/[\s-]/g, '').trim(),
        password_confirmation: confirmPassword,
      };
      const res = await authAPI.register(payload);
      if (res?.token) {
        localStorage.setItem('authToken', res.token);
        if (res.user) localStorage.setItem('user', JSON.stringify(res.user));
      }
      showToast('Compte créé avec succès.', 'success');
      navigate(res?.token ? '/' : '/login');
    } catch (err) {
      const serverErrors = err?.errors || {};
      const fieldErrors = {};
      if (serverErrors.name?.[0]) fieldErrors.name = serverErrors.name[0];
      if (serverErrors.email?.[0]) fieldErrors.email = serverErrors.email[0];
      if (serverErrors.phone?.[0]) fieldErrors.phone = serverErrors.phone[0];
      if (serverErrors.password?.[0]) fieldErrors.password = serverErrors.password[0];
      setErrors({
        general: err.message || "Erreur lors de l'inscription",
        ...fieldErrors,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-bg" aria-hidden="true">
        <div className="auth-orb orb-1" />
        <div className="auth-orb orb-2" />
      </div>

      <div className="auth-container reg-container">

        {/* Panneau gauche */}
        <motion.div className="auth-left" initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }}>
          <div className="auth-brand">
            <div className="auth-logo">
              <img src={logo} alt="Miss & Mister logo" className="auth-logo-image" />
            </div>
            <span>Miss &amp; Mister University Bénin</span>
          </div>

          <div className="auth-left-content">
            <h1>Rejoignez <span className="text-gold">l'aventure</span></h1>
            <p>Créez votre compte et soutenez la jeunesse universitaire béninoise en votant pour vos candidats favoris.</p>

            <div className="auth-features">
              {[
                'Inscription gratuite et rapide',
                'Vote sécurisé via Mobile Money',
                'Suivi de vos votes et paiements',
              ].map((text, i) => (
                <div key={i} className="auth-feature-item">
                  <span className="auth-feature-icon">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </span>
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="auth-left-footer">
            <p>Édition 2026 · Concours officiel</p>
          </div>
        </motion.div>

        {/* Panneau droite */}
        <motion.div className="auth-right" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.1 }}>
          <div className="auth-form-card reg-form-card">
            <div className="auth-form-header">
              <h2>Créer un compte</h2>
              <p>Renseignez vos informations pour vous inscrire</p>
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
              <div className="reg-grid">
                {/* Nom */}
                <div className={`lf-group ${errors.name ? 'has-error' : ''}`}>
                  <label htmlFor="reg-name">Nom complet</label>
                  <div className="lf-input-wrap">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="lf-icon"><circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                    <input
                      id="reg-name"
                      name="name"
                      type="text"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="Jean Dupont"
                      autoComplete="name"
                      maxLength={255}
                      disabled={isLoading}
                    />
                  </div>
                  {errors.name && <span className="lf-error">{errors.name}</span>}
                </div>

                {/* Téléphone */}
                <div className={`lf-group ${errors.phone ? 'has-error' : ''}`}>
                  <label htmlFor="reg-phone">Téléphone</label>
                  <div className="lf-input-wrap">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="lf-icon"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>
                    <input
                      id="reg-phone"
                      name="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="+229 97 00 11 22 (Bénin)"
                      autoComplete="tel"
                      inputMode="tel"
                      maxLength={20}
                      pattern="^(\\+229|00229)?[0-9]{8}$|^[0-9]{8}$"
                      title="Format attendu : 97xxxxxx ou +22997xxxxxx"
                      disabled={isLoading}
                    />
                  </div>
                  {errors.phone && <span className="lf-error">{errors.phone}</span>}
                </div>
              </div>

              {/* Email */}
              <div className={`lf-group ${errors.email ? 'has-error' : ''}`}>
                <label htmlFor="reg-email">Adresse email</label>
                <div className="lf-input-wrap">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="lf-icon">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" strokeWidth="1.8"/>
                    <path d="M22 6l-10 7L2 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                  <input
                    id="reg-email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="votre@email.com"
                    autoComplete="email"
                    maxLength={255}
                    disabled={isLoading}
                  />
                </div>
                {errors.email && <span className="lf-error">{errors.email}</span>}
              </div>

              {/* Password */}
              <div className={`lf-group ${errors.password ? 'has-error' : ''}`}>
                <label htmlFor="reg-pwd">Mot de passe</label>
                <div className="lf-input-wrap">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="lf-icon">
                    <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.8"/>
                    <path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                  <input id="reg-pwd" name="password" type={showPwd ? 'text' : 'password'}
                    value={formData.password} onChange={handleChange} placeholder="Min. 10 caractères (Aa1@)"
                    autoComplete="new-password" maxLength={72} disabled={isLoading} className="lf-input" />
                  <button type="button" className="lf-eye" onClick={() => setShowPwd(p => !p)} aria-label="Toggle password">
                    {showPwd
                      ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19M1 1l22 22" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                      : <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="1.8"/><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8"/></svg>
                    }
                  </button>
                </div>
                <PasswordStrength password={formData.password} />
                {errors.password && <span className="lf-error">{errors.password}</span>}
              </div>

              {/* Confirm Password */}
              <div className={`lf-group ${errors.confirmPassword ? 'has-error' : ''}`}>
                <label htmlFor="reg-cpwd">Confirmer le mot de passe</label>
                <div className="lf-input-wrap">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="lf-icon">
                    <path d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <input id="reg-cpwd" name="confirmPassword" type={showConfirmPwd ? 'text' : 'password'}
                    value={formData.confirmPassword} onChange={handleChange} placeholder="Répétez le mot de passe"
                    autoComplete="new-password" maxLength={72} disabled={isLoading} className="lf-input" />
                  <button type="button" className="lf-eye" onClick={() => setShowConfirmPwd(p => !p)} aria-label="Toggle">
                    {showConfirmPwd
                      ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19M1 1l22 22" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                      : <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="1.8"/><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8"/></svg>
                    }
                  </button>
                </div>
                {errors.confirmPassword && <span className="lf-error">{errors.confirmPassword}</span>}
              </div>

              <p className="reg-terms">
                En vous inscrivant, vous acceptez nos{' '}
                <Link to="/terms" className="reg-terms-link">Conditions d'utilisation</Link>
                {' '}et notre{' '}
                <Link to="/privacy" className="reg-terms-link">Politique de confidentialité</Link>.
              </p>

              <motion.button type="submit" className="lf-submit" disabled={isLoading}
                whileHover={!isLoading ? { scale: 1.02 } : {}} whileTap={!isLoading ? { scale: 0.98 } : {}}>
                {isLoading ? (
                  <><motion.span className="lf-spinner" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} /> Inscription...</>
                ) : (
                  <><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><circle cx="8.5" cy="7" r="4" stroke="currentColor" strokeWidth="2"/><line x1="20" y1="8" x2="20" y2="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="23" y1="11" x2="17" y2="11" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg> Créer mon compte</>
                )}
              </motion.button>
            </form>

            <div className="auth-divider"><span>ou</span></div>

            <p className="auth-switch">
              Déjà un compte ?{' '}
              <Link to="/login" className="auth-switch-link">Se connecter</Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Register;
