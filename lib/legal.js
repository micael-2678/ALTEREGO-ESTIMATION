/**
 * Informations légales et RGPD affichées par l'outil (mentions légales, politique de
 * confidentialité, information sous le formulaire).
 *
 * ⚠️ À COMPLÉTER avec les informations exactes d'AlterEgo (Kbis, contrat d'hébergement).
 * Chaque valeur peut aussi être définie par une variable d'environnement NEXT_PUBLIC_LEGAL_*
 * (lue au moment du build). Les champs encore vides s'affichent « [à compléter] » et sont
 * signalés dans l'admin (page État du service).
 */

const env = (key, fallback = '') => process.env[`NEXT_PUBLIC_LEGAL_${key}`] || fallback;

export const LEGAL = {
  // Éditeur et responsable du traitement
  companyName: env('COMPANY_NAME', 'AlterEgo Patrimoine'),
  legalForm: env('LEGAL_FORM'),            // ex. « SAS au capital de 10 000 € »
  address: env('ADDRESS'),                 // adresse du siège social
  registration: env('REGISTRATION'),       // ex. « RCS Paris 123 456 789 »
  professionalCard: env('PROFESSIONAL_CARD'), // carte professionnelle (loi Hoguet), si applicable
  publicationDirector: env('PUBLICATION_DIRECTOR'),
  contactEmail: env('CONTACT_EMAIL'),      // adresse pour exercer ses droits RGPD
  dpoEmail: env('DPO_EMAIL'),              // délégué à la protection des données, s'il existe

  // Hébergement de l'outil et de la base de données
  host: env('HOST', 'OVH SAS, 2 rue Kellermann, 59100 Roubaix, France'),

  // Durées de conservation
  leadRetentionMonths: Number(env('LEAD_RETENTION_MONTHS', '36')),
  cookieConsentMonths: 6,

  // Version du texte de consentement (enregistrée avec chaque lead, preuve du consentement)
  consentVersion: '2026-09-30'
};

export const LEGAL_REQUIRED_FIELDS = ['legalForm', 'address', 'registration', 'publicationDirector', 'contactEmail'];

export function missingLegalFields() {
  return LEGAL_REQUIRED_FIELDS.filter(key => !LEGAL[key]);
}

export function legalValue(key) {
  return LEGAL[key] || '[à compléter]';
}

// Textes de consentement du formulaire (enregistrés tels quels avec le lead)
export const CONSENT_TEXTS = {
  service: `J'accepte que ${LEGAL.companyName} utilise mes coordonnées pour me transmettre mon estimation et me recontacter au sujet de mon projet immobilier.`,
  marketing: `J'accepte de recevoir par email des conseils et offres immobilières de ${LEGAL.companyName}. Je peux me désinscrire à tout moment.`
};
