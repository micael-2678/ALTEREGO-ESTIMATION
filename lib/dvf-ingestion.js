import https from 'https';
import http from 'http';
import fs from 'fs';
import { parse } from 'csv-parse';
import { getCollection } from './mongodb.js';

// URLs des fichiers DVF sur data.gouv.fr
const DVF_BASE_URL = 'https://files.data.gouv.fr/geo-dvf/latest/csv/2024/departements';

// Télécharger un fichier depuis une URL
export async function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(destPath);
    
    protocol.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Handle redirect
        file.close();
        fs.unlinkSync(destPath);
        return downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
      }
      
      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(destPath);
        return reject(new Error(`Failed to download: ${response.statusCode}`));
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        resolve(destPath);
      });
    }).on('error', (err) => {
      file.close();
      fs.unlinkSync(destPath);
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
  const commune = record.commune;
  if (!postalCode || !commune) return null;
  
  // Masquer le numéro exact (privacy)
  const numero = record.numero_voie ? 'XX' : null;
  
  return {
    date_mutation: date,
    numero_voie_masked: numero,
    type_voie: record.type_voie || '',
    voie: record.voie || '',
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
    nature_mutation: record.nature_mutation,
    imported_at: new Date().toISOString()
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

// Ingérer les données DVF d'un département
export async function ingestDVFDepartment(departmentCode, options = {}) {
  const { skipDownload = false, csvPath = null } = options;
  
  console.log(`[DVF] Starting ingestion for department ${departmentCode}...`);
  
  // Étape 1: Télécharger le CSV
  let filePath = csvPath;
  if (!skipDownload) {
    const url = `${DVF_BASE_URL}/${departmentCode}.csv`;
    filePath = `/tmp/dvf_${departmentCode}.csv`;
    
    console.log(`[DVF] Downloading from ${url}...`);
    try {
      await downloadFile(url, filePath);
      console.log(`[DVF] Downloaded to ${filePath}`);
    } catch (error) {
      console.error(`[DVF] Download failed:`, error.message);
      throw error;
    }
  }
  
  // Étape 2: Parser le CSV
  console.log(`[DVF] Parsing CSV...`);
  const records = [];
  const parser = fs.createReadStream(filePath).pipe(
    parse({
      columns: true,
      skip_empty_lines: true,
      delimiter: ',',
      relax_column_count: true
    })
  );
  
  for await (const record of parser) {
    records.push(record);
  }
  
  console.log(`[DVF] Parsed ${records.length} raw records`);
  
  // Étape 3: Nettoyer et normaliser
  console.log(`[DVF] Normalizing records...`);
  const normalized = [];
  const cutoffDate = new Date();
  cutoffDate.setFullYear(cutoffDate.getFullYear() - 5); // 5 dernières années
  
  for (const record of records) {
    const norm = normalizeRecord(record);
    if (norm) {
      const saleDate = new Date(norm.date_mutation);
      if (saleDate >= cutoffDate) {
        normalized.push(norm);
      }
    }
  }
  
  console.log(`[DVF] Normalized ${normalized.length} valid records (5 years)`);
  
  if (normalized.length === 0) {
    console.log(`[DVF] No valid records to import`);
    return { inserted: 0, total: records.length };
  }
  
  // Étape 4: Stocker dans MongoDB
  console.log(`[DVF] Storing in MongoDB...`);
  const collection = await getCollection('dvf_sales');
  
  // Créer les index
  await collection.createIndex({ latitude: 1, longitude: 1 });
  await collection.createIndex({ date_mutation: -1 });
  await collection.createIndex({ type_local: 1 });
  await collection.createIndex({ code_postal: 1 });
  await collection.createIndex({ code_departement: 1 });
  await collection.createIndex({ prix_m2: 1 });
  
  // Supprimer les anciennes données de ce département
  await collection.deleteMany({ code_departement: departmentCode });
  console.log(`[DVF] Cleared old data for department ${departmentCode}`);
  
  // Insérer par batches
  const batchSize = 1000;
  let inserted = 0;
  
  for (let i = 0; i < normalized.length; i += batchSize) {
    const batch = normalized.slice(i, i + batchSize);
    try {
      await collection.insertMany(batch, { ordered: false });
      inserted += batch.length;
      console.log(`[DVF] Inserted ${inserted}/${normalized.length}...`);
    } catch (error) {
      // Continue on duplicate key errors
      inserted += batch.length;
    }
  }
  
  console.log(`[DVF] ✓ Successfully ingested ${inserted} records for department ${departmentCode}`);
  
  // Cleanup
  if (!skipDownload && filePath) {
    fs.unlinkSync(filePath);
  }
  
  // Stats
  const stats = {
    inserted,
    total: records.length,
    appartements: await collection.countDocuments({ 
      code_departement: departmentCode, 
      type_local: 'appartement' 
    }),
    maisons: await collection.countDocuments({ 
      code_departement: departmentCode, 
      type_local: 'maison' 
    })
  };
  
  console.log(`[DVF] Stats: ${stats.appartements} appartements, ${stats.maisons} maisons`);
  
  return stats;
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