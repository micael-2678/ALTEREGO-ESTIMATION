#!/usr/bin/env node

/**
 * Script de chargement automatique des données DVF embarquées
 * Charge le fichier /app/data/dvf_paris_10k.json dans MongoDB
 */

import { connectToDatabase, getCollection } from '../lib/mongodb.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function loadEmbeddedDVF() {
  console.log('🚀 Chargement des données DVF embarquées...\n');

  try {
    // Connexion à MongoDB
    await connectToDatabase();
    console.log('✅ Connexion MongoDB établie\n');

    const collection = await getCollection('dvf_sales');

    // Vérifier si déjà des données
    const existingCount = await collection.countDocuments();
    console.log(`📊 Documents existants : ${existingCount}`);

    if (existingCount > 5000) {
      console.log('✅ Données déjà présentes, aucun chargement nécessaire');
      process.exit(0);
    }

    // Charger le fichier JSON embarqué (50k transactions France entière)
    const dataPath = join(__dirname, '..', 'data', 'dvf_france_50k.json');
    console.log(`\n📂 Lecture du fichier : ${dataPath}`);
    
    const rawData = readFileSync(dataPath, 'utf-8');
    const dvfData = JSON.parse(rawData);
    
    console.log(`📊 ${dvfData.length} transactions à importer\n`);

    // Import par batch
    const batchSize = 1000;
    let imported = 0;

    for (let i = 0; i < dvfData.length; i += batchSize) {
      const batch = dvfData.slice(i, i + batchSize);
      await collection.insertMany(batch, { ordered: false }).catch(() => {});
      imported += batch.length;
      console.log(`   ✓ Importé : ${imported}/${dvfData.length} transactions`);
    }

    // Créer les index
    console.log('\n📑 Création des index...');
    await collection.createIndex({ latitude: 1, longitude: 1 });
    await collection.createIndex({ code_postal: 1 });
    await collection.createIndex({ code_departement: 1 });
    await collection.createIndex({ type_local: 1 });
    await collection.createIndex({ prix_m2: 1 });
    console.log('✅ Index créés');

    const finalCount = await collection.countDocuments();
    console.log(`\n✅ Import terminé : ${finalCount} transactions DVF dans la base`);
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Erreur lors du chargement :', error.message);
    process.exit(1);
  }
}

loadEmbeddedDVF();
