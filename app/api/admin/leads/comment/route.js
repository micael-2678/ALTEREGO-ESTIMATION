import { json, preflight, adminHandler, readJson } from '@/lib/api-helpers';
import { getCollection } from '@/lib/mongodb';

export const OPTIONS = preflight;

// Ajout d'un commentaire sur un lead
export const POST = adminHandler(async (request) => {
  const { leadId, comment, author } = await readJson(request);
  if (!leadId || typeof comment !== 'string' || !comment.trim()) {
    return json(request, { error: 'Lead ID and comment are required' }, 400);
  }

  const commentObj = {
    author: typeof author === 'string' && author ? author.slice(0, 80) : 'Admin',
    comment: comment.slice(0, 5000),
    timestamp: new Date().toISOString()
  };

  const collection = await getCollection('leads');
  const result = await collection.updateOne(
    { id: String(leadId) },
    { $push: { comments: commentObj }, $set: { lastModified: new Date().toISOString() } }
  );
  if (result.matchedCount === 0) {
    return json(request, { error: 'Lead not found' }, 404);
  }
  return json(request, { success: true, comment: commentObj });
});
