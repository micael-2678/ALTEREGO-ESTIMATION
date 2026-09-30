import { json, preflight, adminHandler, readJson } from '@/lib/api-helpers';
import { ingestDVFDepartment } from '@/lib/dvf-ingestion';

export const OPTIONS = preflight;

// Import DVF de départements choisis, en arrière-plan
export const POST = adminHandler(async (request) => {
  const { departments } = await readJson(request);
  if (!Array.isArray(departments) || departments.length === 0 ||
      !departments.every(d => /^(\d{2,3}|2[AB])$/.test(String(d)))) {
    return json(request, { error: 'Invalid departments array' }, 400);
  }

  setTimeout(async () => {
    try {
      for (const dept of departments) {
        console.log(`[API] Starting ingestion for department ${dept}...`);
        await ingestDVFDepartment(String(dept));
      }
    } catch (err) {
      console.error('[API] Ingestion error:', err);
    }
  }, 100);

  return json(request, { message: 'DVF ingestion started in background', departments });
});
