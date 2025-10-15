import { getCollection, connectToDatabase } from './mongodb.js';
import { ingestDVFDepartment } from './dvf-ingestion.js';

// État global de l'ingestion
let ingestionState = {
  isRunning: false,
  startTime: null,
  message: 'En attente',
  progress: 0,
  completed: 0,
  failed: 0
};

// Liste complète des départements français
const FRENCH_DEPARTMENTS = [
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
  '971', '972', '973', '974', '976'
];

// Récupérer les statistiques DVF
export async function getDVFStats() {
  try {
    const collection = await getCollection('dvf_sales');
    
    const total = await collection.countDocuments();
    
    if (total === 0) {
      return {
        total: 0,
        byType: {},
        byDepartment: [],
        lastUpdate: null
      };
    }
    
    // Stats par type
    const byType = await collection.aggregate([
      { $group: { _id: '$type_local', count: { $sum: 1 } } }
    ]).toArray();
    
    // Top 10 départements
    const byDepartment = await collection.aggregate([
      { 
        $group: { 
          _id: '$code_departement', 
          count: { $sum: 1 },
          lastImport: { $max: '$imported_at' }
        } 
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]).toArray();
    
    // Dernière mise à jour
    const lastDoc = await collection.findOne({}, { sort: { imported_at: -1 } });
    
    return {
      total,
      byType: byType.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      byDepartment: byDepartment.map(d => ({
        code: d._id,
        count: d.count,
        lastImport: d.lastImport
      })),
      lastUpdate: lastDoc?.imported_at || null
    };
  } catch (error) {
    console.error('Error in getDVFStats:', error);
    return {
      total: 0,
      byType: {},
      byDepartment: [],
      lastUpdate: null
    };
  }
}

// Fonction d'ingestion en arrière-plan
async function runIngestionInBackground() {
  console.log('[DVF] 📦 INGESTION DVF - TOUTE LA FRANCE');
  console.log(`[DVF] Départements à traiter : ${FRENCH_DEPARTMENTS.length}`);
  
  await connectToDatabase();
  
  const startTime = Date.now();
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < FRENCH_DEPARTMENTS.length; i++) {
    const dept = FRENCH_DEPARTMENTS[i];
    const progress = ((i + 1) / FRENCH_DEPARTMENTS.length * 100).toFixed(1);
    
    ingestionState.progress = parseInt(progress);
    ingestionState.message = `Traitement département ${dept} (${progress}%)`;
    
    console.log(`[DVF] [${i + 1}/${FRENCH_DEPARTMENTS.length}] Département ${dept} (${progress}%)`);
    
    try {
      await ingestDVFDepartment(dept);
      successCount++;
      ingestionState.completed = successCount;
      console.log(`[DVF] ✅ Département ${dept} : SUCCÈS`);
    } catch (error) {
      failCount++;
      ingestionState.failed = failCount;
      console.error(`[DVF] ❌ Département ${dept} : ÉCHEC`, error.message);
    }
  }
  
  const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
  
  console.log('[DVF] ================================================================================');
  console.log('[DVF] 📊 RÉSUMÉ DE L\'INGESTION');
  console.log('[DVF] ================================================================================');
  console.log(`[DVF] ⏱️  Durée totale : ${duration} minutes`);
  console.log(`[DVF] ✅ Succès : ${successCount} départements`);
  console.log(`[DVF] ❌ Échecs : ${failCount} départements`);
  console.log('[DVF] ================================================================================');
  console.log('[DVF] ✨ Ingestion terminée !');
  
  ingestionState.isRunning = false;
  ingestionState.message = `Terminée ! ${successCount} succès, ${failCount} échecs`;
  ingestionState.progress = 100;
}

// Démarrer l'ingestion DVF
export async function startDVFIngestion() {
  if (ingestionState.isRunning) {
    throw new Error('Une ingestion est déjà en cours');
  }
  
  ingestionState.isRunning = true;
  ingestionState.startTime = new Date().toISOString();
  ingestionState.progress = 0;
  ingestionState.completed = 0;
  ingestionState.failed = 0;
  ingestionState.message = 'Démarrage de l\'ingestion...';
  
  // Lancer en arrière-plan sans bloquer la réponse API
  setTimeout(() => {
    runIngestionInBackground().catch(error => {
      console.error('[DVF] Erreur fatale d\'ingestion:', error);
      ingestionState.isRunning = false;
      ingestionState.message = 'Erreur fatale: ' + error.message;
    });
  }, 100);
  
  return {
    message: 'Ingestion démarrée en arrière-plan. Rafraîchissez la page toutes les 2-3 minutes pour voir la progression.',
    state: ingestionState
  };
}

// Récupérer l'état de l'ingestion
export function getIngestionState() {
  return ingestionState;
}

// Vider la base DVF
export async function clearDVFData() {
  try {
    const collection = await getCollection('dvf_sales');
    const result = await collection.deleteMany({});
    
    return {
      deleted: result.deletedCount,
      success: true
    };
  } catch (error) {
    console.error('Error clearing DVF data:', error);
    throw new Error('Erreur lors de la suppression: ' + error.message);
  }
}
