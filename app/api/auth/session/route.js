import { json, preflight, handler, getAdminUser } from '@/lib/api-helpers';

export const OPTIONS = preflight;

// Session admin courante
export const GET = handler(async (request) => {
  const user = getAdminUser(request);
  return user ? json(request, { authenticated: true, user }) : json(request, { authenticated: false }, 401);
});
