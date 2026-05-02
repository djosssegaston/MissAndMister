import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { authAPI } from '../services/api';
import { useToast } from '../components/Toast';
import './ChangePassword.css';

const ChangePassword = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const storedUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user'));
    } catch {
      return null;
    }
  }, []);

  const [formData, setFormData] = useState({
    currentPassword: '',
    password: '',
    confirm: '',
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const validate = () => {
    const next = {};

    if (!formData.currentPassword) next.currentPassword = 'Le mot de passe actuel est requis';
    if (!formData.password) next.password = 'Le nouveau mot de passe est requis';
    else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{10,}$/.test(formData.password)) {
      next.password = '10 caractères minimum avec majuscule, minuscule, chiffre et symbole';
    }
    if (!formData.confirm) next.confirm = 'Veuillez confirmer le mot de passe';
    else if (formData.password !== formData.confirm) next.confirm = 'Les mots de passe ne correspondent pas';
    else if (formData.currentPassword === formData.password) next.password = 'Le nouveau mot de passe doit etre different';

    return next;
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setIsLoading(true);
    try {
      const response = await authAPI.changePassword({
        current_password: formData.currentPassword,
        password: formData.password,
        password_confirmation: formData.confirm,
      });
      const session = await authAPI.resolveSession(response, storedUser?.role === 'admin' || storedUser?.role === 'superadmin' ? 'admin' : 'user');

      localStorage.setItem('authToken', session.token);
      localStorage.setItem('user', JSON.stringify(session.user));

      showToast('Mot de passe mis à jour avec succès', 'success');
      navigate(session.user.role === 'candidate' ? '/dashboard' : '/');
    } catch (error) {
      if (error?.isSessionExpired) {
        return;
      }
      setErrors({
        general: error.message || 'Impossible de mettre à jour le mot de passe',
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

      <div className="auth-container">
        <motion.div
          className="auth-right"
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="auth-form-card">
            <div className="auth-form-header">
              <h2>Changer le mot de passe</h2>
              <p>
                {storedUser?.must_change_password
                  ? 'Pour des raisons de sécurité, vous devez remplacer votre mot de passe temporaire avant de continuer.'
                  : 'Mettez à jour votre mot de passe en toute sécurité.'}
              </p>
            </div>

            {errors.general && (
              <motion.div className="auth-alert error" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} role="alert">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                  <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                {errors.general}
              </motion.div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <div className={`lf-group ${errors.currentPassword ? 'has-error' : ''}`}>
                <label htmlFor="cp-current-password">Mot de passe actuel</label>
                <div className="lf-input-wrap">
                  <input
                    id="cp-current-password"
                    name="currentPassword"
                    type="password"
                    value={formData.currentPassword}
                    onChange={handleChange}
                    placeholder="Mot de passe temporaire ou actuel"
                    autoComplete="current-password"
                    disabled={isLoading}
                  />
                </div>
                {errors.currentPassword && <span className="lf-error">{errors.currentPassword}</span>}
              </div>

              <div className={`lf-group ${errors.password ? 'has-error' : ''}`}>
                <label htmlFor="cp-password">Nouveau mot de passe</label>
                <div className="lf-input-wrap">
                  <input
                    id="cp-password"
                    name="password"
                    type="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="10 caractères minimum"
                    autoComplete="new-password"
                    disabled={isLoading}
                  />
                </div>
                {errors.password && <span className="lf-error">{errors.password}</span>}
              </div>

              <div className={`lf-group ${errors.confirm ? 'has-error' : ''}`}>
                <label htmlFor="cp-confirm">Confirmer le mot de passe</label>
                <div className="lf-input-wrap">
                  <input
                    id="cp-confirm"
                    name="confirm"
                    type="password"
                    value={formData.confirm}
                    onChange={handleChange}
                    placeholder="Répétez le nouveau mot de passe"
                    autoComplete="new-password"
                    disabled={isLoading}
                  />
                </div>
                {errors.confirm && <span className="lf-error">{errors.confirm}</span>}
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
                    Enregistrement...
                  </>
                ) : (
                  'Mettre à jour le mot de passe'
                )}
              </motion.button>
            </form>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default ChangePassword;
