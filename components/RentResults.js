'use client'

import { AlertTriangle, Ban, Info } from 'lucide-react';
import { formatEuros, confidenceLabel, SalesMapCard, CallToAction } from '@/components/results-shared';

// Page de résultats d'une estimation de loyer

const formatPerM2 = (value) =>
  `${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value)} €/m²`;

const formatPercent = (value) =>
  `${value > 0 ? '+' : ''}${value.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;

const NOTICE_STYLES = {
  blocking: { icon: Ban, box: 'border-ae-brique bg-ae-brique/5', title: 'text-ae-brique' },
  warning: { icon: AlertTriangle, box: 'border-ae-line bg-ae-sand', title: 'text-ae-ink' },
  info: { icon: Info, box: 'border-ae-line bg-white', title: 'text-ae-ink' }
};

export default function RentResults({ results, formData, onReset }) {
  const { rent, finalPrice, dvf } = results;
  const rooms = parseInt(formData.rooms, 10);
  const subtitle = [
    formData.type === 'maison' ? 'Maison' : 'Appartement',
    `${formData.surface} m²`,
    rooms ? `${rooms} pièce${rooms > 1 ? 's' : ''}` : null,
    rent.furnished ? 'Location meublée' : 'Location vide'
  ].filter(Boolean).join(' · ');

  const ctaText = "Une visite permet de prendre en compte ce que les données ne voient pas : luminosité, prestations, " +
    "copropriété, demande locative du secteur. C'est gratuit et sans engagement.";

  if (!rent.available) {
    return (
      <div>
        <Heading address={formData.address} subtitle={subtitle} />
        <section className="mx-auto max-w-6xl px-4 sm:px-6 mb-8">
          <div className="ae-card p-6 sm:p-10">
            <p className="ae-eyebrow mb-3">Loyer à affiner</p>
            <h2 className="ae-h3 mb-3">Pas de référence de loyer pour ce secteur</h2>
            <p className="text-ae-muted max-w-2xl">{rent.warning}</p>
          </div>
        </section>
        {finalPrice && <SaleValueCard finalPrice={finalPrice} dvf={dvf} />}
        <CallToAction onReset={onReset} disclaimer={results.disclaimer} text={ctaText} />
      </div>
    );
  }

  const { monthly, market, legal } = rent;
  const confidence = rent.confidence ?? 0;
  const adjustmentsSum = market.adjustments.reduce((sum, a) => sum + a.impact, 0);
  const blocking = legal.notices.filter(n => n.level === 'blocking');
  const otherNotices = legal.notices.filter(n => n.level !== 'blocking');

  return (
    <div>
      <Heading address={formData.address} subtitle={subtitle} />

      {/* Bande sombre : loyer */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 mb-8">
        <div className="rounded-card bg-ae-ink text-ae-paper p-6 sm:p-12">
          <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-10 items-end">
            <div>
              <p className="ae-eyebrow !text-ae-paper/60 mb-4">Loyer estimé</p>
              <p className="font-display font-extrabold tracking-tight leading-none text-[clamp(2.75rem,7vw,5.5rem)]">
                {formatEuros(monthly.exclCharges)}
                <span className="text-[0.38em] font-semibold text-ae-paper/70 ml-2">/ mois</span>
              </p>
              <p className="mt-3 text-ae-paper/75">Hors charges{rent.furnished ? ', meublé' : ''}</p>
              <p className="mt-5 text-ae-paper/75 text-lg">
                Fourchette : <strong className="text-ae-paper">{formatEuros(monthly.low)}</strong> à{' '}
                <strong className="text-ae-paper">{formatEuros(monthly.high)}</strong> par mois
              </p>
              {legal.applied && (
                <p className="mt-4 text-sm text-ae-paper/75">
                  Loyer de marché estimé à {formatEuros(market.monthly)} : plafonné par la loi ({legal.applied.label.toLowerCase()}).
                </p>
              )}
            </div>

            <dl className="grid grid-cols-2 gap-6 lg:border-l lg:border-ae-paper/15 lg:pl-10">
              <div>
                <dt className="text-sm text-ae-paper/60 mb-1">Charges comprises</dt>
                <dd className="font-display text-2xl">≈ {formatEuros(monthly.inclCharges)}</dd>
                <p className="text-xs text-ae-paper/60 mt-1">dont ≈ {formatEuros(monthly.charges)} de charges</p>
              </div>
              <div>
                <dt className="text-sm text-ae-paper/60 mb-1">Loyer au m²</dt>
                <dd className="font-display text-2xl">{formatPerM2(monthly.perM2ExclCharges)}</dd>
                <p className="text-xs text-ae-paper/60 mt-1">hors charges</p>
              </div>
              <div>
                <dt className="text-sm text-ae-paper/60 mb-1">Fiabilité</dt>
                <dd className="font-display text-2xl">{confidenceLabel(confidence)}</dd>
                <div className="mt-2 h-1 rounded-full bg-ae-paper/15 overflow-hidden">
                  <div className="h-full bg-ae-brique" style={{ width: `${confidence}%` }} />
                </div>
              </div>
              {monthly.parking > 0 ? (
                <div>
                  <dt className="text-sm text-ae-paper/60 mb-1">Stationnement</dt>
                  <dd className="font-display text-2xl">+ {formatEuros(monthly.parking)}</dd>
                  <p className="text-xs text-ae-paper/60 mt-1">loué en plus, par mois</p>
                </div>
              ) : rent.yield ? (
                <div>
                  <dt className="text-sm text-ae-paper/60 mb-1">Rendement brut</dt>
                  <dd className="font-display text-2xl">{rent.yield.gross.toLocaleString('fr-FR')} %</dd>
                  <p className="text-xs text-ae-paper/60 mt-1">sur la valeur de vente estimée</p>
                </div>
              ) : null}
              <div className="col-span-2 text-sm text-ae-paper/60">Source : {rent.source.label}.</div>
            </dl>
          </div>
        </div>
      </section>

      {blocking.map(notice => (
        <div key={notice.code} className="mx-auto max-w-6xl px-4 sm:px-6 mb-8">
          <Notice notice={notice} />
        </div>
      ))}

      {rent.warning && (
        <div className="mx-auto max-w-6xl px-4 sm:px-6 mb-8">
          <p className="p-4 rounded-2xl bg-ae-sand text-sm text-ae-muted">{rent.warning}</p>
        </div>
      )}

      <div className="mx-auto max-w-6xl px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Détail du calcul */}
        <section className="ae-card p-6 sm:p-8">
          <h2 className="ae-h3 mb-6">Comment nous l'avons calculé</h2>

          <ul className="pb-2 border-b border-ae-line">
            {market.references.map(ref => (
              <li key={ref.code} className="flex justify-between items-baseline gap-4 pb-3">
                <div>
                  <p className="font-semibold">{ref.label}</p>
                  <p className="text-sm text-ae-muted">{ref.detail}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-display text-lg">{formatPerM2(ref.perM2)}</p>
                  <p className="text-xs text-ae-muted">{ref.unit.replace('€/m² ', '')}</p>
                </div>
              </li>
            ))}
          </ul>

          <ul>
            {market.steps.map(step => (
              <li key={step.code} className="flex justify-between items-center gap-4 py-3 border-b border-ae-line">
                <div>
                  <p className="font-medium">{step.label}</p>
                  <p className="text-sm text-ae-muted">{step.description}</p>
                </div>
                <span className={`font-semibold tabular-nums text-right shrink-0 ${
                  (step.impact ?? step.perM2) > 0 ? 'text-ae-ink' : (step.impact ?? step.perM2) < 0 ? 'text-ae-brique' : 'text-ae-muted'
                }`}>
                  {step.impact !== undefined
                    ? formatPercent(step.impact)
                    : `${step.perM2 > 0 && step.code !== 'base' ? '+' : ''}${formatPerM2(step.perM2)}`}
                </span>
              </li>
            ))}
            {market.adjustments.map((adj, idx) => (
              <li key={`adj-${idx}`} className="flex justify-between items-center gap-4 py-3 border-b border-ae-line">
                <div>
                  <p className="font-medium">{adj.factor}</p>
                  <p className="text-sm text-ae-muted">{adj.description}</p>
                </div>
                <span className={`font-semibold tabular-nums ${adj.impact > 0 ? 'text-ae-ink' : adj.impact < 0 ? 'text-ae-brique' : 'text-ae-muted'}`}>
                  {formatPercent(adj.impact)}
                </span>
              </li>
            ))}
          </ul>
          {Math.abs(adjustmentsSum - market.totalAdjustmentPercent) > 0.15 && (
            <p className="text-sm text-ae-muted pt-3">Le cumul des caractéristiques est plafonné pour rester proche du marché local.</p>
          )}
          <div className="flex justify-between items-baseline gap-4 pt-4">
            <span className="font-semibold">Loyer de marché retenu</span>
            <span className="font-display text-lg text-right">
              {formatPerM2(market.perM2ExclCharges)} <span className="text-sm text-ae-muted font-sans">hors charges</span>
            </span>
          </div>
        </section>

        {/* Cadre légal */}
        <section className="ae-card p-6 sm:p-8">
          <h2 className="ae-h3 mb-6">Ce que dit la loi</h2>
          {legal.notices.length === 0 ? (
            <p className="text-ae-muted">
              Aucune contrainte particulière identifiée : le loyer est fixé librement à la signature du bail, puis révisable une fois
              par an selon l'indice de référence des loyers (IRL) si le bail le prévoit.
            </p>
          ) : (
            <ul className="space-y-3">
              {otherNotices.map(notice => (
                <li key={notice.code}><Notice notice={notice} compact /></li>
              ))}
              {blocking.map(notice => (
                <li key={notice.code}><Notice notice={notice} compact /></li>
              ))}
            </ul>
          )}
          {legal.caps.length > 0 && (
            <div className="mt-6 pt-4 border-t border-ae-line">
              <p className="font-semibold mb-2">Plafonds pris en compte</p>
              <ul className="space-y-2">
                {legal.caps.map(cap => (
                  <li key={cap.code} className="flex justify-between items-baseline gap-4 text-sm">
                    <span className="text-ae-muted">
                      {cap.label}
                      {legal.applied?.code === cap.code && <span className="ml-2 ae-eyebrow !text-[0.65rem]">appliqué</span>}
                    </span>
                    <span className="font-semibold tabular-nums shrink-0">{formatEuros(cap.monthly)} / mois</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      {finalPrice && (
        <div className="mx-auto max-w-6xl px-4 sm:px-6 mb-8">
          <SaleValueCard finalPrice={finalPrice} dvf={dvf} grossYield={rent.yield?.gross} />
        </div>
      )}

      {dvf?.comparables?.length > 0 && (
        <SalesMapCard center={[formData.lat, formData.lng]} radius={dvf.radius} sales={dvf.comparables} title="Ventes récentes autour du bien" />
      )}

      <CallToAction onReset={onReset} disclaimer={results.disclaimer} text={ctaText} />
    </div>
  );
}

function Heading({ address, subtitle }) {
  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6 mb-8">
      <p className="ae-eyebrow mb-3">Estimation de loyer</p>
      <h1 className="ae-h2 mb-2">{address}</h1>
      <p className="text-ae-muted">{subtitle}</p>
    </section>
  );
}

function Notice({ notice, compact = false }) {
  const style = NOTICE_STYLES[notice.level] || NOTICE_STYLES.info;
  const Icon = style.icon;
  return (
    <div role={notice.level === 'blocking' ? 'alert' : undefined}
      className={`flex gap-3 rounded-2xl border ${style.box} ${compact ? 'p-4' : 'p-5 sm:p-6'}`}>
      <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${notice.level === 'blocking' ? 'text-ae-brique' : 'text-ae-muted'}`} />
      <div>
        <p className={`font-semibold ${style.title}`}>{notice.title}</p>
        <p className="text-sm text-ae-muted leading-relaxed mt-1">{notice.text}</p>
      </div>
    </div>
  );
}

function SaleValueCard({ finalPrice, dvf, grossYield }) {
  return (
    <section className="ae-card p-6 sm:p-8">
      <h2 className="ae-h3 mb-2">Valeur de vente et rendement</h2>
      <p className="text-sm text-ae-muted mb-6">
        Calculée à partir des ventes réelles (DVF) autour du bien
        {dvf?.count > 0 ? ` : ${dvf.count} vente${dvf.count > 1 ? 's' : ''} dans un rayon de ${dvf.radius} m.` : '.'}
      </p>
      <dl className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div>
          <dt className="text-sm text-ae-muted mb-1">Valeur estimée</dt>
          <dd className="font-display text-2xl">{formatEuros(finalPrice.mid)}</dd>
        </div>
        <div>
          <dt className="text-sm text-ae-muted mb-1">Fourchette</dt>
          <dd className="font-display text-2xl">{formatEuros(finalPrice.low)} – {formatEuros(finalPrice.high)}</dd>
        </div>
        {grossYield !== undefined && grossYield !== null && (
          <div>
            <dt className="text-sm text-ae-muted mb-1">Rendement locatif brut</dt>
            <dd className="font-display text-2xl">{grossYield.toLocaleString('fr-FR')} %</dd>
            <p className="text-xs text-ae-muted mt-1">loyer annuel hors charges ÷ valeur estimée</p>
          </div>
        )}
      </dl>
    </section>
  );
}
