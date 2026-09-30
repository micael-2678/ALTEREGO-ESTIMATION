#!/usr/bin/env node
/**
 * Suppression des leads conservés au-delà de la durée RGPD (36 mois par défaut après le
 * dernier échange, réglable avec NEXT_PUBLIC_LEGAL_LEAD_RETENTION_MONTHS).
 *
 * Usage : node scripts/purge-leads.js            → affiche le nombre de leads concernés
 *         node scripts/purge-leads.js --apply    → les supprime
 * À planifier une fois par mois (tâche planifiée Dokploy ou cron).
 */
import { connectToDatabase } from '../lib/mongodb.js';
import { expiredLeadsFilter, retentionCutoff } from '../lib/server/retention.js';

const apply = process.argv.includes('--apply');

const { db, client } = await connectToDatabase();
const leads = db.collection('leads');
const filter = expiredLeadsFilter();
const count = await leads.countDocuments(filter);

console.log(`Leads sans échange depuis le ${retentionCutoff().slice(0, 10)} : ${count}`);
if (apply && count > 0) {
  const result = await leads.deleteMany(filter);
  console.log(`${result.deletedCount} lead(s) supprimé(s).`);
} else if (count > 0) {
  console.log('Aucune suppression (ajouter --apply pour supprimer).');
}
await client.close();
