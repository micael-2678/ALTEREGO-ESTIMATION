import { json, preflight, handler, readJson, rateLimit, clientIp } from '@/lib/api-helpers';
import { parseEstimateParams, computeEstimation } from '@/lib/server/estimation';
import { attachEstimation } from '@/lib/server/leads';

export const OPTIONS = preflight;

// Estimation complète. Si leadId est fourni, l'estimation est rattachée au lead
// existant (un seul lead par estimation, plus de doublon).
export const POST = handler(async (request) => {
  const body = await readJson(request);
  const { params, error } = parseEstimateParams(body);
  if (error) return json(request, { error }, 400);

  if (!rateLimit(`estimate:${clientIp(request)}`, { limit: 30, windowMs: 60 * 60 * 1000 })) {
    return json(request, { error: 'Trop de demandes. Réessayez plus tard.' }, 429);
  }

  const result = await computeEstimation({
    ...params,
    characteristics: body.characteristics && typeof body.characteristics === 'object' ? body.characteristics : {}
  });

  if (typeof body.leadId === 'string' && body.leadId) {
    await attachEstimation(body.leadId, result);
  }

  return json(request, result);
});
