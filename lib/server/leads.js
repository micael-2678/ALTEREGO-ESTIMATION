import { getCollection } from '../mongodb.js';
import { normalizePhoneNumber, shouldBypassVerification } from '../otp-service.js';
import { createOrUpdateBrevoContact } from '../brevo-contact-service.js';
import { initOTPIndexes } from '../init-otp-indexes.js';

// Durée pendant laquelle une vérification SMS permet de créer un lead
export const PHONE_VERIFICATION_VALIDITY_MS = 30 * 60 * 1000;
export const ESTIMATION_REASONS = ['Acheter', 'Vendre'];
export const LEAD_STATUSES = ['pending_estimation', 'estimation_complete', 'contacted', 'qualified', 'closed_won', 'closed_lost'];

// Index MongoDB (dont le TTL qui purge les codes OTP expirés), créés une fois par instance
let indexesReady = null;
export function ensureIndexes() {
  if (!indexesReady) {
    indexesReady = (async () => {
      await initOTPIndexes();
      const leads = await getCollection('leads');
      await leads.createIndex({ id: 1 }, { unique: true, name: 'lead_id_unique' });
      await leads.createIndex({ createdAt: -1 }, { name: 'lead_created_at' });
    })().catch(error => {
      indexesReady = null;
      console.error('Index creation failed:', error);
    });
  }
  return indexesReady;
}

export async function isPhoneRecentlyVerified(phone) {
  if (shouldBypassVerification(phone)) return true;
  const collection = await getCollection('otp_verifications');
  const record = await collection.findOne({
    phone: normalizePhoneNumber(phone),
    verified: true,
    verifiedAt: { $gte: new Date(Date.now() - PHONE_VERIFICATION_VALIDITY_MS) }
  });
  return !!record;
}

// Ne conserve que les champs attendus du formulaire (pas d'injection de champs arbitraires)
export function sanitizeProperty(property = {}) {
  const allowed = [
    'address', 'lat', 'lng', 'type', 'surface', 'totalSurface', 'rooms', 'bathrooms',
    'floors', 'floor', 'hasElevator', 'hasBasement', 'basementSurface', 'hasBalconyTerrace',
    'balconyTerraceSurface', 'hasOutdoorParking', 'outdoorParkingCount', 'hasIndoorParking',
    'indoorParkingCount', 'hasPool', 'view', 'yearBuilt', 'dpe', 'standing'
  ];
  return Object.fromEntries(
    allowed.filter(key => property?.[key] !== undefined).map(key => [key, property[key]])
  );
}

export function syncBrevo(lead) {
  if (!lead.email || !lead.name || !lead.estimationReason) return Promise.resolve();
  return createOrUpdateBrevoContact({
    email: lead.email,
    name: lead.name,
    phone: lead.phone ? normalizePhoneNumber(lead.phone) : '',
    estimationReason: lead.estimationReason,
    property: lead.property,
    estimation: lead.estimation,
    consent: lead.consent
  })
    .then(result => {
      if (!result.success) console.error(`Brevo sync failed: ${result.error}`);
    })
    .catch(error => console.error('Brevo sync error:', error));
}

// Rattache une estimation à un lead encore en attente (un seul lead par estimation)
export async function attachEstimation(leadId, estimation) {
  const collection = await getCollection('leads');
  const result = await collection.findOneAndUpdate(
    { id: leadId, status: 'pending_estimation' },
    { $set: { estimation, status: 'estimation_complete', lastModified: new Date().toISOString() } },
    { returnDocument: 'after' }
  );
  // Compatibilité driver MongoDB v5 ({ value }) et v6 (document)
  const lead = result && result.value !== undefined ? result.value : result;
  if (lead) await syncBrevo(lead);
}
