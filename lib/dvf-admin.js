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

// Démarrer l'ingestion DVF
export async function startDVFIngestion() {
  if (ingestionState.isRunning) {
    throw new Error('Une ingestion est déjà en cours');
  }
  
  ingestionState.isRunning = true;
  ingestionState.startTime = new Date().toISOString();
  ingestionState.message = 'Démarrage...';
  
  // Lancer en arrière-plan sans bloquer la réponse API
  setTimeout(async () => {
    try {
      console.log('[DVF] Starting ingestion...');
      const { stdout, stderr } = await execAsync('cd /app && node scripts/ingest-all-france.js > /tmp/dvf-ingestion.log 2>&1 &');
      ingestionState.message = 'Ingestion lancée en arrière-plan';
    } catch (error) {
      console.error('[DVF] Ingestion error:', error);
      ingestionState.isRunning = false;
      ingestionState.message = 'Erreur: ' + error.message;
    }
  }, 100);
  
  return {
    message: 'Ingestion démarrée en arrière-plan. Consultez les logs serveur ou rechargez la page dans 20 minutes.',
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
