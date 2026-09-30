import { json, preflight, adminHandler } from '@/lib/api-helpers';
import { clearDVFData } from '@/lib/dvf-admin';

export const OPTIONS = preflight;

// Purge des données DVF
export const POST = adminHandler(async (request) => json(request, await clearDVFData()));
