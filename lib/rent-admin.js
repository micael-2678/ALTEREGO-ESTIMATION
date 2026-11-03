import { connectToDatabase } from './mongodb.js';
import { ingestCarteDesLoyers, ingestParisRentControl } from './rent-ingestion.js';

// Import des références de loyers lancé depuis l'admin (sans accès au serveur)

let state = { isRunning: false, startedAt: null, finishedAt: null, message: 'Aucun import lancé depuis le démarrage', steps: [] };

export function getRentIngestionState() {
  return state;
}

async function runStep(label, fn) {
  const step = { label, status: 'running', message: '' };
  state.steps.push(step);
  state.message = `${label} en cours…`;
  try {
    step.message = await fn((line) => {
      console.log(line);
      step.message = line.replace(/^\[Loyers\]\s*/, '');
    });
    step.status = 'ok';
  } catch (error) {
    console.error(`[Loyers] ${label} : échec`, error);
    step.status = 'error';
    step.message = error.message;
  }
}

async function run() {
  await connectToDatabase();
  await runStep('Carte des loyers', async (log) => {
    const result = await ingestCarteDesLoyers({ log });
    const counts = Object.entries(result.summary).map(([category, s]) => `${category} : ${s.inserted}`).join(', ');
    return `Millésime ${result.year} importé (${counts})`;
  });
  await runStep('Encadrement des loyers à Paris', async (log) => {
    const result = await ingestParisRentControl({ log });
    return `Arrêté ${result.year} : ${result.zones} quartiers, ${result.refs} références`;
  });
  const failed = state.steps.filter(s => s.status === 'error').length;
  state.isRunning = false;
  state.finishedAt = new Date().toISOString();
  state.message = failed === 0 ? 'Import terminé' : `Import terminé avec ${failed} échec(s)`;
}

export function startRentIngestion() {
  if (state.isRunning) throw new Error('Un import des loyers est déjà en cours');
  state = { isRunning: true, startedAt: new Date().toISOString(), finishedAt: null, message: 'Démarrage…', steps: [] };
  setTimeout(() => {
    run().catch(error => {
      console.error('[Loyers] Erreur fatale :', error);
      state.isRunning = false;
      state.finishedAt = new Date().toISOString();
      state.message = `Erreur : ${error.message}`;
    });
  }, 50);
  return state;
}
