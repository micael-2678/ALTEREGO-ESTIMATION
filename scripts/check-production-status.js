#!/usr/bin/env node

/**
 * Script de diagnostic rapide pour vérifier l'état de l'application en production
 * Usage: node scripts/check-production-status.js
 */

import { connectToDatabase, getCollection } from '../lib/mongodb.js';

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(color, icon, message) {
  console.log(`${color}${icon} ${message}${COLORS.reset}`);
}

async function checkProductionStatus() {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 DIAGNOSTIC ALTEREGO - PRODUCTION STATUS');
  console.log('='.repeat(80) + '\n');

  // 1. Variables d'environnement
  log(COLORS.cyan, '📋', 'VARIABLES D\'ENVIRONNEMENT');
  console.log('-'.repeat(80));
  
  const envVars = {
    'MONGO_URL': process.env.MONGO_URL || '❌ NON DÉFINI',
    'DB_NAME': process.env.DB_NAME || '❌ NON DÉFINI',
    'NEXT_PUBLIC_BASE_URL': process.env.NEXT_PUBLIC_BASE_URL || '❌ NON DÉFINI',
    'AUTO_LOAD_DVF': process.env.AUTO_LOAD_DVF || '❌ NON DÉFINI',
    'DVF_LOAD_MODE': process.env.DVF_LOAD_MODE || '❌ NON DÉFINI (défaut: complete)',
    'ADMIN_USERNAME': process.env.ADMIN_USERNAME ? '✅ DÉFINI' : '❌ NON DÉFINI',
    'ADMIN_PASSWORD': process.env.ADMIN_PASSWORD ? '✅ DÉFINI' : '❌ NON DÉFINI',
    'JWT_SECRET': process.env.JWT_SECRET ? '✅ DÉFINI' : '❌ NON DÉFINI',
  };

  for (const [key, value] of Object.entries(envVars)) {
    const status = value.includes('❌') ? COLORS.red : COLORS.green;
    console.log(`  ${status}${key}${COLORS.reset}: ${value}`);
  }

  // 2. Connexion MongoDB
  console.log('\n' + '-'.repeat(80));
  log(COLORS.cyan, '🗄️', 'CONNEXION MONGODB');
  console.log('-'.repeat(80));

  try {
    await connectToDatabase();
    log(COLORS.green, '✅', 'Connexion MongoDB réussie');
  } catch (error) {
    log(COLORS.red, '❌', `Erreur de connexion MongoDB: ${error.message}`);
    process.exit(1);
  }

  // 3. Données DVF
  console.log('\n' + '-'.repeat(80));
  log(COLORS.cyan, '📊', 'DONNÉES DVF');
  console.log('-'.repeat(80));

  try {
    const collection = await getCollection('dvf_sales');
    const count = await collection.countDocuments();
    
    if (count === 0) {
      log(COLORS.red, '❌', 'Base de données VIDE - Aucune transaction DVF');
      console.log(`  ${COLORS.yellow}💡 Solution:${COLORS.reset}`);
      console.log(`     1. Vérifiez que AUTO_LOAD_DVF=true dans Dokploy`);
      console.log(`     2. Redéployez l'application`);
      console.log(`     3. OU exécutez manuellement: node scripts/ingest-all-france.js`);
    } else if (count < 1000) {
      log(COLORS.yellow, '⚠️', `Base de données INCOMPLÈTE - ${count} transactions`);
      console.log(`  ${COLORS.yellow}💡 Recommandation:${COLORS.reset} Chargez plus de données`);
    } else if (count < 100000) {
      log(COLORS.green, '✅', `Base de données OK - ${count.toLocaleString()} transactions`);
      console.log(`  ${COLORS.cyan}ℹ️  Mode:${COLORS.reset} Données partielles (développement)`);
    } else {
      log(COLORS.green, '✅', `Base de données EXCELLENTE - ${count.toLocaleString()} transactions`);
      console.log(`  ${COLORS.cyan}ℹ️  Mode:${COLORS.reset} Production complète`);
    }

    // Statistiques détaillées
    if (count > 0) {
      console.log('\n  📈 Statistiques:');
      
      // Par type
      const appartCount = await collection.countDocuments({ type_local: 'appartement' });
      const maisonCount = await collection.countDocuments({ type_local: 'maison' });
      console.log(`     - Appartements: ${appartCount.toLocaleString()}`);
      console.log(`     - Maisons: ${maisonCount.toLocaleString()}`);
      
      // Par département (top 5)
      console.log('\n  🗺️  Top 5 départements:');
      const topDepts = await collection.aggregate([
        { $group: { _id: '$code_departement', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 }
      ]).toArray();
      
      for (const dept of topDepts) {
        console.log(`     - Département ${dept._id}: ${dept.count.toLocaleString()} transactions`);
      }
      
      // Date la plus récente
      const latest = await collection.findOne({}, { sort: { date_mutation: -1 } });
      if (latest) {
        console.log(`\n  📅 Transaction la plus récente: ${latest.date_mutation}`);
      }
      
      // Index
      console.log('\n  🔍 Index créés:');
      const indexes = await collection.indexes();
      for (const index of indexes) {
        const keys = Object.keys(index.key).join(' + ');
        console.log(`     - ${keys}`);
      }
    }
  } catch (error) {
    log(COLORS.red, '❌', `Erreur lors de la lecture des données: ${error.message}`);
  }

  // 4. Test API Estimation
  console.log('\n' + '-'.repeat(80));
  log(COLORS.cyan, '🧪', 'TEST API ESTIMATION (Paris)');
  console.log('-'.repeat(80));

  try {
    const collection = await getCollection('dvf_sales');
    
    // Recherche de comparables à Paris (48.8566, 2.3522)
    const testLat = 48.8566;
    const testLng = 2.3522;
    const radius = 500; // mètres
    
    const latDelta = radius / 111000;
    const lngDelta = radius / (111000 * Math.cos(testLat * Math.PI / 180));
    
    const comparables = await collection.find({
      latitude: { $gte: testLat - latDelta, $lte: testLat + latDelta },
      longitude: { $gte: testLng - lngDelta, $lte: testLng + lngDelta },
      type_local: 'appartement',
      surface_reelle_bati: { $gte: 50, $lte: 100 }
    }).limit(10).toArray();
    
    if (comparables.length > 0) {
      log(COLORS.green, '✅', `API fonctionnelle - ${comparables.length} comparables trouvés`);
      console.log(`  ${COLORS.cyan}ℹ️  Zone testée:${COLORS.reset} Paris Centre (lat: ${testLat}, lng: ${testLng})`);
      console.log(`  ${COLORS.cyan}ℹ️  Critères:${COLORS.reset} Appartements 50-100m² dans 500m`);
      
      if (comparables.length >= 3) {
        const avgPrice = comparables.reduce((sum, c) => sum + c.prix_m2, 0) / comparables.length;
        console.log(`  ${COLORS.cyan}📊 Prix moyen:${COLORS.reset} ${Math.round(avgPrice).toLocaleString()} €/m²`);
      }
    } else {
      log(COLORS.yellow, '⚠️', 'Aucun comparable trouvé pour le test');
      console.log(`  ${COLORS.yellow}💡 Note:${COLORS.reset} Cela peut être normal si vous n'avez chargé que certains départements`);
    }
  } catch (error) {
    log(COLORS.red, '❌', `Erreur lors du test API: ${error.message}`);
  }

  // 5. Vérification des leads
  console.log('\n' + '-'.repeat(80));
  log(COLORS.cyan, '📝', 'LEADS COLLECTÉS');
  console.log('-'.repeat(80));

  try {
    const leadsCollection = await getCollection('leads');
    const leadCount = await leadsCollection.countDocuments();
    
    if (leadCount > 0) {
      log(COLORS.green, '✅', `${leadCount} lead(s) collecté(s)`);
      
      const statusGroups = await leadsCollection.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]).toArray();
      
      console.log('  📊 Par statut:');
      for (const group of statusGroups) {
        console.log(`     - ${group._id || 'nouveau'}: ${group.count}`);
      }
    } else {
      log(COLORS.yellow, '⚠️', 'Aucun lead collecté pour le moment');
    }
  } catch (error) {
    log(COLORS.yellow, '⚠️', `Collection leads non initialisée (normal au premier démarrage)`);
  }

  // 6. Résumé final
  console.log('\n' + '='.repeat(80));
  log(COLORS.blue, '📋', 'RÉSUMÉ');
  console.log('='.repeat(80));

  const collection = await getCollection('dvf_sales');
  const dvfCount = await collection.countDocuments();
  
  if (dvfCount === 0) {
    log(COLORS.red, '❌', 'APPLICATION NON FONCTIONNELLE');
    console.log(`\n  ${COLORS.yellow}🔧 Actions requises:${COLORS.reset}`);
    console.log('     1. Configurez AUTO_LOAD_DVF=true dans Dokploy');
    console.log('     2. Choisissez DVF_LOAD_MODE=complete ou DVF_LOAD_MODE=quick');
    console.log('     3. Redéployez l\'application');
  } else if (dvfCount < 1000) {
    log(COLORS.yellow, '⚠️', 'APPLICATION PARTIELLEMENT FONCTIONNELLE');
    console.log(`\n  ${COLORS.cyan}💡 Recommandation:${COLORS.reset} Chargez plus de données pour une meilleure couverture`);
  } else {
    log(COLORS.green, '✅', 'APPLICATION OPÉRATIONNELLE');
    console.log(`\n  ${COLORS.green}🎉 Tout est prêt !${COLORS.reset} Votre application est prête pour la production.`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('');

  process.exit(0);
}

// Exécuter le diagnostic
checkProductionStatus().catch(error => {
  console.error('\n❌ ERREUR FATALE:', error);
  process.exit(1);
});
