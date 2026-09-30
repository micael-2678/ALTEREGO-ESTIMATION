import { getCollection } from './mongodb.js';
import { cleanOutliers } from './dvf-ingestion.js';

// DVF fournit les voies en majuscules : « RUE DE LA PAIX » → « Rue de la Paix »
const LOWERCASE_WORDS = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'et', 'aux', 'au', 'sur', 'sous', 'en']);
export function formatStreetName(name = '') {
  return name
    .toLowerCase()
    .split(' ')
    .map((word, i) => {
      if (i > 0 && LOWERCASE_WORDS.has(word)) return word;
      // Élisions : d'Alsace, l'Église
      const elision = word.match(/^([dl]')(.+)$/);
      if (elision && i > 0) return elision[1] + elision[2].charAt(0).toUpperCase() + elision[2].slice(1);
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

const DAY_MS = 24 * 60 * 60 * 1000;
const YEAR_MS = 365.25 * DAY_MS;
const MONTH_MS = YEAR_MS / 12;

// Distance à vol d'oiseau (formule de Haversine), en mètres
export function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function boundingBox(lat, lng, radius) {
  const latDelta = radius / 111000;
  const lngDelta = radius / (111000 * Math.cos(lat * Math.PI / 180));
  return {
    latitude: { $gte: lat - latDelta, $lte: lat + latDelta },
    longitude: { $gte: lng - lngDelta, $lte: lng + lngDelta }
  };
}

function isoDateMonthsAgo(months, now) {
  return new Date(now - months * MONTH_MS).toISOString().split('T')[0];
}

/**
 * Tendance annuelle des prix du secteur : régression du log(prix/m²) sur la date.
 * Une vente d'il y a 2 ans dans un marché à -4 %/an ne vaut plus le même prix
 * aujourd'hui. La tendance n'est retenue que si elle est statistiquement nette
 * (|pente| > 2 écarts-types) et elle est bornée à ±maxAbsRate par an.
 */
export function estimateAnnualTrend(sales, { now = Date.now(), minSales = 40, minSpanYears = 1.5, maxAbsRate = 0.15 } = {}) {
  const points = sales
    .filter(s => s.prix_m2 > 0 && s.date_mutation)
    .map(s => ({ t: (new Date(s.date_mutation).getTime() - now) / YEAR_MS, y: Math.log(s.prix_m2) }));

  const n = points.length;
  const none = { annualRate: 0, sampleSize: n, applied: false };
  if (n < minSales) return none;

  const tMin = Math.min(...points.map(p => p.t));
  const tMax = Math.max(...points.map(p => p.t));
  if (tMax - tMin < minSpanYears) return none;

  const meanT = points.reduce((sum, p) => sum + p.t, 0) / n;
  const meanY = points.reduce((sum, p) => sum + p.y, 0) / n;
  let sxx = 0;
  let sxy = 0;
  for (const p of points) {
    sxx += (p.t - meanT) ** 2;
    sxy += (p.t - meanT) * (p.y - meanY);
  }
  const slope = sxy / sxx;
  const residualVariance = points.reduce((sum, p) => sum + (p.y - meanY - slope * (p.t - meanT)) ** 2, 0) / (n - 2);
  const standardError = Math.sqrt(residualVariance / sxx);

  if (Math.abs(slope) < 2 * standardError) return none;

  const rate = Math.exp(slope) - 1;
  return {
    annualRate: Math.max(-maxAbsRate, Math.min(maxAbsRate, rate)),
    sampleSize: n,
    applied: true
  };
}

// Prix/m² d'une vente ramené à aujourd'hui selon la tendance annuelle
export function toCurrentPricePerM2(pricePerM2, date, annualRate, now = Date.now()) {
  if (!annualRate) return pricePerM2;
  const ageYears = Math.max(0, (now - new Date(date).getTime()) / YEAR_MS);
  return pricePerM2 * Math.pow(1 + annualRate, ageYears);
}

/**
 * Statistiques sur les comparables retenus (prix déjà ramenés à aujourd'hui dans
 * `prix_m2_actuel`). Moyenne pondérée : 60 % proximité, 40 % récence.
 */
export function summarizeComparables(comparables, { radius, monthsWindow, now = Date.now() }) {
  const prices = comparables.map(c => c.prix_m2_actuel);
  const n = prices.length;
  const mean = prices.reduce((a, b) => a + b, 0) / n;
  const sorted = [...prices].sort((a, b) => a - b);
  const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];
  const stdDev = Math.sqrt(prices.reduce((sum, p) => sum + (p - mean) ** 2, 0) / n);

  let weightedSum = 0;
  let weightSum = 0;
  let ageSum = 0;
  for (const sale of comparables) {
    const ageMonths = (now - new Date(sale.date_mutation).getTime()) / MONTH_MS;
    ageSum += ageMonths;
    // Poids planchers à 0.1 : une vente en limite de rayon ou de période compte encore un peu
    const distanceWeight = Math.max(0.1, 1 - sale.distance / radius);
    const recencyWeight = Math.max(0.1, 1 - ageMonths / monthsWindow);
    const weight = distanceWeight * 0.6 + recencyWeight * 0.4;
    weightedSum += sale.prix_m2_actuel * weight;
    weightSum += weight;
  }

  // Indice interne (0-100) : nombre, proximité du plus proche, récence moyenne
  const closest = Math.min(...comparables.map(c => c.distance));
  const confidenceIndex = Math.round(
    Math.min(n / 10, 1) * 40 +
    Math.max(0, 1 - closest / radius) * 30 +
    Math.max(0, 1 - (ageSum / n) / monthsWindow) * 30
  );

  return {
    meanPricePerM2: Math.round(mean),
    medianPricePerM2: Math.round(median),
    stdDev: Math.round(stdDev),
    weightedAverage: Math.round(weightSum > 0 ? weightedSum / weightSum : mean),
    confidenceIndex
  };
}

// Tendance du secteur : ventes du même type dans 1 km sur 4 ans
async function loadLocalTrend(collection, { lat, lng, type, now }) {
  const sales = await collection
    .find(
      {
        type_local: type,
        ...boundingBox(lat, lng, 1000),
        date_mutation: { $gte: isoDateMonthsAgo(48, now), $lte: isoDateMonthsAgo(0, now) },
        prix_m2: { $gt: 0 }
      },
      { projection: { _id: 0, prix_m2: 1, date_mutation: 1 } }
    )
    .toArray();
  return estimateAnnualTrend(cleanOutliers(sales), { now });
}

// Algorithme de sélection adaptatif des comparables
export async function getAdaptiveComparables({
  lat,
  lng,
  type,
  surface,
  initialRadiusMeters = 500,
  maxRadiusMeters = 800,
  months = 24,
  maxMonths = 36,
  minComparables = 8,
  excludeIds = [],
  now = Date.now()
}) {
  const collection = await getCollection('dvf_sales');
  const typeLocal = type === 'appartement' ? 'appartement' : 'maison';
  const excluded = new Set(excludeIds.map(String));

  let radius = initialRadiusMeters;
  let monthsWindow = months;
  let comparables = [];
  const maxAttempts = 5;

  // Stratégie adaptative : on élargit rayon, période puis tolérance de surface
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const surfaceTolerance = attempt <= 2 ? 0.15 : 0.25;

    const sales = await collection.find({
      type_local: typeLocal,
      ...boundingBox(lat, lng, radius),
      // Borne haute : permet de rejouer une estimation à une date passée (recalibrage)
      date_mutation: { $gte: isoDateMonthsAgo(monthsWindow, now), $lte: isoDateMonthsAgo(0, now) },
      surface_reelle_bati: { $gte: surface * (1 - surfaceTolerance), $lte: surface * (1 + surfaceTolerance) },
      prix_m2: { $gt: 0 }
    }).toArray();

    comparables = sales
      .filter(sale => !excluded.has(String(sale._id)))
      .map(sale => ({ ...sale, distance: calculateDistance(lat, lng, sale.latitude, sale.longitude) }))
      .filter(sale => sale.distance <= radius);

    if (comparables.length >= minComparables || attempt === maxAttempts) break;

    if (radius < maxRadiusMeters) {
      radius = Math.min(radius + 100, maxRadiusMeters);
    }
    if (monthsWindow < maxMonths && comparables.length < minComparables / 2) {
      monthsWindow = Math.min(monthsWindow + 6, maxMonths);
    }
  }

  const empty = (warning) => ({
    count: 0, radius, months: monthsWindow, stats: null, comparables: [], trend: null, warning
  });

  if (comparables.length === 0) {
    return empty('Aucun comparable trouvé. Un RDV avec un expert est recommandé.');
  }

  const cleaned = cleanOutliers(comparables);
  if (cleaned.length === 0) {
    return empty('Données insuffisantes après nettoyage. Un RDV est recommandé.');
  }

  const trend = await loadLocalTrend(collection, { lat, lng, type: typeLocal, now });
  for (const sale of cleaned) {
    sale.prix_m2_actuel = toCurrentPricePerM2(sale.prix_m2, sale.date_mutation, trend.annualRate, now);
  }
  cleaned.sort((a, b) => a.distance - b.distance);

  return {
    count: cleaned.length,
    radius,
    months: monthsWindow,
    stats: summarizeComparables(cleaned, { radius, monthsWindow, now }),
    trend: { annualRatePercent: Math.round(trend.annualRate * 1000) / 10, sampleSize: trend.sampleSize, applied: trend.applied },
    comparables: cleaned.slice(0, 20).map(c => ({
      id: c._id,
      // Numéro de voie jamais affiché (confidentialité) : seulement la rue et la commune
      address: [formatStreetName(c.voie), [c.code_postal, c.commune].filter(Boolean).join(' ')].filter(Boolean).join(', '),
      price: c.valeur_fonciere,
      surface: c.surface_reelle_bati,
      pricePerM2: c.prix_m2,
      pricePerM2Today: Math.round(c.prix_m2_actuel),
      date: c.date_mutation,
      distance: Math.round(c.distance),
      latitude: c.latitude,
      longitude: c.longitude
    })),
    warning: null
  };
}
