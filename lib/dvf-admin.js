import { getCollection } from './mongodb.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// État global de l'ingestion
let ingestionState = {
  isRunning: false,
  startTime: null,
  message: 'En attente'
};

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
  const collection = await getCollection('dvf_sales');
  const result = await collection.deleteMany({});
  
  return {
    deleted: result.deletedCount
  };
}
