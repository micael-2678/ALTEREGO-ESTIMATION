'use client'

import dynamic from 'next/dynamic';
import { ArrowRight } from 'lucide-react';

// Blocs communs aux pages de résultats (vente et location)

const EstimationMap = dynamic(() => import('@/components/EstimationMap'), {
  ssr: false,
  loading: () => <div className="h-96 w-full rounded-card bg-ae-sand animate-pulse" />
});

export const SITE_URL = process.env.NEXT_PUBLIC_MAIN_SITE_URL || 'https://alteregopatrimoine.com';
export const CONTACT_URL = process.env.NEXT_PUBLIC_CONTACT_URL || SITE_URL;

export const formatEuros = (value) =>
  `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value)} €`;

export const formatDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
};

export const confidenceLabel = (confidence) =>
  confidence >= 80 ? 'Élevée' : confidence >= 70 ? 'Bonne' : confidence >= 55 ? 'Moyenne' : 'Faible';

export function SalesMapCard({ center, radius, sales, title = 'Carte des ventes' }) {
  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6 mb-8">
      <div className="ae-card p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 px-1">
          <h2 className="ae-h3">{title}</h2>
          <div className="flex gap-5 text-sm text-ae-muted">
            <span className="inline-flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-ae-brique" /> Votre bien</span>
            <span className="inline-flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-ae-ink" /> Ventes DVF</span>
          </div>
        </div>
        <EstimationMap center={center} radius={radius} dvfSales={sales} />
      </div>
    </section>
  );
}

export function CallToAction({
  onReset,
  disclaimer,
  title = 'Affinez cette estimation avec un conseiller AlterEgo',
  text = "Une visite permet de prendre en compte ce que les données ne voient pas : luminosité, prestations, copropriété, potentiel. C'est gratuit et sans engagement."
}) {
  return (
    <section className="bg-ae-sand py-12 sm:py-16">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 text-center">
        <p className="ae-eyebrow mb-4">Aller plus loin</p>
        <h2 className="ae-h2 mb-5">{title}</h2>
        <p className="text-ae-muted text-lg max-w-2xl mx-auto mb-8">{text}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a href={CONTACT_URL} target="_top" className="ae-btn ae-btn-brique">
            Prendre rendez-vous <ArrowRight className="w-5 h-5" />
          </a>
          <button type="button" onClick={onReset} className="ae-btn ae-btn-outline">
            Nouvelle estimation
          </button>
        </div>
        {disclaimer && <p className="text-xs text-ae-muted mt-8 max-w-2xl mx-auto">{disclaimer}</p>}
      </div>
    </section>
  );
}
