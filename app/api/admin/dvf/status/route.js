import { json, preflight, adminHandler } from '@/lib/api-helpers';
import { getCollection } from '@/lib/mongodb';

export const OPTIONS = preflight;

// Statistiques DVF par département
export const GET = adminHandler(async (request) => {
  const collection = await getCollection('dvf_sales');
  const stats = await collection.aggregate([
    {
      $group: {
        _id: '$code_departement',
        count: { $sum: 1 },
        appartements: { $sum: { $cond: [{ $eq: ['$type_local', 'appartement'] }, 1, 0] } },
        maisons: { $sum: { $cond: [{ $eq: ['$type_local', 'maison'] }, 1, 0] } },
        lastImport: { $max: '$imported_at' }
      }
    },
    { $sort: { _id: 1 } }
  ]).toArray();
  const total = await collection.countDocuments({});
  return json(request, { total, byDepartment: stats });
});
