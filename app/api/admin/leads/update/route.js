import { json, preflight, adminHandler, readJson } from '@/lib/api-helpers';
import { getCollection } from '@/lib/mongodb';
import { LEAD_STATUSES } from '@/lib/server/leads';

export const OPTIONS = preflight;

// Mise à jour d'un lead (statut, coordonnées)
export const POST = adminHandler(async (request) => {
  const { leadId, status, updates } = await readJson(request);
  if (!leadId) {
    return json(request, { error: 'Lead ID is required' }, 400);
  }

  const updateObj = {};
  const newStatus = status || updates?.status;
  if (newStatus) {
    if (!LEAD_STATUSES.includes(newStatus)) {
      return json(request, { error: 'Invalid status' }, 400);
    }
    updateObj.status = newStatus;
  }
  if (updates) {
    if (typeof updates.name === 'string' && updates.name) updateObj.name = updates.name.slice(0, 120);
    if (typeof updates.email === 'string' && updates.email) updateObj.email = updates.email.slice(0, 200);
    if (typeof updates.phone === 'string') updateObj.phone = updates.phone.slice(0, 30);
  }
  updateObj.lastModified = new Date().toISOString();

  const collection = await getCollection('leads');
  const result = await collection.updateOne({ id: String(leadId) }, { $set: updateObj });
  if (result.matchedCount === 0) {
    return json(request, { error: 'Lead not found' }, 404);
  }
  return json(request, { success: true, updated: result.modifiedCount > 0 });
});
