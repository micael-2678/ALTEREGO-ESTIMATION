import { json, preflight, handler } from '@/lib/api-helpers';

export const OPTIONS = preflight;

// Géocodage via la Base Adresse Nationale
export const GET = handler(async (request) => {
  const address = (new URL(request.url).searchParams.get('address') || '').trim();
  if (address.length < 3) {
    return json(request, { error: 'Address is required' }, 400);
  }

  const response = await fetch(
    `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(address.slice(0, 200))}&limit=5&autocomplete=1`,
    { signal: AbortSignal.timeout(5000) }
  );
  if (!response.ok) {
    return json(request, { suggestions: [] });
  }
  const data = await response.json();

  const suggestions = (data.features || []).map(f => ({
    address: f.properties.label,
    lat: f.geometry.coordinates[1],
    lng: f.geometry.coordinates[0],
    city: f.properties.city,
    postalCode: f.properties.postcode
  }));
  return json(request, { suggestions });
});
