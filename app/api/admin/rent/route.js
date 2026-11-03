import { json, preflight, adminHandler } from '@/lib/api-helpers';
import { getRentIngestionState, startRentIngestion } from '@/lib/rent-admin';

export const OPTIONS = preflight;

// GET : progression de l'import des références de loyers
export const GET = adminHandler(async (request) => json(request, getRentIngestionState()));

// POST : lance l'import (Carte des loyers + encadrement Paris) en arrière-plan
export const POST = adminHandler(async (request) => {
  try {
    return json(request, startRentIngestion());
  } catch (error) {
    return json(request, { error: error.message }, 409);
  }
});
