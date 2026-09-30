import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimateAnnualTrend, toCurrentPricePerM2, summarizeComparables, calculateDistance, formatStreetName } from '../lib/dvf-enhanced.js';

const NOW = new Date('2026-09-30').getTime();
const DAY = 24 * 60 * 60 * 1000;

// Ventes réparties sur 4 ans, prix suivant une tendance donnée, avec un bruit déterministe
function syntheticSales(annualRate, count = 200, noise = 0.1) {
  return Array.from({ length: count }, (_, i) => {
    const ageYears = (i / count) * 4;
    const wobble = 1 + noise * Math.sin(i * 12.9898);
    return {
      date_mutation: new Date(NOW - ageYears * 365.25 * DAY).toISOString().split('T')[0],
      prix_m2: 10000 * Math.pow(1 + annualRate, -ageYears) * wobble
    };
  });
}

test('tendance : une baisse de 4 %/an est retrouvée', () => {
  const trend = estimateAnnualTrend(syntheticSales(-0.04), { now: NOW });
  assert.equal(trend.applied, true);
  assert.ok(Math.abs(trend.annualRate + 0.04) < 0.01, `taux ${trend.annualRate}`);
});

test('tendance : marché stable = aucune correction', () => {
  const trend = estimateAnnualTrend(syntheticSales(0, 200, 0.2), { now: NOW });
  assert.equal(trend.annualRate, 0);
});

test('tendance : trop peu de ventes = aucune correction', () => {
  const trend = estimateAnnualTrend(syntheticSales(-0.1, 20), { now: NOW });
  assert.equal(trend.applied, false);
});

test('tendance : bornée à ±15 %/an', () => {
  const trend = estimateAnnualTrend(syntheticSales(0.4), { now: NOW });
  assert.equal(trend.annualRate, 0.15);
});

test('prix ramené à aujourd\'hui', () => {
  const twoYearsAgo = new Date(NOW - 2 * 365.25 * DAY).toISOString();
  assert.ok(Math.abs(toCurrentPricePerM2(10000, twoYearsAgo, -0.05, NOW) - 9025) < 1);
  assert.equal(toCurrentPricePerM2(10000, twoYearsAgo, 0, NOW), 10000);
});

test('statistiques pondérées : les ventes proches comptent davantage', () => {
  const recent = new Date(NOW - 30 * DAY).toISOString().split('T')[0];
  const stats = summarizeComparables([
    { prix_m2_actuel: 10000, distance: 50, date_mutation: recent },
    { prix_m2_actuel: 12000, distance: 480, date_mutation: recent }
  ], { radius: 500, monthsWindow: 24, now: NOW });
  assert.equal(stats.medianPricePerM2, 11000);
  assert.ok(stats.weightedAverage < 11000);
});

test('distance : Opéra → Louvre ≈ 1 km', () => {
  const d = calculateDistance(48.8720, 2.3316, 48.8606, 2.3376);
  assert.ok(d > 1200 && d < 1400, `distance ${d}`);
});

test('noms de rue en casse normale', () => {
  assert.equal(formatStreetName('RUE DE LA CHAUSSEE D\'ANTIN'), "Rue de la Chaussee d'Antin");
});
