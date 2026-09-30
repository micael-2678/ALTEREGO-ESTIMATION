import { LEGAL } from '../legal.js';

// Date avant laquelle un lead sans échange récent doit être supprimé (durée RGPD)
export function retentionCutoff(now = new Date(), months = LEGAL.leadRetentionMonths) {
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - months);
  return cutoff.toISOString();
}

// Leads dont le dernier échange (dernière modification, sinon création) est trop ancien
export function expiredLeadsFilter(now = new Date(), months = LEGAL.leadRetentionMonths) {
  const cutoff = retentionCutoff(now, months);
  return {
    $or: [
      { lastModified: { $lt: cutoff } },
      { lastModified: { $exists: false }, createdAt: { $lt: cutoff } }
    ]
  };
}
