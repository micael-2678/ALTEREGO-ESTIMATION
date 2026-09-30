import { json, preflight, adminHandler } from '@/lib/api-helpers';
import { startDVFIngestion } from '@/lib/dvf-admin';

export const OPTIONS = preflight;

// Import DVF de toute la France, en arrière-plan
export const POST = adminHandler(async (request) => {
  try {
    return json(request, await startDVFIngestion());
  } catch (error) {
    return json(request, { error: error.message }, 400);
  }
});
