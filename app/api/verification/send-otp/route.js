import { json, preflight, handler, readJson } from '@/lib/api-helpers';
import { issueOTP } from '@/lib/server/otp';

export const OPTIONS = preflight;

export const POST = handler(async (request) => {
  const { phone } = await readJson(request);
  if (!phone || typeof phone !== 'string') {
    return json(request, { error: 'Le numéro de téléphone est requis.' }, 400);
  }
  return issueOTP(request, phone);
});
