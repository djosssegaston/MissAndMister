import { Link } from 'react-router-dom';
import { PROJECT_EMAIL, PROJECT_PHONE_DISPLAY } from '../utils/siteContact';
import './LegalPages.css';

const sections = [
  {
    title: '1. Objet du service',
    paragraphs: [
      'La plateforme Miss & Mister University Bénin permet au public de consulter les profils des candidats inscrits au concours universitaire, d’accéder aux informations officielles de l’événement et, pendant les périodes d’ouverture du vote, de soutenir un candidat au moyen d’un vote payant.',
      'Le service est exploité dans le cadre de l’organisation du concours et a pour finalité la gestion des candidatures, la centralisation des votes, le suivi administratif du concours et la communication avec les utilisateurs.',
    ],
  },
  {
    title: '2. Acceptation des conditions',
    paragraphs: [
      'Toute navigation sur la plateforme, toute création de compte et toute opération de vote impliquent l’acceptation pleine et entière des présentes Conditions d’utilisation.',
      'L’utilisateur déclare disposer de la capacité juridique nécessaire pour utiliser le service. Lorsqu’un utilisateur agit pour le compte d’un tiers ou d’une organisation, il garantit être dûment habilité à cet effet.',
    ],
  },
  {
    title: '3. Accès et disponibilité',
    paragraphs: [
      'La plateforme est accessible en ligne, sous réserve des contraintes techniques habituelles liées à Internet, aux équipements des utilisateurs, aux opérateurs de télécommunications et aux maintenances nécessaires au bon fonctionnement du service.',
      'L’organisateur s’efforce d’assurer une disponibilité raisonnable du service, sans pouvoir garantir une accessibilité continue, exempte d’erreurs ou d’interruptions. Des suspensions temporaires peuvent intervenir notamment pour des raisons de sécurité, de maintenance, de mise à jour ou de prévention de la fraude.',
    ],
  },
  {
    title: '4. Création et gestion de compte',
    paragraphs: [
      'Certaines fonctionnalités de la plateforme peuvent nécessiter la création d’un compte personnel. L’utilisateur s’engage à fournir des informations exactes, complètes et régulièrement mises à jour.',
      'Les identifiants de connexion sont strictement personnels. L’utilisateur demeure responsable de la conservation de ses accès et de toute utilisation réalisée depuis son compte, sauf preuve d’un usage frauduleux indépendant de sa volonté signalé sans délai à l’organisateur.',
    ],
  },
  {
    title: '5. Règles applicables au vote',
    paragraphs: [
      'Le vote en faveur d’un candidat est subordonné au paiement préalable du montant affiché sur la plateforme au moment de l’opération. Un vote n’est pris en compte qu’après validation effective du paiement par le prestataire de paiement et confirmation par les mécanismes internes de contrôle de la plateforme.',
      'Chaque paiement validé correspond au nombre de voix indiqué au moment de la transaction. Tant que le paiement n’est pas confirmé, la plateforme peut afficher un statut en attente ou refuser de comptabiliser l’opération.',
      'L’organisateur se réserve le droit d’encadrer la fréquence des votes, de limiter certaines opérations et de refuser ou neutraliser tout vote dont l’origine, le montant, la répétition ou le contexte laisseraient raisonnablement penser à une manipulation ou à une fraude.',
    ],
  },
  {
    title: '6. Paiements via FedaPay',
    paragraphs: [
      'Les paiements sont traités par FedaPay, prestataire externe spécialisé dans l’encaissement en ligne. La plateforme ne conserve aucune donnée bancaire ou financière sensible de l’utilisateur, ces informations étant directement traitées par l’interface de paiement sécurisée du prestataire.',
      'En cas d’échec, d’abandon, d’expiration ou d’incohérence du paiement, la voix correspondante n’est pas automatiquement validée. La prise en compte du vote dépend de l’état final confirmé de la transaction.',
      'Les remboursements, annulations ou régularisations éventuels sont appréciés au cas par cas, au regard des règles du concours, de l’état réel de la transaction et des contrôles anti-fraude mis en œuvre.',
    ],
  },
  {
    title: '7. Comportements interdits et lutte contre la fraude',
    paragraphs: [
      'Il est strictement interdit d’utiliser la plateforme à des fins illicites, de contourner les mesures de sécurité, d’automatiser des opérations de vote sans autorisation, d’usurper une identité, d’utiliser des moyens de paiement non autorisés, de perturber le service ou de tenter d’altérer les résultats du concours.',
      'L’organisateur peut procéder à toute vérification utile en présence d’indices sérieux de fraude, d’abus, de tentative de double comptabilisation, d’anomalie transactionnelle, d’usage de faux comptes ou de comportements contraires à l’intégrité du concours.',
    ],
  },
  {
    title: '8. Suspension, restriction ou suppression de compte',
    paragraphs: [
      'En cas de manquement aux présentes Conditions, de risque pour la sécurité du service, de suspicion de fraude ou d’obligation légale, l’organisateur peut suspendre temporairement ou définitivement l’accès à un compte, restreindre certaines fonctionnalités ou invalider des opérations litigieuses.',
      'Cette mesure peut intervenir sans préavis lorsqu’une intervention immédiate est nécessaire pour préserver la sécurité du service, la sincérité des votes ou les intérêts des participants et des utilisateurs.',
    ],
  },
  {
    title: '9. Responsabilité de l’utilisateur',
    paragraphs: [
      'L’utilisateur est seul responsable de l’usage qu’il fait de la plateforme, des informations qu’il fournit, de la conformité de ses paiements, du respect des lois applicables et de la confidentialité de ses accès.',
      'Il lui appartient également de vérifier la compatibilité de ses équipements, la qualité de sa connexion et l’exactitude des informations saisies avant toute opération de vote ou de gestion de compte.',
    ],
  },
  {
    title: '10. Limitation de responsabilité',
    paragraphs: [
      'L’organisateur ne saurait être tenu responsable des dommages indirects, pertes d’exploitation, pertes d’opportunité, interruptions de service imputables à un tiers, indisponibilités du réseau Internet, défaillances d’opérateurs télécoms, incidents affectant les services externes ou comportements fautifs d’utilisateurs.',
      'La responsabilité de l’organisateur ne peut être recherchée au titre d’un vote non validé lorsque la transaction n’a pas été confirmée, lorsque les informations saisies sont erronées, ou lorsqu’une opération a été bloquée pour des raisons de sécurité ou de conformité.',
    ],
  },
  {
    title: '11. Propriété intellectuelle',
    paragraphs: [
      'Les contenus présents sur la plateforme, notamment les textes, visuels, logos, éléments graphiques, bases de données, interfaces et contenus éditoriaux, restent protégés par les règles applicables en matière de propriété intellectuelle.',
      'Toute reproduction, extraction, réutilisation ou exploitation non autorisée, totale ou partielle, est interdite sauf accord préalable écrit de l’organisateur ou des ayants droit concernés.',
    ],
  },
  {
    title: '12. Modification des conditions',
    paragraphs: [
      'Les présentes Conditions peuvent être modifiées à tout moment afin de tenir compte de l’évolution du concours, du service, des contraintes techniques, des règles d’organisation ou des exigences légales et réglementaires applicables.',
      'La version en vigueur est celle publiée sur la plateforme à la date de consultation. En cas de modification substantielle, l’organisateur peut, lorsque cela est pertinent, en informer les utilisateurs par les moyens habituels de communication du service.',
    ],
  },
  {
    title: '13. Droit applicable et règlement des différends',
    paragraphs: [
      'Les présentes Conditions sont soumises au droit béninois, notamment aux règles applicables au numérique, aux services en ligne, à la protection des données et aux transactions électroniques en République du Bénin.',
      'En cas de difficulté, les parties s’efforceront de rechercher une solution amiable. À défaut d’accord amiable, le différend relève de la compétence des juridictions béninoises territorialement compétentes, sauf disposition impérative contraire.',
    ],
  },
];

const Terms = () => {
  return (
    <div className="legal-page">
      <section className="legal-hero">
        <div className="legal-hero-bg" aria-hidden="true">
          <div className="legal-orb orb-1" />
          <div className="legal-orb orb-2" />
        </div>
        <div className="container">
          <div className="legal-hero-content">
            <span className="page-eyebrow">Cadre juridique du service</span>
            <h1>Conditions d’utilisation</h1>
            <p>
              Ce document encadre l’utilisation de la plateforme officielle de vote du concours
              Miss &amp; Mister University Bénin.
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
                  Ces conditions s’appliquent à l’accès au site, aux comptes utilisateurs et aux votes payants
                  réalisés via FedaPay.
                </p>
              </div>

              <div className="legal-contact-card">
                <h3>Besoin d’un renseignement ?</h3>
                <p>Pour toute question relative à l’utilisation de la plateforme :</p>
                <a href={`mailto:${PROJECT_EMAIL}`}>{PROJECT_EMAIL}</a>
                <span>{PROJECT_PHONE_DISPLAY}</span>
                <Link to="/contact" className="btn-gold-sm">Nous contacter</Link>
              </div>
            </aside>

            <div className="legal-main">
              <div className="legal-intro-card">
                <p>
                  Les présentes Conditions d’utilisation régissent les relations entre l’organisateur du concours,
                  les visiteurs, les utilisateurs titulaires d’un compte et toute personne réalisant une opération
                  de vote sur la plateforme.
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

export default Terms;
