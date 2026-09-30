import LegalPage from '@/components/LegalPage';
import { LEGAL, legalValue } from '@/lib/legal';

export const metadata = {
  title: 'Politique de confidentialité — AlterEgo Patrimoine',
  robots: { index: false }
};

export default function Confidentialite() {
  const years = Math.round(LEGAL.leadRetentionMonths / 12);
  const contact = LEGAL.dpoEmail || LEGAL.contactEmail;

  return (
    <LegalPage eyebrow="Données personnelles" title="Politique de confidentialité" updated="30 septembre 2026">
      <p>
        Cette page explique quelles données l'outil d'estimation d'{LEGAL.companyName} collecte, pourquoi,
        combien de temps elles sont conservées et comment exercer vos droits (règlement européen 2016/679,
        « RGPD », et loi Informatique et Libertés).
      </p>

      <h2>Responsable du traitement</h2>
      <p>
        <strong>{LEGAL.companyName}</strong>, {legalValue('legalForm')}, {legalValue('address')},
        {' '}{legalValue('registration')}.<br />
        Contact pour vos données : {contact ? <a href={`mailto:${contact}`}>{contact}</a> : '[à compléter]'}
        {LEGAL.dpoEmail && ' (délégué à la protection des données)'}.
      </p>

      <h2>Données collectées</h2>
      <ul>
        <li><strong>Le bien</strong> : adresse, type, surfaces, pièces, étage, équipements, état, DPE.</li>
        <li><strong>Vos coordonnées</strong> : nom, email, téléphone mobile, projet (vendre ou acheter).</li>
        <li><strong>Vos choix</strong> : consentements donnés, avec leur date et le texte présenté.</li>
        <li><strong>Le résultat</strong> de l'estimation et, ensuite, le suivi de votre demande par nos conseillers.</li>
        <li><strong>Données techniques</strong> : adresse IP, utilisée en mémoire pour limiter les abus, sans être enregistrée.</li>
      </ul>

      <h2>Pourquoi et sur quelle base</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Finalité</th><th>Base légale</th></tr>
          </thead>
          <tbody>
            <tr><td>Calculer et vous transmettre votre estimation, vous recontacter à son sujet</td><td>Mesures précontractuelles prises à votre demande (art. 6.1.b)</td></tr>
            <tr><td>Vérifier votre téléphone par un code SMS</td><td>Intérêt légitime : éviter les fausses demandes et les abus (art. 6.1.f)</td></tr>
            <tr><td>Suivre votre demande (statut, notes de nos conseillers)</td><td>Intérêt légitime (art. 6.1.f)</td></tr>
            <tr><td>Vous envoyer des conseils et offres immobilières par email</td><td>Votre consentement, facultatif et révocable (art. 6.1.a)</td></tr>
            <tr><td>Mesurer l'efficacité de nos campagnes (Google Tag Manager, Google Ads)</td><td>Votre consentement via le bandeau cookies (art. 82 loi Informatique et Libertés)</td></tr>
            <tr><td>Protéger le service (limitation du nombre de demandes)</td><td>Intérêt légitime (art. 6.1.f)</td></tr>
          </tbody>
        </table>
      </div>
      <p>Vos données ne sont jamais vendues.</p>

      <h2>Destinataires</h2>
      <ul>
        <li>Les équipes d'{LEGAL.companyName} chargées de votre projet.</li>
        <li><strong>OVH SAS</strong> (France) : hébergement de l'outil et de la base de données.</li>
        <li><strong>Brevo</strong> (Sendinblue SAS, France) : envoi du code SMS et gestion des contacts et emails.</li>
        <li>
          <strong>Base Adresse Nationale</strong> (api-adresse.data.gouv.fr) : l'adresse saisie lui est transmise pour
          l'autocomplétion. <strong>OpenStreetMap / CARTO</strong> : affichage du fond de carte des ventes.
        </li>
        <li>
          <strong>Google Ireland Ltd</strong>, uniquement si vous acceptez les cookies. Des transferts vers les
          États-Unis sont possibles ; ils sont encadrés par le Data Privacy Framework UE–États-Unis.
        </li>
      </ul>

      <h2>Durées de conservation</h2>
      <ul>
        <li>Demande d'estimation et coordonnées : {years} ans au plus après notre dernier échange, puis suppression.</li>
        <li>Code SMS : 5 minutes. Preuve de vérification du téléphone : 30 minutes.</li>
        <li>Consentement à la prospection : jusqu'à votre désinscription.</li>
        <li>Choix du bandeau cookies : 6 mois. Cookies Google : 13 mois au plus.</li>
      </ul>

      <h2 id="cookies">Cookies et traceurs</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Nom</th><th>Rôle</th><th>Durée</th><th>Accord</th></tr>
          </thead>
          <tbody>
            <tr><td>ae-cookie-consent</td><td>Mémoriser votre choix sur les cookies (stockage local du navigateur)</td><td>6 mois</td><td>Non requis</td></tr>
            <tr><td>ae_admin</td><td>Session de l'espace d'administration (conseillers uniquement)</td><td>12 heures</td><td>Non requis</td></tr>
            <tr><td>Google Tag Manager, Google Ads (_gcl_au, …)</td><td>Mesure des conversions publicitaires</td><td>13 mois max.</td><td>Requis</td></tr>
          </tbody>
        </table>
      </div>
      <p>
        Les traceurs Google ne sont chargés qu'après un clic sur « Tout accepter ». Vous pouvez modifier votre
        choix à tout moment via le lien « Gérer les cookies » en bas de chaque page.
      </p>

      <h2>Vos droits</h2>
      <p>
        Vous pouvez demander l'accès à vos données, leur rectification, leur effacement, leur portabilité, la
        limitation du traitement, vous opposer au traitement fondé sur l'intérêt légitime, retirer votre
        consentement à tout moment et définir des directives sur le sort de vos données après votre décès.
      </p>
      <p>
        Écrivez à {contact ? <a href={`mailto:${contact}`}>{contact}</a> : '[à compléter]'} : nous répondons dans un délai
        d'un mois. Chaque email de prospection contient un lien de désinscription.
      </p>
      <p>
        Si vous estimez que vos droits ne sont pas respectés, vous pouvez adresser une réclamation à la CNIL
        (<a href="https://www.cnil.fr/fr/plaintes" target="_blank" rel="noopener noreferrer">www.cnil.fr/fr/plaintes</a>).
      </p>

      <h2>Sécurité</h2>
      <p>
        Les échanges sont chiffrés (HTTPS), le numéro de téléphone est vérifié avant tout enregistrement, l'accès à
        l'espace d'administration est protégé et limité aux conseillers d'{LEGAL.companyName}.
      </p>
    </LegalPage>
  );
}
