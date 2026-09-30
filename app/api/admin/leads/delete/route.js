import { json, preflight, adminHandler } from '@/lib/api-helpers';
import { getCollection } from '@/lib/mongodb';

export const OPTIONS = preflight;

// Suppression d'un lead
export const DELETE = adminHandler(async (request) => {
  const leadId = new URL(request.url).searchParams.get('leadId');
  if (!leadId) {
    return json(request, { error: 'Lead ID is required' }, 400);
  }

  const collection = await getCollection('leads');
  const result = await collection.deleteOne({ id: leadId });
  if (result.deletedCount === 0) {
    return json(request, { error: 'Lead not found' }, 404);
  }
  return json(request, { success: true, deleted: true });
});
