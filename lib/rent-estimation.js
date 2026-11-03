import { calculateAdjustments, getUncertaintyBand } from './dvf-adjustments.js';
import {
  RENT_REFERENCE_SURFACES, SURFACE_ELASTICITY, DISTRICT_CORRECTION, CHARGES_PER_M2, FURNISHED_PREMIUM,
  PARKING_RENT, PARIS, ANNUAL_RENT_DRIFT, RENT_ADJUSTMENT_WEIGHTS, RENT_CONFIDENCE, PERIOD_LABELS
} from './config-rent.js';
import { legalFrame, roomsLabel } from './rent-rules.js';

/**
 * Moteur d'estimation de loyer (fonctions pures, sans accès aux données).
 *
 * 1. Loyer de référence hors charges au m² :
 *    - Paris : loyer de référence de l'encadrement (médiane de l'observatoire des loyers
 *      pour le quartier, le nombre de pièces, l'époque et le meublé), majoré de la prime de
 *      relocation, pondéré avec les loyers d'annonce de l'arrondissement (Carte des loyers).
 *    - Ailleurs : loyer d'annonce de la commune (Carte des loyers, charges comprises), corrigé
 *      de la surface (élasticité), du quartier (prix de vente DVF du secteur ÷ commune),
 *      charges déduites, supplément meublé.
 * 2. Actualisation depuis la date des données, puis caractéristiques du bien (étage, extérieur,
 *    vue, état, DPE…) avec les poids propres à la location.
 * 3. Cadre légal : plafonds (encadrement Paris, gel DPE F/G, dernier loyer en zone tendue).
 */

const YEAR_MS = 365.25 * 24 * 3600 * 1000;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const round = (value, decimals = 0) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

// Catégorie de la Carte des loyers pour un bien
export function rentCategory(type, rooms) {
  if (type === 'maison') return 'maison';
  return rooms >= 3 ? 'appartement_3_plus' : 'appartement_1_2';
}

export function constructionPeriodFromYear(year) {
  const y = Number(year);
  if (!Number.isFinite(y) || y < 1000) return null;
  if (y < 1946) return 'avant_1946';
  if (y <= 1970) return '1946_1970';
  if (y <= 1990) return '1971_1990';
  return 'apres_1990';
}

// Loyer au m² et surface : un petit logement se loue plus cher au m² qu'un grand
export function surfaceFactor(surface, referenceSurface, elasticity, maxEffect) {
  if (!(surface > 0) || !(referenceSurface > 0)) return 1;
  return clamp(Math.pow(surface / referenceSurface, -elasticity), 1 - maxEffect, 1 + maxEffect);
}

// Quartier : les loyers suivent les prix de vente, avec une amplitude moitié moindre.
// null si les ventes sont trop peu nombreuses pour conclure.
export function districtFactor({ localPricePerM2, communePricePerM2, localCount = 0, communeCount = 0 } = {}, config = DISTRICT_CORRECTION) {
  if (!(localPricePerM2 > 0) || !(communePricePerM2 > 0)) return null;
  if (localCount < config.min_local_sales || communeCount < config.min_commune_sales) return null;
  return clamp(Math.pow(localPricePerM2 / communePricePerM2, config.exponent), config.min_factor, config.max_factor);
}

// Dérive des loyers entre la date de référence des données et aujourd'hui
export function driftFactor(referenceDate, now = Date.now(), annualDrift = ANNUAL_RENT_DRIFT) {
  const reference = new Date(referenceDate).getTime();
  if (!Number.isFinite(reference) || !annualDrift) return 1;
  const years = clamp((now - reference) / YEAR_MS, 0, 5);
  return Math.pow(1 + annualDrift, years);
}

export function monthlyCharges(type, surface) {
  const perM2 = CHARGES_PER_M2[type === 'maison' ? 'maison' : 'appartement'];
  return Math.round(Math.max(CHARGES_PER_M2.min_monthly, perM2 * surface));
}

export function parkingRent({ outdoor = 0, indoor = 0 } = {}) {
  const count = (value) => clamp(parseInt(value, 10) || 0, 0, 3);
  return count(outdoor) * PARKING_RENT.outdoor + count(indoor) * PARKING_RENT.indoor;
}

// Référence parisienne pour (pièces, époque, meublé). Époque inconnue : moyenne des 4 époques.
export function parisReference(zone, { rooms, period, furnished }) {
  if (!zone || !Array.isArray(zone.refs)) return null;
  const roomsKey = clamp(Math.round(rooms) || 1, 1, 4);
  const candidates = zone.refs.filter(r => r.rooms === roomsKey && r.furnished === !!furnished);
  if (candidates.length === 0) return null;
  const exact = period ? candidates.find(r => r.period === period) : null;
  if (exact) return { ...exact, periodKnown: true };
  const average = (key) => candidates.reduce((sum, r) => sum + r[key], 0) / candidates.length;
  return { rooms: roomsKey, period: null, furnished: !!furnished, ref: average('ref'), max: average('max'), min: average('min'), periodKnown: false };
}

// Caractéristiques transmises au moteur d'ajustement : surface et stationnement sont traités à part
function rentCharacteristics(characteristics, type) {
  const { surface, parking, ...rest } = characteristics || {};
  return { ...rest, type };
}

function baseConfidence(sourceKind, indicator) {
  if (sourceKind === 'paris_blend') return RENT_CONFIDENCE.paris_blend;
  if (sourceKind === 'paris_observatory') return RENT_CONFIDENCE.paris_observatory;
  if (indicator?.predictionLevel === 'maille') return RENT_CONFIDENCE.maille;
  const observed = indicator?.observations?.commune || 0;
  if (observed >= RENT_CONFIDENCE.commune_many_threshold) return RENT_CONFIDENCE.commune_many;
  if (observed >= RENT_CONFIDENCE.commune_some_threshold) return RENT_CONFIDENCE.commune_some;
  return RENT_CONFIDENCE.commune_few;
}

/**
 * @param {object} input
 * @param {'appartement'|'maison'} input.type
 * @param {number} input.surface             surface habitable (m²)
 * @param {number} input.rooms               pièces principales
 * @param {boolean} [input.furnished]
 * @param {string|null} [input.constructionPeriod]  avant_1946 | 1946_1970 | 1971_1990 | apres_1990
 * @param {number|null} [input.previousRent] dernier loyer mensuel hors charges
 * @param {boolean} [input.rentedRecently]   loué au cours des 18 derniers mois
 * @param {object} [input.characteristics]   mêmes caractéristiques que pour la vente (floor, outside, dpe…)
 * @param {object} [input.parking]           { outdoor, indoor } nombre de places
 * @param {string|null} [input.department]
 * @param {object|null} [input.indicator]    indicateur Carte des loyers de la commune (rentPerM2 charges comprises, category…)
 * @param {object|null} [input.parisZone]    quartier parisien ({ year, zoneId, quartierName, refs })
 * @param {object|null} [input.dvf]          { localPricePerM2, localCount, communePricePerM2, communeCount }
 * @param {number|null} [input.salePrice]    valeur de vente estimée (rendement brut)
 */
export function computeRent(input) {
  const {
    type, surface, rooms, furnished = false, constructionPeriod = null, previousRent = null, rentedRecently = false,
    characteristics = {}, parking = {}, department = null, indicator = null, parisZone = null, dvf = null,
    salePrice = null, now = Date.now()
  } = input;

  const dpe = characteristics.dpe || 'unknown';
  const category = rentCategory(type, rooms);
  const isHouse = type === 'maison';
  const chargesPerM2 = CHARGES_PER_M2[isHouse ? 'maison' : 'appartement'];
  const furnishedFactor = furnished ? 1 + FURNISHED_PREMIUM : 1;
  const steps = [];        // étapes du calcul, affichées au client
  const references = [];   // sources du loyer de référence

  // ---- 1. Loyer de référence hors charges (€/m²)
  const paris = parisZone ? parisReference(parisZone, { rooms, period: constructionPeriod, furnished }) : null;

  // Carte des loyers : loyer d'annonce charges comprises, pour un logement vide de surface de référence
  let announce = null;
  if (indicator && indicator.rentPerM2 > 0) {
    const referenceSurface = RENT_REFERENCE_SURFACES[indicator.category] || RENT_REFERENCE_SURFACES[category];
    const factor = surfaceFactor(surface, referenceSurface, SURFACE_ELASTICITY[isHouse ? 'maison' : 'appartement'], SURFACE_ELASTICITY.max_effect);
    announce = {
      perM2InclCharges: indicator.rentPerM2,
      referenceSurface,
      surfaceFactor: factor,
      generic: indicator.category !== category
    };
    references.push({
      code: 'carte_loyers',
      label: `Loyers d'annonce — ${indicator.name || 'commune'} (Carte des loyers ${indicator.year})`,
      detail: `${categoryLabel(indicator.category)}, logement vide de ${referenceSurface} m², ` +
        (indicator.predictionLevel === 'maille' ? 'estimé sur une zone plus large que la commune' : `${indicator.observations?.commune || 0} annonces observées`),
      perM2: round(indicator.rentPerM2, 2),
      unit: '€/m² charges comprises'
    });
  }

  let sourceKind = null;
  let basePerM2 = null;
  let district = null;

  if (paris) {
    const observatory = paris.ref * (1 + PARIS.new_lease_premium) *
      surfaceFactor(surface, PARIS.typical_surfaces[paris.rooms], PARIS.surface_elasticity, PARIS.max_surface_effect);
    references.unshift({
      code: 'paris_observatory',
      label: `Observatoire des loyers — quartier ${parisZone.quartierName} (arrêté ${parisZone.year})`,
      detail: `${roomsLabel(paris.rooms)}, ${paris.periodKnown ? PERIOD_LABELS[paris.period] : 'toutes époques'}, ${furnished ? 'meublé' : 'non meublé'} : loyer de référence`,
      perM2: round(paris.ref, 2),
      unit: '€/m² hors charges'
    });
    if (announce) {
      // Annonces de l'arrondissement : surface ramenée au bien, charges déduites, meublé ajouté (annonces de logements vides)
      const announceExclCharges = (announce.perM2InclCharges * announce.surfaceFactor - chargesPerM2) * furnishedFactor;
      basePerM2 = PARIS.weight_observatory * observatory + (1 - PARIS.weight_observatory) * announceExclCharges;
      sourceKind = 'paris_blend';
    } else {
      basePerM2 = observatory;
      sourceKind = 'paris_observatory';
    }
    steps.push({
      code: 'base',
      label: 'Loyer de référence du quartier',
      description: `Observatoire des loyers (relocation : +${Math.round(PARIS.new_lease_premium * 100)} % sur la médiane du parc)` +
        (announce ? " et loyers d'annonce de l'arrondissement" : ''),
      perM2: round(basePerM2, 2),
      unit: '€/m² hors charges'
    });
  } else if (announce) {
    sourceKind = 'carte_loyers';
    let perM2InclCharges = announce.perM2InclCharges;
    steps.push({
      code: 'base',
      label: 'Loyer moyen de la commune',
      description: `Loyers d'annonce ${indicator.name ? `à ${indicator.name}` : ''} (Carte des loyers ${indicator.year}), charges comprises`,
      perM2: round(perM2InclCharges, 2),
      unit: '€/m² charges comprises'
    });
    if (Math.abs(announce.surfaceFactor - 1) >= 0.005) {
      steps.push({
        code: 'surface',
        label: 'Surface',
        description: `${surface} m² (bien de référence : ${announce.referenceSurface} m²)`,
        impact: round((announce.surfaceFactor - 1) * 100, 1)
      });
    }
    perM2InclCharges *= announce.surfaceFactor;

    const factor = districtFactor(dvf || {});
    if (factor) {
      district = { factor, localPricePerM2: dvf.localPricePerM2, communePricePerM2: dvf.communePricePerM2 };
      if (Math.abs(factor - 1) >= 0.005) {
        steps.push({
          code: 'district',
          label: 'Quartier',
          description: `Prix de vente autour du bien (${dvf.localCount} ventes) comparés à ceux de la commune`,
          impact: round((factor - 1) * 100, 1)
        });
      }
      perM2InclCharges *= factor;
    }

    steps.push({
      code: 'charges',
      label: 'Charges déduites',
      description: `≈ ${chargesPerM2.toLocaleString('fr-FR')} €/m² par mois de charges récupérables`,
      perM2: -chargesPerM2,
      unit: '€/m²'
    });
    basePerM2 = perM2InclCharges - chargesPerM2;
    if (furnished) {
      steps.push({ code: 'furnished', label: 'Meublé', description: 'Supplément par rapport à une location vide', impact: round(FURNISHED_PREMIUM * 100, 1) });
      basePerM2 *= furnishedFactor;
    }
  } else {
    return {
      available: false,
      warning: 'Aucune référence de loyer disponible pour cette commune. Un conseiller AlterEgo vous recontacte pour une estimation personnalisée.'
    };
  }

  if (!(basePerM2 > 0)) {
    return { available: false, warning: 'Référence de loyer incohérente pour ce bien. Un conseiller AlterEgo vous recontacte.' };
  }

  // ---- 2. Actualisation et caractéristiques du bien
  const referenceDate = paris ? `${parisZone.year}-07-01` : indicator.referenceDate;
  const drift = driftFactor(referenceDate, now);
  let perM2 = basePerM2;
  if (drift - 1 >= 0.005) {
    steps.push({ code: 'drift', label: 'Évolution des loyers', description: 'Depuis la date des données de référence', impact: round((drift - 1) * 100, 1) });
    perM2 *= drift;
  }

  const adjustment = calculateAdjustments(rentCharacteristics(characteristics, type), { count: dvf?.localCount || 0 }, RENT_ADJUSTMENT_WEIGHTS);
  const adjustments = adjustment.adjustments
    .filter(a => a.weight > 0 && a.impact !== 0)
    .map(a => ({ factor: a.factor, description: a.description, impact: round(a.impact, 1) }));
  perM2 *= 1 + adjustment.totalImpact;

  const marketPerM2 = perM2;
  const marketMonthly = Math.round(marketPerM2 * surface);
  const charges = monthlyCharges(type, surface);
  const parkingMonthly = parkingRent(parking);

  // ---- 3. Cadre légal
  const legal = legalFrame({
    dpe, previousRent, rentedRecently, department, surface,
    paris: paris ? { zone: parisZone, ref: paris } : null
  });
  const applied = legal.caps
    .filter(cap => cap.monthly > 0 && cap.monthly < marketMonthly)
    .sort((a, b) => a.monthly - b.monthly)[0] || null;
  const monthly = applied ? applied.monthly : marketMonthly;

  // ---- 4. Confiance et fourchette
  let confidence = baseConfidence(sourceKind, indicator);
  if (district) confidence += RENT_CONFIDENCE.bonus_district_correction;
  if (announce?.generic) confidence -= RENT_CONFIDENCE.penalty_generic_category;
  if (paris && !paris.periodKnown) confidence -= RENT_CONFIDENCE.penalty_unknown_period;
  confidence = clamp(Math.round(confidence), RENT_CONFIDENCE.min, RENT_CONFIDENCE.max);
  const band = getUncertaintyBand(confidence);
  // Loyer plafonné par la loi : le marché est au-dessus, le loyer se fixe au plafond
  const low = applied ? Math.round(monthly * (1 - band / 2)) : Math.round(monthly * (1 - band));
  const high = applied ? monthly : Math.round(monthly * (1 + band));

  const grossYield = salePrice > 0 ? round((monthly * 12) / salePrice * 100, 1) : null;

  return {
    available: true,
    monthly: {
      exclCharges: monthly,
      inclCharges: monthly + charges,
      low,
      high,
      charges,
      parking: parkingMonthly,
      perM2ExclCharges: round(monthly / surface, 2)
    },
    market: {
      monthly: marketMonthly,
      perM2ExclCharges: round(marketPerM2, 2),
      references,
      steps,
      adjustments,
      totalAdjustmentPercent: round(adjustment.totalImpact * 100, 1),
      district: district ? { factor: round(district.factor, 3), localPricePerM2: Math.round(district.localPricePerM2), communePricePerM2: Math.round(district.communePricePerM2) } : null
    },
    legal: {
      rentable: legal.rentable,
      notices: legal.notices,
      caps: legal.caps,
      applied,
      parisControl: legal.parisControl,
      tenseZone: legal.tenseZone
    },
    confidence,
    uncertaintyBand: Math.round(band * 100),
    source: {
      kind: sourceKind,
      category,
      label: sourceLabel(sourceKind, indicator, parisZone),
      referenceDate
    },
    yield: grossYield !== null ? { gross: grossYield } : null,
    furnished: !!furnished,
    constructionPeriod: paris ? paris.period : constructionPeriod,
    warning: confidence < 50
      ? 'Références de loyers limitées dans ce secteur : estimation indicative. Un conseiller AlterEgo peut l\'affiner avec vous.'
      : confidence < 65
        ? 'Données limitées dans ce secteur : estimation à considérer avec précaution.'
        : null
  };
}

function categoryLabel(category) {
  return {
    appartement_1_2: 'appartements 1-2 pièces',
    appartement_3_plus: 'appartements 3 pièces et plus',
    appartement: 'tous appartements',
    maison: 'maisons'
  }[category] || category;
}

function sourceLabel(kind, indicator, parisZone) {
  if (kind === 'paris_blend') return `Observatoire des loyers (quartier ${parisZone.quartierName}) et Carte des loyers ${indicator.year}`;
  if (kind === 'paris_observatory') return `Observatoire des loyers (quartier ${parisZone.quartierName}, arrêté ${parisZone.year})`;
  return `Carte des loyers ${indicator.year} (loyers d'annonce, ministère du Logement / ANIL)`;
}
