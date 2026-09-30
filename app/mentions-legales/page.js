import LegalPage from '@/components/LegalPage';
import { LEGAL, legalValue } from '@/lib/legal';

export const metadata = {
  title: 'Mentions légales — AlterEgo Patrimoine',
  robots: { index: false }
};

export default function MentionsLegales() {
  return (
    <LegalPage eyebrow="Informations légales" title="Mentions légales" updated="30 septembre 2026">
      <h2>Éditeur</h2>
      <p>
        <strong>{LEGAL.companyName}</strong><br />
        {legalValue('legalForm')}<br />
        Siège social : {legalValue('address')}<br />
        Immatriculation : {legalValue('registration')}<br />
        {LEGAL.professionalCard && <>Carte professionnelle : {LEGAL.professionalCard}<br /></>}
        Contact : {LEGAL.contactEmail ? <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a> : '[à compléter]'}
      </p>

      <h2>Directeur de la publication</h2>
      <p>{legalValue('publicationDirector')}</p>

      <h2>Hébergement</h2>
      <p>{LEGAL.host}</p>

      <h2>Estimations</h2>
      <p>
        Les estimations sont calculées automatiquement à partir des données publiques « Demandes de valeurs
        foncières » (DVF) publiées par la DGFiP sur data.gouv.fr (Licence Ouverte), et des caractéristiques
        déclarées. Ce sont des valeurs indicatives, non contractuelles, qui ne constituent ni une expertise ni
        un avis de valeur au sens de la réglementation.
      </p>

      <h2>Propriété intellectuelle</h2>
      <p>
        La marque, le logo et les contenus de ce site sont la propriété de {LEGAL.companyName}. Les polices
        Bricolage Grotesque et Instrument Sans sont distribuées sous licence SIL Open Font License. Les fonds de
        carte sont fournis par OpenStreetMap (ODbL) et CARTO.
      </p>

      <h2>Données personnelles</h2>
      <p>
        Le traitement de vos données est décrit dans notre <a href="/confidentialite">politique de confidentialité</a>.
      </p>
    </LegalPage>
  );
}
