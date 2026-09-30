import SiteFooter from '@/components/SiteFooter';
import { missingLegalFields } from '@/lib/legal';

// Mise en page commune aux pages légales (charte AlterEgo)
export default function LegalPage({ eyebrow, title, updated, children }) {
  const missing = missingLegalFields();
  return (
    <div className="min-h-screen flex flex-col bg-ae-paper text-ae-ink">
      <header className="border-b border-ae-line">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 sm:h-20 flex items-center">
          <a href="/" aria-label="Retour à l'estimation">
            <img src="/brand/logo-alterego-noir.png" alt="AlterEgo" className="h-10 sm:h-12 w-auto" />
          </a>
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-3xl px-4 sm:px-6 py-12 sm:py-16">
        <p className="ae-eyebrow mb-4">{eyebrow}</p>
        <h1 className="ae-h2 mb-3">{title}</h1>
        <p className="text-sm text-ae-muted mb-10">Dernière mise à jour : {updated}</p>
        {missing.length > 0 && (
          <p className="mb-8 p-4 rounded-2xl border border-ae-brique/40 bg-ae-brique/5 text-sm text-ae-brique">
            Informations légales incomplètes : les champs « [à compléter] » doivent être renseignés
            dans lib/legal.js avant la mise en ligne.
          </p>
        )}
        <div className="legal-prose">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}
