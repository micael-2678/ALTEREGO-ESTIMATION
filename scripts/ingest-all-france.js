#!/usr/bin/env node

/**
 * Script pour ingérer les données DVF de toute la France
 * Usage: node scripts/ingest-all-france.js
 */

import { ingestDVFDepartment } from '../lib/dvf-ingestion.js';
import { connectToDatabase } from '../lib/mongodb.js';

// Liste complète des départements français (métropole + DOM-TOM)
const FRENCH_DEPARTMENTS = [
  // Métropole
  '01', '02', '03', '04', '05', '06', '07', '08', '09', '10',
  '11', '12', '13', '14', '15', '16', '17', '18', '19', '21',
  '22', '23', '24', '25', '26', '27', '28', '29', '2A', '2B',
  '30', '31', '32', '33', '34', '35', '36', '37', '38', '39',
  '40', '41', '42', '43', '44', '45', '46', '47', '48', '49',
  '50', '51', '52', '53', '54', '55', '56', '57', '58', '59',
  '60', '61', '62', '63', '64', '65', '66', '67', '68', '69',
  '70', '71', '72', '73', '74', '75', '76', '77', '78', '79',
  '80', '81', '82', '83', '84', '85', '86', '87', '88', '89',
  '90', '91', '92', '93', '94', '95',
  // DOM-TOM (si disponibles)
  '971', '972', '973', '974', '976'
];

async function ingestAllFrance() {
  console.log('='.repeat(80));
  console.log('📦 INGESTION DVF - TOUTE LA FRANCE');
  console.log('='.repeat(80));
  console.log(`Départements à traiter : ${FRENCH_DEPARTMENTS.length}`);
  console.log('⚠️  ATTENTION : Cette opération peut prendre plusieurs heures');
  console.log('='.repeat(80));
  
  // Se connecter à MongoDB
  await connectToDatabase();
  
  const startTime = Date.now();
  let successCount = 0;
  let failCount = 0;
  const failedDepartments = [];
  
  // Traiter chaque département
  for (let i = 0; i < FRENCH_DEPARTMENTS.length; i++) {
    const dept = FRENCH_DEPARTMENTS[i];
    const progress = ((i + 1) / FRENCH_DEPARTMENTS.length * 100).toFixed(1);
    
    console.log('');
    console.log('-'.repeat(80));
    console.log(`[${i + 1}/${FRENCH_DEPARTMENTS.length}] Département ${dept} (${progress}%)`);
    console.log('-'.repeat(80));
    
    try {
      await ingestDVFDepartment(dept);
      successCount++;
      console.log(`✅ Département ${dept} : SUCCÈS`);
    } catch (error) {
      failCount++;
      failedDepartments.push(dept);
      console.error(`❌ Département ${dept} : ÉCHEC - ${error.message}`);
      // Continue avec le prochain département même en cas d'erreur
    }
    
    // Pause de 2 secondes entre chaque département pour ne pas surcharger le serveur
    if (i < FRENCH_DEPARTMENTS.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000 / 60).toFixed(2);
  
  // Résumé final
  console.log('');
  console.log('='.repeat(80));
  console.log('📊 RÉSUMÉ DE L\'INGESTION');
  console.log('='.repeat(80));
  console.log(`⏱️  Durée totale : ${duration} minutes`);
  console.log(`✅ Succès : ${successCount} départements`);
  console.log(`❌ Échecs : ${failCount} départements`);
  
  if (failedDepartments.length > 0) {
    console.log('');
    console.log('Départements en échec :');
    failedDepartments.forEach(dept => console.log(`  - ${dept}`));
    console.log('');
    console.log('💡 Vous pouvez ré-essayer les départements en échec avec :');
    console.log(`   node scripts/retry-failed.js ${failedDepartments.join(' ')}`);
  }
  
  console.log('='.repeat(80));
  console.log('✨ Ingestion terminée !');
  console.log('='.repeat(80));
  
  process.exit(failCount > 0 ? 1 : 0);
}

// Lancer l'ingestion
ingestAllFrance().catch(error => {
  console.error('❌ ERREUR FATALE:', error);
  process.exit(1);
});
