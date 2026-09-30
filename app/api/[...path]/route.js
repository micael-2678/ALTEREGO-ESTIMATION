import { json, preflight } from '@/lib/api-helpers';

// Toute route /api inconnue répond en JSON (et non par la page 404 HTML)
const notFound = (request) => json(request, { error: 'Not found' }, 404);

export const OPTIONS = preflight;
export const GET = notFound;
export const POST = notFound;
export const PUT = notFound;
export const PATCH = notFound;
export const DELETE = notFound;
