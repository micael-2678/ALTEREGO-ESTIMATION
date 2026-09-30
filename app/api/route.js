import { json, preflight, handler } from '@/lib/api-helpers';

export const OPTIONS = preflight;

export const GET = handler(async (request) =>
  json(request, { message: 'AlterEgo API is running', version: '2.2.0' })
);
