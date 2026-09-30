import { json, preflight, handler } from '@/lib/api-helpers';
import { getAdaptiveComparables } from '@/lib/dvf-enhanced';
import { parseEstimateParams, DVF_SEARCH } from '@/lib/server/estimation';

export const OPTIONS = preflight;

// Comparables DVF seuls
export const GET = handler(async (request) => {
  const { searchParams } = new URL(request.url);
  const { params, error } = parseEstimateParams({
    lat: searchParams.get('lat'),
    lng: searchParams.get('lng'),
    type: searchParams.get('type'),
    surface: searchParams.get('surface')
  });
  if (error) return json(request, { error }, 400);

  const radiusMeters = Math.min(parseInt(searchParams.get('radiusMeters')) || 500, DVF_SEARCH.maxRadiusMeters);
  const months = Math.min(parseInt(searchParams.get('months')) || 24, DVF_SEARCH.maxMonths);

  const result = await getAdaptiveComparables({
    ...params,
    ...DVF_SEARCH,
    initialRadiusMeters: radiusMeters,
    months
  });
  return json(request, result);
});
