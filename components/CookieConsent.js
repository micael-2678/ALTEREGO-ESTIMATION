'use client'

import { useEffect, useState } from 'react';
import { LEGAL } from '@/lib/legal';

const STORAGE_KEY = 'ae-cookie-consent';
const GTM_ID = 'GTM-MVZ2NFKR';
const ADS_ID = 'AW-17772583118';
const ADS_CONVERSION = 'AW-17772583118/Qdm9CNLhnssbEM6x0JpC';
export const OPEN_COOKIE_SETTINGS_EVENT = 'ae:open-cookie-settings';

function readChoice() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!stored?.value || !stored.at) return null;
    // Le choix est redemandé au bout de 6 mois (recommandation CNIL)
    const ageMonths = (Date.now() - new Date(stored.at).getTime()) / (30.44 * 24 * 3600 * 1000);
    return ageMonths < LEGAL.cookieConsentMonths ? stored.value : null;
  } catch {
    return null;
  }
}

function saveChoice(value) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ value, at: new Date().toISOString() }));
  } catch {
    // Stockage indisponible (navigation privée) : le bandeau sera simplement redemandé
  }
}

// Google Tag Manager et Google Ads ne sont chargés qu'après accord explicite
let trackersLoaded = false;
function loadTrackers() {
  if (trackersLoaded) return;
  trackersLoaded = true;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', ADS_ID);
  window.gtag_report_conversion = () => {
    window.gtag('event', 'conversion', { send_to: ADS_CONVERSION });
    return false;
  };
  window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });

  for (const src of [
    `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`,
    `https://www.googletagmanager.com/gtag/js?id=${ADS_ID}`
  ]) {
    const script = document.createElement('script');
    script.async = true;
    script.src = src;
    document.head.appendChild(script);
  }
}

export function openCookieSettings() {
  window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS_EVENT));
}

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // En iframe sur alteregopatrimoine.com, c'est le site parent qui gère le consentement
    // et la mesure d'audience (il reçoit l'événement « alterego-estimation:step »).
    const embedded = new URLSearchParams(window.location.search).get('embed') === '1' || window.self !== window.top;
    // L'administration (usage interne) n'embarque aucun traceur publicitaire
    const isAdmin = window.location.pathname.startsWith('/admin');
    if (embedded || isAdmin) return undefined;

    const choice = readChoice();
    if (choice === 'granted') loadTrackers();
    if (!choice) setVisible(true);

    const reopen = () => setVisible(true);
    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, reopen);
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, reopen);
  }, []);

  const decide = (value) => {
    saveChoice(value);
    setVisible(false);
    if (value === 'granted') {
      loadTrackers();
    } else if (trackersLoaded) {
      // Retrait du consentement : on recharge la page pour décharger les traceurs
      window.location.reload();
    }
  };

  if (!visible) return null;

  return (
    <div role="dialog" aria-modal="false" aria-labelledby="cookie-title"
      className="fixed inset-x-0 bottom-0 z-50 p-4 sm:p-6 pointer-events-none">
      <div className="pointer-events-auto mx-auto max-w-3xl ae-card shadow-2xl p-5 sm:p-6">
        <p id="cookie-title" className="font-semibold mb-2">Cookies et mesure d'audience</p>
        <p className="text-sm text-ae-muted leading-relaxed">
          Avec votre accord, nous utilisons des cookies Google (Tag Manager et Google Ads) pour mesurer
          l'efficacité de nos campagnes. Ils ne sont pas nécessaires au fonctionnement de l'estimation.
          Vous pouvez changer d'avis à tout moment via « Gérer les cookies » en bas de page.{' '}
          <a href="/confidentialite#cookies" className="underline underline-offset-2 hover:text-ae-brique">En savoir plus</a>
        </p>
        <div className="mt-4 flex flex-col sm:flex-row gap-3 sm:justify-end">
          {/* Refuser est aussi simple et visible qu'accepter (CNIL) */}
          <button type="button" onClick={() => decide('denied')} className="ae-btn ae-btn-outline min-h-0 py-2.5">
            Tout refuser
          </button>
          <button type="button" onClick={() => decide('granted')} className="ae-btn ae-btn-ink min-h-0 py-2.5">
            Tout accepter
          </button>
        </div>
      </div>
    </div>
  );
}
