import fs from 'fs';
import { Readable } from 'stream';
import { parse } from 'csv-parse';
import { getCollection } from './mongodb.js';
import { downloadFile } from './dvf-ingestion.js';
import { RENT_CATEGORIES } from './config-rent.js';

/**
 * Import des références de loyers.
 *
 * 1. « Carte des loyers » (ministère du Logement / ANIL, data.gouv.fr) : loyer d'annonce
 *    au m², charges comprises, pour un logement vide de référence, par commune, en quatre
 *    fichiers CSV (appartements 1-2 pièces, 3 pièces et plus, tous appartements, maisons).
 *    Les ressources sont retrouvées par l'API de data.gouv.fr (le millésime change chaque
 *    année) et les colonnes lues sans dépendre de leur casse ni de leur ponctuation.
 * 2. Encadrement des loyers à Paris (opendata.paris.fr) : loyers de référence, majorés et
 *    minorés par quartier, nombre de pièces, époque et meublé, avec le contour de chaque
 *    quartier (recherche par point lors de l'estimation).
 */

export const RENT_INDICATORS_COLLECTION = 'rent_indicators';
export const RENT_CONTROL_COLLECTION = 'rent_control_zones';

export const DATA_GOUV_API = process.env.DATA_GOUV_API || 'https://www.data.gouv.fr/api/1';
// Dernier millésime connu ; LOYERS_DATASET force un autre jeu (identifiant ou slug data.gouv.fr)
export const DEFAULT_CARTE_DATASET = 'carte-des-loyers-indicateurs-de-loyers-dannonce-par-commune-en-2025';
export const PARIS_DATASET_URL = process.env.PARIS_LOYERS_DATASET_URL ||
  'https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/logement-encadrement-des-loyers';

// ---------------------------------------------------------------------------
// Outils de lecture
// ---------------------------------------------------------------------------

export function normalizeText(value) {
  return String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// « lwr.IPm2 » → « lwripm2 », « INSEE_C » → « inseec »
export function normalizeKey(key) {
  return normalizeText(key).replace(/[^a-z0-9]/g, '');
}

// Nombres avec virgule décimale et espaces (« 12,34 », « 1 234 »)
export function toNumber(value) {
  if (value === null || value === undefined) return null;
  const n = parseFloat(String(value).trim().replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

// Code INSEE sur 5 caractères (les tableurs perdent le zéro initial de l'Ain à l'Aisne)
export function normalizeInsee(value) {
  const code = String(value ?? '').trim().toUpperCase();
  if (/^\d{4}$/.test(code)) return `0${code}`;
  return /^(\d{5}|2[AB]\d{3})$/.test(code) ? code : null;
}

export function departmentFromInsee(insee) {
  if (!insee) return null;
  return insee.startsWith('97') ? insee.slice(0, 3) : insee.slice(0, 2);
}

export function detectDelimiter(headerLine) {
  return [';', ',', '\t']
    .map(delimiter => ({ delimiter, count: headerLine.split(delimiter).length }))
    .sort((a, b) => b.count - a.count)[0].delimiter;
}

// Fichiers UTF-8 ou Windows-1252 selon les millésimes
export function decodeCsv(buffer) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return buffer.toString('latin1');
  }
}

// Catégorie d'un fichier de la Carte des loyers d'après son titre ou son nom de fichier
// (ex. « pred-app12-mef-dhup.csv », « Appartements 3 pièces et plus »)
export function categoryFromTitle(title) {
  const text = normalizeText(title).replace(/\b(19|20)\d{2}\b/g, ' ');
  if (/\bmai(son)?s?\b|maison/.test(text)) return 'maison';
  if (!/app/.test(text)) return null;
  if (/app3|3\s*(p|$|\b)/.test(text)) return 'appartement_3_plus';
  if (/app12|1\D{0,6}2|\bt1\b|studio/.test(text)) return 'appartement_1_2';
  return 'appartement';
}

// ---------------------------------------------------------------------------
// Carte des loyers
// ---------------------------------------------------------------------------

/**
 * Une ligne CSV → un indicateur. Colonnes attendues (toute casse) : INSEE_C, LIBGEO, EPCI,
 * DEP, REG, loypredm2 (loyer prédit €/m²), lwr.IPm2 / upr.IPm2 (intervalle de prédiction),
 * TYPPRED (prédiction au niveau de la commune ou d'une maille plus large), nbobs_com /
 * nbobs_mail (annonces observées dans la commune / la maille).
 */
export function parseCarteRow(raw, { category, year }) {
  const row = {};
  for (const [key, value] of Object.entries(raw)) row[normalizeKey(key)] = value;

  const insee = normalizeInsee(row.inseec ?? row.codeinsee ?? row.insee ?? row.codgeo ?? row.codecommune);
  const rentPerM2 = toNumber(row.loypredm2 ?? row.loypred ?? row.loyerm2 ?? row.loyer);
  if (!insee || !(rentPerM2 > 0) || rentPerM2 > 200) return null;

  const typpred = normalizeText(row.typpred);
  const observations = { commune: toNumber(row.nbobscom) ?? 0, maille: toNumber(row.nbobsmail) ?? 0 };
  let predictionLevel = 'commune';
  if (/mail/.test(typpred)) predictionLevel = 'maille';
  else if (!/com/.test(typpred) && observations.commune < 10) predictionLevel = 'maille';

  return {
    insee,
    name: String(row.libgeo ?? row.nomcommune ?? '').trim(),
    epci: row.epci ? String(row.epci).trim() : null,
    department: row.dep ? String(row.dep).trim().padStart(2, '0') : departmentFromInsee(insee),
    category,
    year,
    // Loyers d'annonce du 3e trimestre du millésime
    referenceDate: `${year}-09-01`,
    rentPerM2,
    low: toNumber(row.lwripm2),
    high: toNumber(row.upripm2),
    predictionLevel,
    predictionType: typpred || null,
    observations,
    zoneId: row.idzone ? String(row.idzone).trim() : null
  };
}

// Lit un fichier CSV de la Carte des loyers (séparateur et encodage détectés)
export async function parseCarteCsv(filePath, { category, year }) {
  if (!RENT_CATEGORIES.includes(category)) throw new Error(`Catégorie inconnue : ${category}`);
  const text = decodeCsv(fs.readFileSync(filePath)).replace(/^﻿/, '');
  const delimiter = detectDelimiter(text.split(/\r?\n/, 1)[0] || '');
  const parser = Readable.from([text]).pipe(parse({ columns: true, delimiter, skip_empty_lines: true, relax_column_count: true, trim: true }));

  const docs = new Map();
  const predictionTypes = new Map();
  let rows = 0;
  for await (const raw of parser) {
    rows++;
    const doc = parseCarteRow(raw, { category, year });
    if (!doc) continue;
    predictionTypes.set(doc.predictionType, (predictionTypes.get(doc.predictionType) || 0) + 1);
    // Une commune ne doit apparaître qu'une fois par fichier : la première ligne fait foi
    if (!docs.has(doc.insee)) docs.set(doc.insee, doc);
  }
  return { docs: [...docs.values()], rows, predictionTypes: Object.fromEntries(predictionTypes) };
}

export async function storeIndicators(docs, { category }) {
  if (docs.length < 100) throw new Error(`Fichier ${category} suspect : ${docs.length} communes seulement, import annulé`);
  const collection = await getCollection(RENT_INDICATORS_COLLECTION);
  await collection.createIndex({ insee: 1, category: 1 }, { unique: true, name: 'insee_category' });
  await collection.deleteMany({ category });
  const importedAt = new Date().toISOString();
  for (let i = 0; i < docs.length; i += 1000) {
    await collection.insertMany(docs.slice(i, i + 1000).map(doc => ({ ...doc, imported_at: importedAt })), { ordered: false });
  }
  return docs.length;
}

export async function fetchJson(url) {
  const response = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`${url} → HTTP ${response.status}`);
  return response.json();
}

// Millésime le plus récent de la Carte des loyers publié sur data.gouv.fr
export async function findLatestCarteDataset() {
  const query = encodeURIComponent("carte des loyers indicateurs de loyers d'annonce par commune");
  const data = await fetchJson(`${DATA_GOUV_API}/datasets/?q=${query}&page_size=20`);
  const candidates = (data.data || [])
    .map(d => ({ id: d.id, slug: d.slug, title: d.title, year: Number((String(d.title).match(/\b(20\d{2})\b/) || [])[1] || 0) }))
    .filter(d => /carte des loyers/i.test(d.title) && d.year > 0)
    .sort((a, b) => b.year - a.year);
  return candidates[0] || null;
}

/**
 * Ressources CSV d'un jeu « Carte des loyers » : { year, title, resources: { catégorie: { url, title } } }
 */
export async function resolveCarteResources(dataset) {
  const meta = await fetchJson(`${DATA_GOUV_API}/datasets/${encodeURIComponent(dataset)}/`);
  const yearFromTitle = (String(meta.title || '').match(/\b(20\d{2})\b/) || [])[1];
  const year = Number(process.env.LOYERS_YEAR || yearFromTitle || new Date().getFullYear());
  const resources = {};
  for (const resource of meta.resources || []) {
    const url = resource.latest || resource.url || '';
    const isCsv = /csv/i.test(resource.format || '') || /\.csv(\.gz)?(\?|$)/i.test(resource.url || '');
    if (!isCsv || !url) continue;
    const category = categoryFromTitle(`${resource.title || ''} ${(resource.url || '').split('/').pop()}`);
    if (category && !resources[category]) resources[category] = { url, title: resource.title || url };
  }
  return { year, title: meta.title, resources };
}

/**
 * Télécharge et importe la Carte des loyers. `urls` permet de donner directement les
 * fichiers par catégorie (sans passer par l'API data.gouv.fr).
 */
export async function ingestCarteDesLoyers({ dataset = process.env.LOYERS_DATASET, urls = null, year = null, log = console.log } = {}) {
  let resources = urls;
  let resolvedYear = year;
  if (!resources) {
    let target = dataset;
    if (!target) {
      const latest = await findLatestCarteDataset().catch(() => null);
      target = latest ? latest.id : DEFAULT_CARTE_DATASET;
      if (latest) log(`[Loyers] Dernier millésime trouvé : ${latest.title}`);
    }
    const resolved = await resolveCarteResources(target);
    log(`[Loyers] Jeu de données : ${resolved.title} (${resolved.year})`);
    resources = Object.fromEntries(Object.entries(resolved.resources).map(([category, r]) => [category, r.url]));
    resolvedYear = resolvedYear || resolved.year;
  }
  resolvedYear = Number(resolvedYear || new Date().getFullYear());

  const missing = RENT_CATEGORIES.filter(category => !resources[category]);
  if (missing.length === RENT_CATEGORIES.length) throw new Error('Aucun fichier CSV reconnu dans le jeu de données');
  if (missing.length > 0) log(`[Loyers] Catégories absentes du jeu de données : ${missing.join(', ')}`);

  const summary = {};
  for (const category of RENT_CATEGORIES) {
    if (!resources[category]) continue;
    const filePath = `/tmp/loyers_${category}_${resolvedYear}.csv`;
    log(`[Loyers] Téléchargement ${category} : ${resources[category]}`);
    try {
      await downloadFile(resources[category], filePath);
      summary[category] = await importCarteFile(filePath, { category, year: resolvedYear, log });
    } finally {
      fs.rmSync(filePath, { force: true });
    }
  }
  return { year: resolvedYear, summary };
}

export async function importCarteFile(filePath, { category, year, log = console.log }) {
  const { docs, rows, predictionTypes } = await parseCarteCsv(filePath, { category, year });
  log(`[Loyers] ${category} : ${rows} lignes → ${docs.length} communes (TYPPRED : ${JSON.stringify(predictionTypes)})`);
  const inserted = await storeIndicators(docs, { category });
  return { rows, inserted, predictionTypes };
}

// ---------------------------------------------------------------------------
// Encadrement des loyers à Paris
// ---------------------------------------------------------------------------

// « Avant 1946 », « 1946-1970 », « 1971-1990 », « Apres 1990 » → codes internes
export function normalizePeriod(text) {
  const t = normalizeText(text);
  if (/1946/.test(t) && /1970/.test(t)) return '1946_1970';
  if (/1971/.test(t) && /1990/.test(t)) return '1971_1990';
  if (/1946/.test(t) && /avant|<|jusqu|pre/.test(t)) return 'avant_1946';
  if (/1990/.test(t) && /apres|>|depuis|post/.test(t)) return 'apres_1990';
  if (/^avant/.test(t)) return 'avant_1946';
  if (/^apres/.test(t)) return 'apres_1990';
  return null;
}

// Nombre de pièces : 1, 2, 3 ou 4 (« 4 pièces et plus »)
function parseRooms(value) {
  const n = parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 4) : null;
}

function parseFurnished(properties) {
  if (typeof properties.meuble === 'boolean') return properties.meuble;
  const text = normalizeText(properties.meuble_txt ?? properties.meuble ?? properties.meublé ?? '');
  if (!text) return null;
  return /meubl/.test(text) && !/non/.test(text);
}

function featureGeometry(feature) {
  if (feature.geometry?.type) return feature.geometry;
  const shape = feature.properties?.geo_shape;
  if (shape?.geometry?.type) return shape.geometry;
  if (shape?.type && shape.coordinates) return shape;
  return null;
}

/**
 * GeoJSON des loyers de référence (une entité par quartier × pièces × époque × meublé) →
 * un document par quartier avec son contour et ses 32 références. Seule l'année la plus
 * récente (ou `year`) est conservée.
 */
export function parseParisFeatures(featureCollection, { year = null } = {}) {
  const features = featureCollection?.features || [];
  let targetYear = Number(year) || 0;
  if (!targetYear) {
    for (const feature of features) targetYear = Math.max(targetYear, Number(feature.properties?.annee) || 0);
  }
  const zones = new Map();
  for (const feature of features) {
    const p = feature.properties || {};
    if ((Number(p.annee) || 0) !== targetYear) continue;
    const quartierId = parseInt(p.id_quartier ?? p.code_grand_quartier ?? '', 10);
    const rooms = parseRooms(p.piece ?? p.pieces);
    const period = normalizePeriod(p.epoque);
    const furnished = parseFurnished(p);
    const ref = toNumber(p.ref);
    if (!quartierId || !rooms || !period || furnished === null || !(ref > 0)) continue;

    if (!zones.has(quartierId)) {
      zones.set(quartierId, {
        city: 'paris',
        year: targetYear,
        quartierId,
        quartierName: String(p.nom_quartier ?? '').trim(),
        zoneId: parseInt(p.id_zone ?? '', 10) || null,
        geometry: featureGeometry(feature),
        refs: []
      });
    }
    const zone = zones.get(quartierId);
    if (!zone.geometry) zone.geometry = featureGeometry(feature);
    if (zone.refs.some(r => r.rooms === rooms && r.period === period && r.furnished === furnished)) continue;
    zone.refs.push({
      rooms,
      period,
      furnished,
      ref,
      max: toNumber(p.max) ?? Math.round(ref * 120) / 100,
      min: toNumber(p.min) ?? Math.round(ref * 70) / 100
    });
  }
  return { year: targetYear, zones: [...zones.values()].filter(zone => zone.geometry && zone.refs.length > 0) };
}

export async function storeParisZones(zones) {
  if (zones.length < 10) throw new Error(`Encadrement Paris : ${zones.length} quartiers seulement, import annulé`);
  const collection = await getCollection(RENT_CONTROL_COLLECTION);
  await collection.createIndex({ geometry: '2dsphere' }, { name: 'geometry_2dsphere' });
  await collection.createIndex({ city: 1, quartierId: 1 }, { name: 'city_quartier' });
  await collection.deleteMany({ city: 'paris' });
  const importedAt = new Date().toISOString();
  const result = await collection.insertMany(zones.map(zone => ({ ...zone, imported_at: importedAt })), { ordered: false });
  return result.insertedCount;
}

// Champs du jeu de données parisien (noms et types) : l'année de l'arrêté n'est pas
// forcément nommée « annee » ni typée nombre selon les versions
export async function fetchParisFields() {
  const meta = await fetchJson(PARIS_DATASET_URL);
  return Array.isArray(meta?.fields) ? meta.fields : [];
}

export function findYearField(fields) {
  const normalized = fields.map(f => ({ ...f, key: normalizeText(f.name) }));
  return normalized.find(f => /^annee$/.test(f.key)) ||
    normalized.find(f => /annee|year|millesime/.test(f.key)) ||
    null;
}

function isNumericField(field) {
  return /int|double|float|decimal|number/i.test(field?.type || '');
}

/**
 * Année la plus récente de l'arrêté. L'API Explore v2.1 refuse les fonctions d'agrégation
 * selon les jeux de données : on lit d'abord les champs, puis on regroupe par année, avec un
 * tri décroissant en repli. Renvoie { year, field }.
 */
export async function fetchParisLatestYear() {
  const fields = await fetchParisFields().catch(() => []);
  const field = findYearField(fields) || { name: 'annee', type: 'int' };
  const name = encodeURIComponent(field.name);
  const attempts = [
    `${PARIS_DATASET_URL}/records?select=${name}&group_by=${name}&limit=100`,
    `${PARIS_DATASET_URL}/records?select=${name}&order_by=${encodeURIComponent(`${field.name} desc`)}&limit=1`,
    `${PARIS_DATASET_URL}/records?select=${name}&limit=100`
  ];
  const errors = [];
  for (const url of attempts) {
    try {
      const data = await fetchJson(url);
      const years = (data.results || []).map(r => Number(r[field.name])).filter(y => y > 2000);
      if (years.length > 0) return { year: Math.max(...years), field };
      errors.push(`${url} → aucune année`);
    } catch (error) {
      errors.push(error.message);
    }
  }
  throw new Error(`Année de l'encadrement introuvable : ${errors.join(' ; ')}`);
}

// Export GeoJSON de l'année : filtre « where » typé, ou « refine » (facette) en repli
export function parisExportUrls(year, field = { name: 'annee', type: 'int' }) {
  const literal = isNumericField(field) ? String(year) : `"${year}"`;
  return [
    `${PARIS_DATASET_URL}/exports/geojson?where=${encodeURIComponent(`${field.name}=${literal}`)}`,
    `${PARIS_DATASET_URL}/exports/geojson?where=${encodeURIComponent(`${field.name}=${isNumericField(field) ? `"${year}"` : year}`)}`,
    `${PARIS_DATASET_URL}/exports/geojson?refine=${encodeURIComponent(`${field.name}:${year}`)}`
  ];
}

export async function importParisFile(filePath, { year = null, log = console.log } = {}) {
  const collection = JSON.parse(decodeCsv(fs.readFileSync(filePath)));
  const parsed = parseParisFeatures(collection, { year });
  const refs = parsed.zones.reduce((sum, zone) => sum + zone.refs.length, 0);
  log(`[Loyers] Paris ${parsed.year} : ${parsed.zones.length} quartiers, ${refs} références`);
  const inserted = await storeParisZones(parsed.zones);
  return { year: parsed.year, zones: inserted, refs };
}

export async function ingestParisRentControl({ year = process.env.PARIS_LOYERS_YEAR, url = process.env.PARIS_LOYERS_URL, log = console.log } = {}) {
  let targetYear = Number(year) || null;
  let field = { name: 'annee', type: 'int' };
  if (!targetYear) {
    const latest = await fetchParisLatestYear();
    targetYear = latest.year;
    field = latest.field;
  } else {
    field = findYearField(await fetchParisFields().catch(() => [])) || field;
  }
  const filePath = `/tmp/loyers_paris_${targetYear}.geojson`;
  const sources = url ? [url] : parisExportUrls(targetYear, field);
  const errors = [];
  try {
    for (const source of sources) {
      log(`[Loyers] Téléchargement encadrement Paris ${targetYear} : ${source}`);
      try {
        await downloadFile(source, filePath);
        return await importParisFile(filePath, { year: targetYear, log });
      } catch (error) {
        errors.push(`${source} → ${error.message}`);
      }
    }
    throw new Error(`Encadrement Paris ${targetYear} : ${errors.join(' ; ')}`);
  } finally {
    fs.rmSync(filePath, { force: true });
  }
}
