'use client'

import { openCookieSettings } from '@/components/CookieConsent';

export default function SiteFooter() {
  return (
    <footer className="bg-ae-ink text-ae-paper">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 flex flex-col sm:flex-row gap-6 sm:items-center sm:justify-between">
        <img src="/brand/logo-alterego-blanc.png" alt="AlterEgo" className="h-10 w-auto self-start" />
        <div className="text-sm text-ae-paper/70 sm:text-right space-y-2">
          <nav className="flex flex-wrap gap-x-5 gap-y-1 sm:justify-end" aria-label="Informations légales">
            <a href="/mentions-legales" className="hover:text-ae-paper underline-offset-4 hover:underline">Mentions légales</a>
            <a href="/confidentialite" className="hover:text-ae-paper underline-offset-4 hover:underline">Confidentialité</a>
            <button type="button" onClick={openCookieSettings} className="hover:text-ae-paper underline-offset-4 hover:underline">
              Gérer les cookies
            </button>
          </nav>
          <p>© {new Date().getFullYear()} AlterEgo Patrimoine. Tous droits réservés.</p>
          <p>Estimations basées sur DVF (open data) — valeurs indicatives, non contractuelles.</p>
        </div>
      </div>
    </footer>
  );
}
