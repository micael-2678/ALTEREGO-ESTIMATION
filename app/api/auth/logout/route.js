import { json, preflight, handler, adminCookie } from '@/lib/api-helpers';

export const OPTIONS = preflight;

export const POST = handler(async (request) => {
  const response = json(request, { success: true });
  response.headers.append('Set-Cookie', adminCookie(null));
  return response;
});
