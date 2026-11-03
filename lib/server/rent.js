import { getCollection } from '../mongodb.js';
import { cleanOutliers } from '../dvf-ingestion.js';
import { isoDateMonthsAgo, toCurrentPricePerM2 } from '../dvf-enhanced.js';
import { computeRent, rentCategory, constructionPeriodFromYear } from '../rent-estimation.js';
import { CONSTRUCTION_PERIODS } from '../config-rent.js';
import { RENT_INDICATORS_COLLECTION, RENT_CONTROL_COLLECTION } from '../rent-ingestion.js';

// Accès aux références de loyers (Carte des loyers, encadrement Paris) et aux prix DVF de la
// commune ; le calcul lui-même est dans lib/rent-estimation.js.

function toNumber(value) {
  const n = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

// Paramètres propres à la location, validés
export function parseRentParams(rent) {
  if (!rent || typeof rent !== 'object') return { error: 'Invalid rent parameters' };
  const rooms = toNumber(rent.rooms);
  if (rooms === null || rooms < 1 || rooms > 30) return { error: 'Invalid rooms' };
  const previousRent = toNumber(rent.previousRent);
  const count = (value) => Math.max(0, Math.min(5, parseInt(value, 10) || 0));
  return {
    rent: {
      rooms: Math.round(rooms),
      furnished: rent.furnished === true,
      constructionPeriod: CONSTRUCTION_PERIODS.includes(rent.constructionPeriod) ? rent.constructionPeriod : null,
      yearBuilt: toNumber(rent.yearBuilt),
      rentedRecently: rent.rentedRecently === true,
      previousRent: previousRent !== null && previousRent >= 50 && previousRent <= 50000 ? previousRent : null,
      insee: typeof rent.insee === 'string' && /^(\d{5}|2[AB]\d{3})$/.test(rent.insee) ? rent.insee : null,
      parking: { outdoor: count(rent.parking?.outdoor), indoor: count(rent.parking?.indoor) }
    }
  };
}

// Codes INSEE à essayer : l'arrondissement (adresse, DVF) puis la commune entière (Paris, Lyon, Marseille)
export function inseeCandidates(insee) {
  if (!insee) return [];
  const codes = [insee];
  if (/^751\d{2}$/.test(insee)) codes.push('75056');
  else if (/^6938\d$/.test(insee)) codes.push('69123');
  else if (/^132\d{2}$/.test(insee)) codes.push('13055');
  return codes;
}

export function departmentOf(insee) {
  if (!insee) return null;
  return insee.startsWith('97') ? insee.slice(0, 3) : insee.slice(0, 2);
}

// Indicateur Carte des loyers : catégorie exacte de préférence, sinon « tous appartements »
export async function findRentIndicator(insee, category) {
  const codes = inseeCandidates(insee);
  if (codes.length === 0) return null;
  const categories = category === 'maison' ? ['maison'] : [category, 'appartement'];
  const collection = await getCollection(RENT_INDICATORS_COLLECTION);
  const docs = await collection.find({ insee: { $in: codes }, category: { $in: categories } }, { projection: { _id: 0 } }).toArray();
  const rank = (doc) => codes.indexOf(doc.insee) * 10 + categories.indexOf(doc.category);
  return docs.sort((a, b) => rank(a) - rank(b))[0] || null;
}

// Quartier parisien contenant le point (contours de l'encadrement des loyers)
export async function findRentControlZone(lat, lng) {
  const collection = await getCollection(RENT_CONTROL_COLLECTION);
  return collection.findOne(
    { geometry: { $geoIntersects: { $geometry: { type: 'Point', coordinates: [lng, lat] } } } },
    { projection: { _id: 0, geometry: 0, imported_at: 0 } }
  );
}

let communeIndexReady = null;
function ensureCommuneIndex(collection) {
  if (!communeIndexReady) {
    communeIndexReady = collection.createIndex({ type_local: 1, code_commune: 1, date_mutation: -1 }, { name: 'type_commune_date' })
      .catch(error => {
        communeIndexReady = null;
        console.error('DVF commune index failed:', error);
      });
  }
  return communeIndexReady;
}

// Prix médian au m² des ventes de la commune (même type, surface proche, 36 mois, ramené à aujourd'hui)
export async function communePricePerM2({ insee, type, surface, annualRate = 0, now = Date.now() }) {
  const collection = await getCollection('dvf_sales');
  await ensureCommuneIndex(collection);
  const sales = await collection
    .find(
      {
        type_local: type,
        code_commune: insee,
        date_mutation: { $gte: isoDateMonthsAgo(36, now), $lte: isoDateMonthsAgo(0, now) },
        surface_reelle_bati: { $gte: surface * 0.75, $lte: surface * 1.25 },
        prix_m2: { $gt: 0 }
      },
      { projection: { _id: 0, prix_m2: 1, date_mutation: 1 } }
    )
    .limit(5000)
    .toArray();
  const cleaned = cleanOutliers(sales);
  if (cleaned.length === 0) return { median: null, count: 0 };
  const prices = cleaned.map(s => toCurrentPricePerM2(s.prix_m2, s.date_mutation, annualRate, now)).sort((a, b) => a - b);
  const mid = Math.floor(prices.length / 2);
  const median = prices.length % 2 ? prices[mid] : (prices[mid - 1] + prices[mid]) / 2;
  return { median: Math.round(median), count: cleaned.length };
}

/**
 * Estimation de loyer complète : références de la commune / du quartier, prix DVF du secteur
 * et de la commune, puis calcul (lib/rent-estimation.js).
 */
export async function computeRentEstimation({ lat, lng, type, surface, rent, characteristics = {}, dvfResult = null, salePrice = null, now = Date.now() }) {
  const insee = rent.insee || dvfResult?.commune?.code || null;
  const category = rentCategory(type, rent.rooms);
  const [indicator, parisZone] = await Promise.all([
    findRentIndicator(insee, category),
    findRentControlZone(lat, lng)
  ]);

  let dvf = null;
  if (dvfResult?.stats && insee) {
    const commune = await communePricePerM2({ insee, type, surface, annualRate: (dvfResult.trend?.annualRatePercent || 0) / 100, now });
    dvf = {
      localPricePerM2: dvfResult.stats.weightedAverage,
      localCount: dvfResult.count,
      communePricePerM2: commune.median,
      communeCount: commune.count
    };
  }

  return computeRent({
    type,
    surface,
    rooms: rent.rooms,
    furnished: rent.furnished,
    constructionPeriod: rent.constructionPeriod || constructionPeriodFromYear(rent.yearBuilt),
    previousRent: rent.previousRent,
    rentedRecently: rent.rentedRecently,
    characteristics,
    parking: rent.parking,
    department: departmentOf(insee),
    indicator,
    parisZone,
    dvf,
    salePrice,
    now
  });
}
