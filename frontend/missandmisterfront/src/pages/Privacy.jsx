import { Link } from 'react-router-dom';
import { PROJECT_EMAIL, PROJECT_PHONE_DISPLAY } from '../utils/siteContact';
import './LegalPages.css';

const sections = [
  {
    title: '1. Objet de la politique',
    paragraphs: [
      'La présente Politique de confidentialité explique la manière dont les données personnelles sont collectées, utilisées, conservées et protégées dans le cadre de l’utilisation de la plateforme Miss & Mister University Bénin.',
      'Elle s’applique aux visiteurs du site, aux utilisateurs disposant d’un compte, aux personnes effectuant un vote et, plus généralement, à toute personne dont les données sont traitées par la plateforme pour les besoins du concours.',
    ],
  },
  {
    title: '2. Données personnelles susceptibles d’être collectées',
    paragraphs: [
      'Selon les fonctionnalités utilisées, la plateforme peut collecter et traiter les données suivantes : nom et prénom, adresse email, numéro de téléphone, identifiants de connexion, rôle utilisateur, informations de navigation, journaux techniques, historiques d’actions, données de vote, références de transaction, ainsi que les informations communiquées via les formulaires de contact ou d’assistance.',
      'Pour les candidats et les comptes d’administration, des données complémentaires peuvent être traitées dans le strict cadre de la gestion du concours, de l’organisation des profils, de la modération, de l’authentification et de la sécurité opérationnelle.',
    ],
  },
  {
    title: '3. Finalités du traitement',
    paragraphs: [
      'Les données sont traitées pour permettre le fonctionnement normal de la plateforme, l’ouverture et la gestion des comptes, l’authentification, l’organisation du concours, la comptabilisation des votes, la gestion des paiements, la prévention des abus, l’assistance utilisateur, la production de statistiques opérationnelles et la sécurité du service.',
      'Elles peuvent également être utilisées pour répondre à une demande de support, exécuter une obligation légale, assurer la traçabilité des opérations sensibles, défendre les droits de l’organisateur ou traiter un incident de sécurité ou une réclamation.',
    ],
  },
  {
    title: '4. Paiements et données financières',
    paragraphs: [
      'Les paiements liés aux votes sont traités par FedaPay. La plateforme ne stocke pas les numéros de carte bancaire, codes confidentiels ou autres données bancaires sensibles saisies dans l’interface du prestataire.',
      'La plateforme conserve uniquement les informations nécessaires au suivi de l’opération, telles que l’identifiant de transaction, la référence de paiement, le montant, le statut de la transaction et les éléments strictement utiles à la confirmation du vote et à la lutte contre les contestations ou la fraude.',
    ],
  },
  {
    title: '5. Base de traitement et cadre juridique',
    paragraphs: [
      'Les traitements mis en œuvre reposent, selon les cas, sur l’exécution du service demandé par l’utilisateur, le respect des obligations légales applicables à la plateforme, l’intérêt légitime lié à la sécurité, à la prévention de la fraude et à la gestion du concours, ou le consentement lorsque celui-ci est requis.',
      'La plateforme entend traiter les données personnelles dans le respect du cadre juridique applicable en République du Bénin, notamment des dispositions pertinentes du Code du numérique relatives à la protection des données à caractère personnel et à la vie privée.',
    ],
  },
  {
    title: '6. Destinataires des données',
    paragraphs: [
      'Les données ne sont accessibles qu’aux personnes dûment habilitées, dans la limite de leurs attributions : équipe d’organisation, administrateurs autorisés, prestataires techniques intervenant sur l’hébergement, la maintenance, les paiements, l’envoi d’emails ou la sécurité, lorsque leur intervention le justifie.',
      'Aucune vente de données personnelles n’est réalisée. Toute communication à un tiers intervient uniquement lorsqu’elle est nécessaire à l’exécution du service, à la sécurité de la plateforme, au traitement d’un paiement, à la défense d’un droit ou au respect d’une obligation légale.',
    ],
  },
  {
    title: '7. Cookies et technologies similaires',
    paragraphs: [
      'La plateforme peut utiliser des cookies ou mécanismes similaires nécessaires au bon fonctionnement du site, à la gestion de session, au maintien de certaines préférences d’affichage, à l’équilibrage des accès et à la sécurité de la navigation.',
      'Des journaux techniques peuvent également être générés afin de détecter des anomalies, prévenir les abus, fiabiliser l’accès aux services et analyser les incidents. Ces outils ne sont pas utilisés pour collecter plus d’informations que nécessaire au fonctionnement du service.',
    ],
  },
  {
    title: '8. Mesures de sécurité',
    paragraphs: [
      'La plateforme met en œuvre des mesures techniques et organisationnelles raisonnables pour protéger les données contre l’accès non autorisé, la perte, l’altération, la divulgation abusive ou l’utilisation non conforme. Ces mesures incluent notamment la gestion des droits d’accès, l’authentification, la journalisation de certaines actions sensibles, la sécurisation des flux et des mécanismes de surveillance des anomalies.',
      'Aucune solution technique ne garantissant un risque nul, l’utilisateur reconnaît que la sécurité absolue ne peut être promise. En cas d’incident avéré, l’organisateur prend les mesures appropriées au regard de la gravité de la situation et des obligations applicables.',
    ],
  },
  {
    title: '9. Durée de conservation',
    paragraphs: [
      'Les données sont conservées pour une durée proportionnée à la finalité du traitement. Les informations de compte sont gardées pendant la durée d’activité du compte, puis archivées ou supprimées selon les besoins de gestion, de sécurité et de conformité.',
      'Les informations liées aux votes, transactions et journaux techniques peuvent être conservées au-delà de la période du concours lorsque cela est nécessaire à la vérification des résultats, au traitement des réclamations, à la prévention de la fraude ou au respect des obligations légales, comptables ou probatoires applicables.',
      'Les messages adressés via le formulaire de contact sont conservés pendant une durée compatible avec le traitement de la demande, le suivi de l’échange et les nécessités de preuve en cas de litige.',
    ],
  },
  {
    title: '10. Droits des personnes concernées',
    paragraphs: [
      'Sous réserve des limites prévues par la réglementation applicable, toute personne concernée peut demander l’accès à ses données, leur rectification, leur mise à jour, leur suppression lorsqu’elle est possible, la limitation de certains traitements ou, le cas échéant, formuler une opposition fondée.',
      'Lorsque la demande est recevable, une réponse est apportée dans un délai raisonnable après vérification de l’identité du demandeur et, si nécessaire, de son droit à agir.',
    ],
  },
  {
    title: '11. Exercice des droits et réclamations',
    paragraphs: [
      'Pour toute demande relative à la confidentialité ou à l’exercice de vos droits, vous pouvez écrire à l’équipe organisatrice via la page de contact de la plateforme ou à l’adresse suivante : ' + PROJECT_EMAIL + '.',
      'Si vous estimez que vos données n’ont pas été traitées conformément aux règles applicables, vous pouvez également vous rapprocher de l’autorité béninoise compétente en matière de protection des données personnelles, sous réserve des voies de recours prévues par la réglementation en vigueur.',
    ],
  },
  {
    title: '12. Mise à jour de la politique',
    paragraphs: [
      'La présente Politique peut être modifiée à tout moment afin de tenir compte de l’évolution du service, des obligations légales, des pratiques techniques ou des exigences de sécurité.',
      'La version applicable est celle publiée sur la plateforme à la date de consultation. En cas de changement substantiel, l’organisateur peut porter l’information à la connaissance des utilisateurs par tout moyen approprié.',
    ],
  },
];

const Privacy = () => {
  return (
    <div className="legal-page">
      <section className="legal-hero">
        <div className="legal-hero-bg" aria-hidden="true">
          <div className="legal-orb orb-1" />
          <div className="legal-orb orb-2" />
        </div>
        <div className="container">
          <div className="legal-hero-content">
            <span className="page-eyebrow">Protection des données</span>
            <h1>Politique de confidentialité</h1>
            <p>
              Cette politique décrit les traitements de données mis en œuvre dans le cadre de la plateforme
              officielle de vote du concours Miss &amp; Mister University Bénin.
            </p>
          </div>
        </div>
      </section>

      <section className="legal-content section">
        <div className="container">
          <div className="legal-layout">
            <aside className="legal-sidebar">
              <div className="legal-summary-card">
                <span className="legal-summary-label">Version publiée</span>
                <strong>21 avril 2026</strong>
                <p>
                  Politique applicable aux visiteurs, comptes utilisateurs, paiements liés au vote et services
                  d’assistance.
                </p>
              </div>

              <div className="legal-contact-card">
                <h3>Exercer vos droits</h3>
                <p>Pour toute demande d’accès, de rectification ou de suppression :</p>
                <a href={`mailto:${PROJECT_EMAIL}`}>{PROJECT_EMAIL}</a>
                <span>{PROJECT_PHONE_DISPLAY}</span>
                <Link to="/contact" className="btn-gold-sm">Envoyer une demande</Link>
              </div>
            </aside>

            <div className="legal-main">
              <div className="legal-intro-card">
                <p>
                  La protection des données personnelles constitue une exigence de confiance, particulièrement
                  dans le cadre d’une plateforme de vote en ligne intégrant des paiements et des accès utilisateurs.
                </p>
              </div>

              {sections.map((section) => (
                <article key={section.title} className="legal-section-card">
                  <h2>{section.title}</h2>
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Privacy;
