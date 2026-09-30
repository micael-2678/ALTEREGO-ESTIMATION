import { getAdaptiveComparables } from '../dvf-enhanced.js';
import { calculateAdjustments, calculateAdjustedPrice } from '../dvf-adjustments.js';

export const PROPERTY_TYPES = ['appartement', 'maison'];

export const DVF_SEARCH = {
  initialRadiusMeters: 500,
  maxRadiusMeters: 800,
  months: 24,
  maxMonths: 36,
  minComparables: 8
};

function toNumber(value) {
  const n = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

// Valide les paramètres communs d'une recherche de comparables
export function parseEstimateParams({ lat, lng, type, surface }) {
  const parsed = {
    lat: toNumber(lat),
    lng: toNumber(lng),
    type,
    surface: toNumber(surface)
  };
  if (parsed.lat === null || parsed.lng === null || Math.abs(parsed.lat) > 90 || Math.abs(parsed.lng) > 180) {
    return { error: 'Invalid coordinates' };
  }
  if (!PROPERTY_TYPES.includes(parsed.type)) {
    return { error: 'Invalid property type' };
  }
  if (parsed.surface === null || parsed.surface < 5 || parsed.surface > 5000) {
    return { error: 'Invalid surface' };
  }
  return { params: parsed };
}

// Estimation complète : comparables DVF + ajustements
export async function computeEstimation({ lat, lng, type, surface, characteristics = {} }) {
  const dvfResult = await getAdaptiveComparables({ lat, lng, type, surface, ...DVF_SEARCH });

  let adjustmentData = null;
  let finalPrice = null;

  if (dvfResult.stats) {
    const adjustmentResult = calculateAdjustments({ ...characteristics, type, surface }, dvfResult);
    const priceData = calculateAdjustedPrice(
      dvfResult.stats.weightedAverage,
      surface,
      adjustmentResult,
      dvfResult
    );

    adjustmentData = { ...adjustmentResult, ...priceData };
    // Un seul indicateur de fiabilité pour tout l'écran : l'avertissement suit la confiance finale
    dvfResult.warning = priceData.confidence < 50
      ? 'Peu de ventes comparables dans ce secteur : estimation indicative. Un rendez-vous avec un conseiller est recommandé pour l\'affiner.'
      : priceData.confidence < 65
        ? 'Données limitées dans ce secteur : estimation à considérer avec précaution.'
        : null;

    finalPrice = {
      mid: priceData.priceMid,
      low: priceData.priceLow,
      high: priceData.priceHigh,
      confidence: priceData.confidence
    };
  }

  return {
    dvf: dvfResult,
    adjustments: adjustmentData,
    finalPrice,
    disclaimer: 'Estimations basées sur DVF (open data) et ajustements selon caractéristiques — valeurs indicatives, non contractuelles.'
  };
}
