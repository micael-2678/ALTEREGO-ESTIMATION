#!/usr/bin/env node

/**
 * Script pour ré-essayer l'ingestion DVF de départements spécifiques
 * Usage: node scripts/retry-failed.js 75 92 93
 */

import { ingestDVFDepartment } from '../lib/dvf-ingestion.js';
import { connectToDatabase } from '../lib/mongodb.js';

async function retryDepartments(departments) {
  if (departments.length === 0) {
    console.log('❌ Erreur : Aucun département spécifié');
    console.log('Usage: node scripts/retry-failed.js 75 92 93');
    process.exit(1);
  }
  
  console.log('='.repeat(80));
  console.log('🔄 RÉESSAI INGESTION DVF');
  console.log('='.repeat(80));
  console.log(`Départements à traiter : ${departments.join(', ')}`);
  console.log('='.repeat(80));
  
  // Se connecter à MongoDB
  await connectToDatabase();
  
  let successCount = 0;
  let failCount = 0;
  
  for (const dept of departments) {
    console.log('');
    console.log('-'.repeat(80));
    console.log(`Département ${dept}`);
    console.log('-'.repeat(80));
    
    try {
      await ingestDVFDepartment(dept);
      successCount++;
      console.log(`✅ Département ${dept} : SUCCÈS`);
    } catch (error) {
      failCount++;
      console.error(`❌ Département ${dept} : ÉCHEC - ${error.message}`);
    }
    
    // Pause entre départements
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('');
  console.log('='.repeat(80));
  console.log('📊 RÉSUMÉ');
  console.log('='.repeat(80));
  console.log(`✅ Succès : ${successCount}`);
  console.log(`❌ Échecs : ${failCount}`);
  console.log('='.repeat(80));
  
  process.exit(failCount > 0 ? 1 : 0);
}

// Récupérer les départements depuis les arguments
const departments = process.argv.slice(2);
retryDepartments(departments).catch(error => {
  console.error('❌ ERREUR FATALE:', error);
  process.exit(1);
});
