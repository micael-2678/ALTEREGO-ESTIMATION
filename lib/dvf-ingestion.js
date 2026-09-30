import https from 'https';
import http from 'http';
import fs from 'fs';
import zlib from 'zlib';
import { parse } from 'csv-parse';
import { getCollection } from './mongodb.js';

// URLs des fichiers DVF sur data.gouv.fr
const DVF_BASE_URL = process.env.DVF_BASE_URL || 'https://files.data.gouv.fr/geo-dvf/latest/csv';

// Télécharger un fichier depuis une URL (suit les redirections, délai max 2 min)
export async function downloadFile(url, destPath, redirects = 0) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const request = protocol.get(url, (response) => {
      if ([301, 302, 307, 308].includes(response.statusCode) && response.headers.location) {
        response.resume();
        if (redirects >= 5) return reject(new Error('Too many redirects'));
        const next = new URL(response.headers.location, url).toString();
        return downloadFile(next, destPath, redirects + 1).then(resolve).catch(reject);
      }

      if (response.statusCode !== 200) {
        response.resume();
        return reject(new Error(`Failed to download: ${response.statusCode}`));
      }

      const file = fs.createWriteStream(destPath);
      response.pipe(file);
      file.on('finish', () => file.close(() => resolve(destPath)));
      file.on('error', (err) => {
        fs.rmSync(destPath, { force: true });
        reject(err);
      });
    });
    request.setTimeout(120000, () => request.destroy(new Error('Download timeout')));
    request.on('error', (err) => {
      fs.rmSync(destPath, { force: true });
      reject(err);
    });
  });
}

// Nettoyer et normaliser un enregistrement DVF
export function normalizeRecord(record) {
  // Type de bien
  let type = null;
  if (record.type_local === 'Appartement') type = 'appartement';
  else if (record.type_local === 'Maison') type = 'maison';
  else return null; // Ignorer les autres types
  
  // Surface
  const surface = parseFloat(record.surface_reelle_bati);
  if (!surface || surface <= 0 || surface > 1000) return null;
  
  // Prix
  const price = parseFloat(record.valeur_fonciere);
  if (!price || price <= 0) return null;
  
  // Prix/m²
  const pricePerM2 = price / surface;
  if (pricePerM2 < 500 || pricePerM2 > 30000) return null; // Outliers évidents
  
  // Date
  const date = record.date_mutation;
  if (!date) return null;
  
  // Géolocalisation
  const lat = parseFloat(record.latitude);
  const lng = parseFloat(record.longitude);
  if (!lat || !lng) return null;
  
  // Code postal et commune
  const postalCode = record.code_postal;
  const commune = record.nom_commune || record.commune;
  if (!postalCode || !commune) return null;
  
  // Masquer le numéro exact (privacy)
  const numero = record.adresse_numero ? 'XX' : null;
  
  return {
    date_mutation: date,
    numero_voie_masked: numero,
    type_voie: '', // Non disponible dans le nouveau format
    voie: record.adresse_nom_voie || '',
    code_postal: postalCode,
    commune: commune,
    code_departement: record.code_departement,
    code_commune: record.code_commune,
    type_local: type,
    surface_reelle_bati: surface,
    nombre_pieces_principales: parseInt(record.nombre_pieces_principales) || null,
    valeur_fonciere: price,
    prix_m2: Math.round(pricePerM2),
    latitude: lat,
    longitude: lng,
    nature_mutation: record.nature_mutation
  };
}

// Nettoyer les outliers statistiques
export function cleanOutliers(sales) {
  if (sales.length < 4) return sales;
  
  const prices = sales.map(s => s.prix_m2).sort((a, b) => a - b);
  
  // 1) Percentiles 1/99
  const p1Index = Math.floor(prices.length * 0.01);
  const p99Index = Math.floor(prices.length * 0.99);
  const p1 = prices[p1Index];
  const p99 = prices[p99Index];
  
  // 2) IQR method
  const q1Index = Math.floor(prices.length * 0.25);
  const q3Index = Math.floor(prices.length * 0.75);
  const q1 = prices[q1Index];
  const q3 = prices[q3Index];
  const iqr = q3 - q1;
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;
  
  // 3) Mean + 2σ
  const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
  const variance = prices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / prices.length;
  const stdDev = Math.sqrt(variance);
  const lower2Sigma = mean - 2 * stdDev;
  const upper2Sigma = mean + 2 * stdDev;
  
  // Appliquer tous les filtres
  return sales.filter(s => {
    const price = s.prix_m2;
    return price >= p1 && price <= p99 &&
           price >= lowerBound && price <= upperBound &&
           price >= lower2Sigma && price <= upper2Sigma;
  });
}

// Types de mutation retenus : ventes classiques uniquement. Les VEFA (neuf),
// adjudications, échanges et expropriations obéissent à d'autres logiques de prix.
const ACCEPTED_NATURES = new Set(['Vente']);
const RESIDENTIAL_TYPES = new Set(['Appartement', 'Maison']);
const COMMERCIAL_TYPE = 'Local industriel. commercial ou assimilé';

// Années importées par défaut : les 5 dernières années civiles (les années
// absentes sur data.gouv.fr sont simplement ignorées). Surcharge : DVF_YEARS="2022,2023,2024"
export function getDefaultYears(now = new Date()) {
  if (process.env.DVF_YEARS) {
    return process.env.DVF_YEARS.split(',').map(y => y.trim()).filter(Boolean);
  }
  const year = now.getFullYear();
  return [year - 5, year - 4, year - 3, year - 2, year - 1].map(String);
}

/**
 * Transforme toutes les lignes CSV d'une même mutation en une vente exploitable.
 *
 * Dans DVF, `valeur_fonciere` est le prix de TOUTE la mutation, répété sur chaque
 * ligne. Une vente de 3 appartements (ou d'un appartement + un local commercial)
 * produit donc 3 lignes portant chacune le prix total : les traiter séparément
 * multiplie le prix/m². On ne garde que les mutations portant sur un seul logement
 * (éventuellement avec dépendances : cave, parking).
 */
export function summarizeMutation(rows) {
  if (!rows || rows.length === 0) return null;
  const first = rows[0];

  if (!ACCEPTED_NATURES.has(first.nature_mutation)) return null;
  if (rows.some(r => r.type_local === COMMERCIAL_TYPE)) return null;

  // Une même maison apparaît une fois par nature de culture (sol, jardin…) : dédoublonnage
  const locals = new Map();
  for (const row of rows) {
    if (!RESIDENTIAL_TYPES.has(row.type_local)) continue;
    const key = [row.type_local, row.id_parcelle, row.lot1_numero || '', row.surface_reelle_bati, row.nombre_pieces_principales].join('|');
    if (!locals.has(key)) locals.set(key, row);
  }
  if (locals.size !== 1) return null;

  const [localRow] = locals.values();
  const sale = normalizeRecord(localRow);
  if (!sale) return null;

  // Surface de terrain : somme des parcelles/cultures distinctes
  const plots = new Map();
  for (const row of rows) {
    const area = parseFloat(row.surface_terrain);
    if (!area) continue;
    plots.set(`${row.id_parcelle}|${row.nature_culture}|${area}`, area);
  }
  const landSurface = [...plots.values()].reduce((sum, a) => sum + a, 0);

  return {
    ...sale,
    id_mutation: first.id_mutation || null,
    surface_terrain: landSurface || null,
    has_dependance: rows.some(r => r.type_local === 'Dépendance')
  };
}

/**
 * Regroupe un flux de lignes CSV par id_mutation et renvoie les ventes retenues.
 * Les fichiers geo-dvf sont triés par mutation ; si une mutation réapparaît plus
 * loin (lignes non contiguës), elle est écartée par prudence.
 */
export async function collectSales(rowIterable, { cutoffDate = null } = {}) {
  const sales = new Map();
  const discarded = new Set();
  let currentId = null;
  let currentRows = [];
  let rawRows = 0;

  const flush = () => {
    if (!currentId || discarded.has(currentId)) return;
    if (sales.has(currentId)) {
      sales.delete(currentId);
      discarded.add(currentId);
      return;
    }
    const sale = summarizeMutation(currentRows);
    if (sale && (!cutoffDate || new Date(sale.date_mutation) >= cutoffDate)) {
      sales.set(currentId, sale);
    } else {
      // Mémorise l'id pour détecter une éventuelle réapparition
      sales.set(currentId, null);
    }
  };

  for await (const row of rowIterable) {
    rawRows++;
    const id = row.id_mutation || `${row.date_mutation}|${row.valeur_fonciere}|${row.id_parcelle}`;
    if (id !== currentId) {
      flush();
      currentId = id;
      currentRows = [];
    }
    currentRows.push(row);
  }
  flush();

  return { sales: [...sales.values()].filter(Boolean), rawRows };
}

async function downloadAndParseYear(departmentCode, year, cutoffDate) {
  const url = `${DVF_BASE_URL}/${year}/departements/${departmentCode}.csv.gz`;
  const gzPath = `/tmp/dvf_${departmentCode}_${year}.csv.gz`;

  console.log(`[DVF] Downloading ${url}...`);
  await downloadFile(url, gzPath);

  try {
    const parser = fs.createReadStream(gzPath)
      .pipe(zlib.createGunzip())
      .pipe(parse({ columns: true, skip_empty_lines: true, delimiter: ',', relax_column_count: true }));
    return await collectSales(parser, { cutoffDate });
  } finally {
    fs.rmSync(gzPath, { force: true });
  }
}

// Ingérer les données DVF d'un département (plusieurs années)
export async function ingestDVFDepartment(departmentCode, options = {}) {
  const { years = getDefaultYears() } = options;
  console.log(`[DVF] Starting ingestion for department ${departmentCode} (${years.join(', ')})...`);

  const cutoffDate = new Date();
  cutoffDate.setFullYear(cutoffDate.getFullYear() - 5);

  const allSales = [];
  let rawRows = 0;
  let downloadedYears = 0;

  for (const year of years) {
    try {
      const result = await downloadAndParseYear(departmentCode, year, cutoffDate);
      downloadedYears++;
      rawRows += result.rawRows;
      allSales.push(...result.sales);
      console.log(`[DVF] ${year}: ${result.rawRows} lignes → ${result.sales.length} ventes retenues`);
    } catch (error) {
      console.warn(`[DVF] ${year}: ignoré (${error.message})`);
    }
  }

  // Ne jamais effacer les données existantes si rien n'a pu être téléchargé
  if (downloadedYears === 0) {
    throw new Error(`Aucune année DVF disponible pour le département ${departmentCode}`);
  }

  const collection = await getCollection('dvf_sales');
  await ensureDVFIndexes(collection);

  await collection.deleteMany({ code_departement: departmentCode });

  const batchSize = 1000;
  let inserted = 0;
  const importedAt = new Date().toISOString();
  for (let i = 0; i < allSales.length; i += batchSize) {
    const batch = allSales.slice(i, i + batchSize).map(s => ({ ...s, imported_at: importedAt }));
    const result = await collection.insertMany(batch, { ordered: false });
    inserted += result.insertedCount;
  }

  const stats = {
    inserted,
    total: rawRows,
    years: downloadedYears,
    appartements: allSales.filter(s => s.type_local === 'appartement').length,
    maisons: allSales.filter(s => s.type_local === 'maison').length
  };
  console.log(`[DVF] ✓ Département ${departmentCode} : ${stats.appartements} appartements, ${stats.maisons} maisons`);
  return stats;
}

export async function ensureDVFIndexes(collection) {
  // Index principal de la recherche de comparables (type + zone géographique + date)
  await collection.createIndex({ type_local: 1, latitude: 1, longitude: 1, date_mutation: -1 });
  await collection.createIndex({ code_departement: 1 });
  await collection.createIndex({ date_mutation: -1 });
}

// Télécharger et ingérer plusieurs départements
export async function ingestMultipleDepartments(departments) {
  const results = [];
  
  for (const dept of departments) {
    try {
      const stats = await ingestDVFDepartment(dept);
      results.push({ department: dept, success: true, stats });
    } catch (error) {
      console.error(`[DVF] Failed to ingest department ${dept}:`, error.message);
      results.push({ department: dept, success: false, error: error.message });
    }
  }
  
  return results;
}