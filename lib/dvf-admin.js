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
  
  // Réinitialiser l'état
  ingestionState = {
    isRunning: true,
    progress: 0,
    currentDepartment: null,
    totalDepartments: FRENCH_DEPARTMENTS.length,
    completed: 0,
    failed: 0,
    startTime: new Date().toISOString(),
    logs: [],
    failedDepartments: []
  };
  
  // Lancer l'ingestion en arrière-plan
  const scriptPath = join(dirname(__dirname), 'scripts', 'ingest-all-france.js');
  
  const child = spawn('node', [scriptPath], {
    detached: true,
    stdio: 'pipe'
  });
  
  // Capturer la sortie
  child.stdout.on('data', (data) => {
    const message = data.toString();
    console.log('[DVF Ingestion]', message);
    
    // Parser les logs pour extraire la progression
    parseIngestionLog(message);
  });
  
  child.stderr.on('data', (data) => {
    const error = data.toString();
    console.error('[DVF Ingestion Error]', error);
    ingestionState.logs.push({
      type: 'error',
      message: error,
      timestamp: new Date().toISOString()
    });
  });
  
  child.on('close', (code) => {
    ingestionState.isRunning = false;
    ingestionState.progress = 100;
    ingestionState.logs.push({
      type: code === 0 ? 'success' : 'error',
      message: code === 0 ? 'Ingestion terminée avec succès' : `Ingestion terminée avec erreurs (code ${code})`,
      timestamp: new Date().toISOString()
    });
  });
  
  // Détacher le processus
  child.unref();
  
  return {
    message: 'Ingestion démarrée',
    state: getIngestionState()
  };
}

// Parser les logs pour extraire la progression
function parseIngestionLog(message) {
  // Détecter le département en cours
  const deptMatch = message.match(/\[(\d+)\/(\d+)\] Département (\d+|2[AB])/);
  if (deptMatch) {
    const [, current, total, dept] = deptMatch;
    ingestionState.currentDepartment = dept;
    ingestionState.progress = Math.round((parseInt(current) / parseInt(total)) * 100);
  }
  
  // Détecter un succès
  if (message.includes('✅') && message.includes('SUCCÈS')) {
    ingestionState.completed++;
    const deptMatch = message.match(/Département (\d+|2[AB])/);
    if (deptMatch) {
      ingestionState.logs.push({
        type: 'success',
        message: `Département ${deptMatch[1]} : succès`,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  // Détecter un échec
  if (message.includes('❌') && message.includes('ÉCHEC')) {
    ingestionState.failed++;
    const deptMatch = message.match(/Département (\d+|2[AB])/);
    if (deptMatch) {
      ingestionState.failedDepartments.push(deptMatch[1]);
      ingestionState.logs.push({
        type: 'error',
        message: `Département ${deptMatch[1]} : échec`,
        timestamp: new Date().toISOString()
      });
    }
  }
}

// Récupérer l'état de l'ingestion
export function getIngestionState() {
  return {
    ...ingestionState,
    logs: ingestionState.logs.slice(-50) // Garder seulement les 50 derniers logs
  };
}

// Vider la base DVF
export async function clearDVFData() {
  const collection = await getCollection('dvf_sales');
  const result = await collection.deleteMany({});
  
  return {
    deleted: result.deletedCount
  };
}
