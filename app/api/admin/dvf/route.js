import { json, preflight, adminHandler } from '@/lib/api-helpers';
import { getDVFStats, startDVFIngestion, getIngestionState, clearDVFData } from '@/lib/dvf-admin';

export const OPTIONS = preflight;

// GET ?action=stats|status : statistiques et progression de l'import
export const GET = adminHandler(async (request) => {
  const action = new URL(request.url).searchParams.get('action');
  if (action === 'stats' || !action) return json(request, await getDVFStats());
  if (action === 'status') return json(request, getIngestionState());
  return json(request, { error: 'Invalid action' }, 400);
});

// POST ?action=start|clear : lancer l'import complet ou vider les données
export const POST = adminHandler(async (request) => {
  const action = new URL(request.url).searchParams.get('action');
  if (action === 'start') {
    try {
      return json(request, await startDVFIngestion());
    } catch (error) {
      return json(request, { error: error.message }, 400);
    }
  }
  if (action === 'clear') return json(request, await clearDVFData());
  return json(request, { error: 'Invalid action' }, 400);
});
