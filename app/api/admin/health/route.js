import { json, preflight, adminHandler } from '@/lib/api-helpers';
import { getServiceHealth } from '@/lib/server/health';

export const OPTIONS = preflight;

// État du service : base DVF, envoi des SMS (clé et crédits Brevo), numéros dispensés
export const GET = adminHandler(async (request) => json(request, await getServiceHealth()));
