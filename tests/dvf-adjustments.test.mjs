import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateAdjustments, calculateAdjustedPrice, calculateConfidence, getUncertaintyBand } from '../lib/dvf-adjustments.js';

const dvf = (overrides = {}) => ({
  count: 12,
  radius: 500,
  months: 24,
  stats: { stdDev: 1000, medianPricePerM2: 10000, weightedAverage: 10000 },
  ...overrides
});

test('confiance : beaucoup de ventes proches et récentes = élevée', () => {
  assert.ok(calculateConfidence(dvf({ count: 20, radius: 400, months: 12 })) >= 85);
});

test('confiance : une seule vente ne peut plus afficher 65 %', () => {
  const confidence = calculateConfidence(dvf({ count: 1, radius: 800, months: 36 }));
  assert.ok(confidence < 50, `confiance ${confidence}`);
});

test('confiance : la dispersion des prix est bien pénalisée', () => {
  const homogeneous = calculateConfidence(dvf());
  const dispersed = calculateConfidence(dvf({ stats: { stdDev: 6000, medianPricePerM2: 10000 } }));
  assert.equal(homogeneous - dispersed, 8);
});

test('fourchette : plus large quand la confiance baisse', () => {
  assert.equal(getUncertaintyBand(90), 0.06);
  assert.equal(getUncertaintyBand(72), 0.08);
  assert.equal(getUncertaintyBand(40), 0.13);
});

test('ajustements : DPE G et vis-à-vis baissent le prix', () => {
  const result = calculateAdjustments({ type: 'appartement', surface: 60, dpe: 'G', view: 'vis_a_vis' }, dvf());
  assert.ok(result.totalImpact < 0);
});

test('ajustements : bornes anti-dérive respectées', () => {
  const result = calculateAdjustments({
    type: 'appartement', surface: 30, floor: '4+', hasElevator: true, outside: 'large_terrace_or_garden',
    view: 'exceptionnelle', parking: 'box_or_two', condition: 'renovated', dpe: 'A'
  }, dvf({ count: 20 }));
  assert.ok(result.totalImpact <= 0.15 + 1e-9);
});

test('prix : fourchette cohérente autour du prix médian', () => {
  const adjustments = calculateAdjustments({ type: 'appartement', surface: 50 }, dvf());
  const price = calculateAdjustedPrice(10000, 50, adjustments, dvf());
  assert.ok(price.priceLow < price.priceMid && price.priceMid < price.priceHigh);
  assert.equal(price.priceMid, price.adjustedPricePerM2 * 50);
});
