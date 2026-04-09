import { useState } from 'react';
import { motion } from 'framer-motion';
import './ContactForm.css';

const ContactForm = ({ onSubmit }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Effacer l'erreur du champ modifié
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Le nom est requis';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'L\'email est requis';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email invalide';
    }

    if (!formData.subject.trim()) {
      newErrors.subject = 'Le sujet est requis';
    }

    if (!formData.message.trim()) {
      newErrors.message = 'Le message est requis';
    } else if (formData.message.trim().length < 10) {
      newErrors.message = 'Le message doit contenir au moins 10 caractères';
    }

    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const newErrors = validate();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      if (onSubmit) {
        await onSubmit(formData);
      }
      // Réinitialiser le formulaire
      setFormData({
        name: '',
        email: '',
        subject: '',
        message: '',
      });
      setErrors({});
    } catch (error) {
      console.error('Erreur lors de l\'envoi du formulaire:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.form
      className="contact-form"
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="contact-form-grid">
        {/* Nom */}
        <motion.div
          className="form-group"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          <label htmlFor="name" className="form-label">
            Nom complet <span className="required">*</span>
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className={`form-input ${errors.name ? 'error' : ''}`}
            placeholder="Votre nom complet"
          />
          {errors.name && <span className="error-message">{errors.name}</span>}
        </motion.div>

        {/* Email */}
        <motion.div
          className="form-group"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <label htmlFor="email" className="form-label">
            Email <span className="required">*</span>
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            className={`form-input ${errors.email ? 'error' : ''}`}
            placeholder="votre.email@exemple.com"
          />
          {errors.email && <span className="error-message">{errors.email}</span>}
        </motion.div>
      </div>

      {/* Sujet */}
      <motion.div
        className="form-group"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <label htmlFor="subject" className="form-label">
          Sujet <span className="required">*</span>
        </label>
        <input
          type="text"
          id="subject"
          name="subject"
          value={formData.subject}
          onChange={handleChange}
          className={`form-input ${errors.subject ? 'error' : ''}`}
          placeholder="Sujet de votre message"
        />
        {errors.subject && <span className="error-message">{errors.subject}</span>}
      </motion.div>

      {/* Message */}
      <motion.div
        className="form-group"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <label htmlFor="message" className="form-label">
          Message <span className="required">*</span>
        </label>
        <textarea
          id="message"
          name="message"
          value={formData.message}
          onChange={handleChange}
          className={`form-textarea ${errors.message ? 'error' : ''}`}
          placeholder="Votre message..."
          rows="6"
        />
        {errors.message && <span className="error-message">{errors.message}</span>}
      </motion.div>

      {/* Bouton de soumission */}
      <motion.button
        type="submit"
        className="contact-form-submit"
        disabled={isSubmitting}
        whileHover={!isSubmitting ? { scale: 1.02 } : {}}
        whileTap={!isSubmitting ? { scale: 0.98 } : {}}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        {isSubmitting ? (
          <>
            <span className="spinner"></span>
            Envoi en cours...
          </>
        ) : (
          <>
            <span className="submit-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="2" fill="#61DAFB"/>
                <circle cx="12" cy="12" r="5" stroke="#61DAFB" strokeWidth="2" fill="none"/>
                <circle cx="12" cy="12" r="9" stroke="#61DAFB" strokeWidth="2" fill="none"/>
                <path d="M12 2C13.1 2 14 2.9 14 4V6.1C15.2 6.6 16.2 7.4 16.9 8.4L18.7 7.6C19.1 7.4 19.6 7.7 19.8 8.1C20 8.5 19.7 9 19.3 9.2L17.5 10C17.8 10.7 18 11.3 18 12C18 12.7 17.8 13.3 17.5 14L19.3 14.8C19.7 15 20 15.5 19.8 15.9C19.6 16.3 19.1 16.6 18.7 16.4L16.9 15.6C16.2 16.6 15.2 17.4 14 17.9V20C14 21.1 13.1 22 12 22C10.9 22 10 21.1 10 20V17.9C8.8 17.4 7.8 16.6 7.1 15.6L5.3 16.4C4.9 16.6 4.4 16.3 4.2 15.9C4 15.5 4.3 15 4.7 14.8L6.5 14C6.2 13.3 6 12.7 6 12C6 11.3 6.2 10.7 6.5 10L4.7 9.2C4.3 9 4 8.5 4.2 8.1C4.4 7.7 4.9 7.4 5.3 7.6L7.1 8.4C7.8 7.4 8.8 6.6 10 6.1V4C10 2.9 10.9 2 12 2Z" fill="#61DAFB"/>
              </svg>
            </span>
            Envoyer le message
          </>
        )}
      </motion.button>
    </motion.form>
  );
};

export default ContactForm;
