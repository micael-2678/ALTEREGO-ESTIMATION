import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeRent, rentCategory, constructionPeriodFromYear, surfaceFactor, districtFactor, parisReference, driftFactor
} from '../lib/rent-estimation.js';
import { legalFrame, isTenseZone } from '../lib/rent-rules.js';

const NOW = new Date('2026-11-03T12:00:00Z').getTime();

// Indicateur Carte des loyers d'une commune de petite couronne (charges comprises)
const indicator = (overrides = {}) => ({
  insee: '92012', name: 'Boulogne-Billancourt', category: 'appartement_3_plus', year: 2025, referenceDate: '2025-09-01',
  rentPerM2: 28, low: 26, high: 30, predictionLevel: 'commune', observations: { commune: 120, maille: 600 },
  ...overrides
});

// Quartier parisien : références pour 2 pièces (vide et meublé), toutes époques
const parisZone = () => ({
  city: 'paris', year: 2026, zoneId: 3, quartierId: 33, quartierName: 'Chaussée-d\'Antin',
  refs: [
    ...['avant_1946', '1946_1970', '1971_1990', 'apres_1990'].map((period, i) => ({ rooms: 2, period, furnished: false, ref: 30 + i, max: (30 + i) * 1.2, min: (30 + i) * 0.7 })),
    ...['avant_1946', '1946_1970', '1971_1990', 'apres_1990'].map((period, i) => ({ rooms: 2, period, furnished: true, ref: 34 + i, max: (34 + i) * 1.2, min: (34 + i) * 0.7 }))
  ]
});

const suburb = (overrides = {}) => computeRent({
  type: 'appartement', surface: 65, rooms: 3, furnished: false, constructionPeriod: '1971_1990',
  characteristics: { type: 'appartement', dpe: 'D' }, department: '92', indicator: indicator(), now: NOW, ...overrides
});

test('catégorie et époque de construction', () => {
  assert.equal(rentCategory('maison', 5), 'maison');
  assert.equal(rentCategory('appartement', 2), 'appartement_1_2');
  assert.equal(rentCategory('appartement', 3), 'appartement_3_plus');
  assert.equal(constructionPeriodFromYear(1930), 'avant_1946');
  assert.equal(constructionPeriodFromYear(1970), '1946_1970');
  assert.equal(constructionPeriodFromYear(1985), '1971_1990');
  assert.equal(constructionPeriodFromYear(2005), 'apres_1990');
  assert.equal(constructionPeriodFromYear(''), null);
});

test('surface : un studio se loue plus cher au m², effet borné', () => {
  assert.ok(surfaceFactor(20, 40, 0.25, 0.2) > 1.15);
  assert.equal(surfaceFactor(10, 40, 0.25, 0.2), 1.2);
  assert.ok(surfaceFactor(90, 72, 0.25, 0.2) < 1);
  assert.equal(surfaceFactor(0, 40, 0.25, 0.2), 1);
});

test('quartier : amplitude moitié moindre que les prix, bornée, ignorée si peu de ventes', () => {
  const factor = districtFactor({ localPricePerM2: 12100, communePricePerM2: 10000, localCount: 10, communeCount: 50 });
  assert.equal(Math.round(factor * 1000) / 1000, 1.1);
  assert.equal(districtFactor({ localPricePerM2: 20000, communePricePerM2: 10000, localCount: 10, communeCount: 50 }), 1.15);
  assert.equal(districtFactor({ localPricePerM2: 12000, communePricePerM2: 10000, localCount: 3, communeCount: 50 }), null);
});

test('dérive des loyers : environ 1 % par an depuis les données, jamais négative', () => {
  const drift = driftFactor('2025-09-01', NOW);
  assert.ok(drift > 1.01 && drift < 1.02, `${drift}`);
  assert.equal(driftFactor('2030-01-01', NOW), 1);
});

test('commune hors Paris : loyer cohérent, charges déduites, étapes expliquées', () => {
  const result = suburb();
  assert.equal(result.available, true);
  // 28 €/m² cc → surface 65 vs 72 (+2 %) → charges -2,5 → ≈ 26 €/m² hc → × dérive ≈ 1 720 €/mois
  assert.ok(result.monthly.exclCharges > 1600 && result.monthly.exclCharges < 1850, `${result.monthly.exclCharges}`);
  assert.equal(result.monthly.inclCharges, result.monthly.exclCharges + result.monthly.charges);
  assert.equal(result.monthly.charges, Math.round(2.5 * 65));
  assert.ok(result.monthly.low < result.monthly.exclCharges && result.monthly.exclCharges < result.monthly.high);
  assert.deepEqual(result.market.steps.map(s => s.code), ['base', 'surface', 'charges', 'drift']);
  assert.equal(result.source.kind, 'carte_loyers');
  assert.equal(result.legal.applied, null);
  assert.equal(result.legal.rentable, true);
  assert.equal(result.confidence, 72);
});

test('meublé : +12 % hors Paris ; stationnement loué à part', () => {
  const empty = suburb();
  const furnished = suburb({ furnished: true, parking: { outdoor: 1, indoor: 1 } });
  assert.equal(Math.round(furnished.monthly.exclCharges / empty.monthly.exclCharges * 100), 112);
  assert.equal(furnished.monthly.parking, 160);
  assert.ok(furnished.market.steps.some(s => s.code === 'furnished'));
});

test('quartier cher : correction DVF appliquée et confiance relevée', () => {
  const plain = suburb();
  const upscale = suburb({ dvf: { localPricePerM2: 12100, communePricePerM2: 10000, localCount: 12, communeCount: 80 } });
  assert.ok(upscale.monthly.exclCharges > plain.monthly.exclCharges * 1.08);
  assert.equal(upscale.confidence, plain.confidence + 4);
  assert.ok(upscale.market.steps.some(s => s.code === 'district'));
});

test('maille et catégorie générique : confiance abaissée', () => {
  const maille = suburb({ indicator: indicator({ predictionLevel: 'maille', observations: { commune: 2, maille: 300 } }) });
  assert.equal(maille.confidence, 50);
  const generic = suburb({ indicator: indicator({ category: 'appartement' }) });
  assert.equal(generic.confidence, 72 - 5);
  assert.ok(maille.warning);
});

test('caractéristiques : DPE F et rez-de-chaussée sans ascenseur baissent le loyer, rénové le relève', () => {
  const base = suburb();
  const worse = suburb({ characteristics: { type: 'appartement', dpe: 'F', floor: 'rdc', hasElevator: false, condition: 'to_renovate' } });
  const better = suburb({ characteristics: { type: 'appartement', dpe: 'B', condition: 'renovated', outside: 'large_terrace_or_garden' } });
  assert.ok(worse.market.monthly < base.market.monthly);
  assert.ok(better.market.monthly > base.market.monthly);
  assert.ok(worse.market.adjustments.some(a => a.factor === 'DPE' && a.impact < 0));
  assert.ok(!base.market.adjustments.some(a => a.impact === 0));
});

test('DPE G : location interdite, loyer théorique conservé', () => {
  const result = suburb({ characteristics: { type: 'appartement', dpe: 'G' } });
  assert.equal(result.legal.rentable, false);
  assert.ok(result.legal.notices.some(n => n.code === 'dpe_banned' && n.level === 'blocking'));
  assert.ok(result.monthly.exclCharges > 0);
});

test('DPE F loué : loyer gelé au dernier loyer', () => {
  const result = suburb({ characteristics: { type: 'appartement', dpe: 'F' }, previousRent: 1200, rentedRecently: true });
  assert.equal(result.monthly.exclCharges, 1200);
  assert.equal(result.legal.applied.code, 'dpe_freeze');
  assert.equal(result.monthly.high, 1200);
  assert.ok(result.monthly.low < 1200);
  assert.ok(result.legal.notices.some(n => n.code === 'dpe_freeze'));
});

test('zone tendue : loué dans les 18 mois, plafond au dernier loyer ; sans loyer connu, simple avis', () => {
  const capped = suburb({ previousRent: 1300, rentedRecently: true });
  assert.equal(capped.monthly.exclCharges, 1300);
  assert.equal(capped.legal.applied.code, 'previous_rent');
  assert.ok(capped.market.monthly > 1300);

  const unknown = suburb({ rentedRecently: true });
  assert.equal(unknown.legal.applied, null);
  assert.ok(unknown.legal.notices.some(n => n.code === 'evolution_cap' && n.level === 'info'));

  // Dernier loyer supérieur au marché : pas de plafond (le marché s'applique)
  const high = suburb({ previousRent: 5000, rentedRecently: true });
  assert.equal(high.legal.applied, null);

  // Hors zone tendue : aucune règle d'évolution
  const elsewhere = suburb({ department: '35', previousRent: 1300, rentedRecently: true });
  assert.equal(elsewhere.legal.applied, null);
  assert.ok(!elsewhere.legal.notices.some(n => n.code === 'evolution_cap'));
  assert.equal(isTenseZone('78'), 'likely');
});

test('Paris : référence du quartier, pondérée avec les annonces, plafonnée au loyer majoré', () => {
  const zone = parisZone();
  const result = computeRent({
    type: 'appartement', surface: 42, rooms: 2, furnished: false, constructionPeriod: '1946_1970',
    characteristics: { type: 'appartement', dpe: 'C', condition: 'renovated', floor: '4+', hasElevator: true, outside: 'small_balcony', view: 'degagee' },
    department: '75', parisZone: zone,
    indicator: indicator({ insee: '75109', name: 'Paris 9e Arrondissement', category: 'appartement_1_2', rentPerM2: 40 }),
    salePrice: 450000, now: NOW
  });
  assert.equal(result.source.kind, 'paris_blend');
  assert.equal(result.legal.parisControl.refPerM2, 31);
  assert.equal(result.legal.parisControl.maxPerM2, 37.2);
  // Marché (31 × 1,10 pondéré avec 40 cc) + bonus caractéristiques dépasse 37,2 €/m² : plafonné
  assert.ok(result.market.perM2ExclCharges > 37.2, `${result.market.perM2ExclCharges}`);
  assert.equal(result.legal.applied.code, 'paris_max');
  assert.equal(result.monthly.exclCharges, Math.round(37.2 * 42));
  assert.equal(result.monthly.high, result.monthly.exclCharges);
  assert.equal(result.yield.gross, Math.round(result.monthly.exclCharges * 12 / 450000 * 1000) / 10);
  assert.equal(result.confidence, 80);
  assert.deepEqual(result.market.references.map(r => r.code), ['paris_observatory', 'carte_loyers']);
});

test('Paris : meublé lu dans les références, époque inconnue moyennée avec confiance réduite', () => {
  const zone = parisZone();
  const furnished = parisReference(zone, { rooms: 2, period: 'apres_1990', furnished: true });
  assert.equal(furnished.ref, 37);
  const unknown = parisReference(zone, { rooms: 2, period: null, furnished: false });
  assert.equal(unknown.ref, 31.5);
  assert.equal(unknown.periodKnown, false);
  assert.equal(parisReference(zone, { rooms: 3, period: null, furnished: false }), null);

  const result = computeRent({ type: 'appartement', surface: 42, rooms: 2, furnished: true, department: '75', parisZone: zone, now: NOW });
  assert.equal(result.source.kind, 'paris_observatory');
  assert.equal(result.confidence, 75 - 5);
  assert.match(result.legal.notices.find(n => n.code === 'paris_control').text, /quatre époques/);
  assert.equal(result.legal.parisControl.furnished, true);
});

test('sans aucune référence : estimation indisponible, message clair', () => {
  const result = computeRent({ type: 'maison', surface: 120, rooms: 5, department: '77', now: NOW });
  assert.equal(result.available, false);
  assert.match(result.warning, /Aucune référence/);
});

test('cadre légal : avis sans plafond quand rien ne contraint', () => {
  const frame = legalFrame({ dpe: 'D', department: '92', surface: 50 });
  assert.equal(frame.rentable, true);
  assert.deepEqual(frame.caps, []);
  assert.deepEqual(frame.notices, []);
  assert.equal(legalFrame({ dpe: 'E', department: '92', surface: 50 }).notices[0].code, 'dpe_deadline');
});
