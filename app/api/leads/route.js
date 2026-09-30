import { v4 as uuidv4 } from 'uuid';
import { json, preflight, handler, adminHandler, readJson } from '@/lib/api-helpers';
import { getCollection } from '@/lib/mongodb';
import {
  ESTIMATION_REASONS,
  ensureIndexes,
  isPhoneRecentlyVerified,
  sanitizeProperty,
  syncBrevo
} from '@/lib/server/leads';

export const OPTIONS = preflight;

// Liste des leads (admin)
export const GET = adminHandler(async (request) => {
  const collection = await getCollection('leads');
  // Les 20 ventes comparables de chaque estimation ne servent pas à l'admin : exclues
  const leads = await collection
    .find({}, { projection: { _id: 0, 'estimation.dvf.comparables': 0 } })
    .sort({ createdAt: -1 })
    .limit(2000)
    .toArray();
  return json(request, { leads });
});

// Création d'un lead (après vérification du téléphone côté serveur)
export const POST = handler(async (request) => {
  const body = await readJson(request);
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 200) : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim().slice(0, 30) : '';

  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !phone) {
    return json(request, { error: 'Nom, email et téléphone valides sont requis.' }, 400);
  }
  if (!ESTIMATION_REASONS.includes(body.estimationReason)) {
    return json(request, { error: "Raison de l'estimation invalide." }, 400);
  }
  if (body.consent !== true) {
    return json(request, { error: 'Le consentement est requis.' }, 400);
  }
  if (!(await isPhoneRecentlyVerified(phone))) {
    return json(request, { error: 'Numéro de téléphone non vérifié.' }, 403);
  }

  const lead = {
    id: uuidv4(),
    name,
    email,
    phone,
    estimationReason: body.estimationReason,
    consent: true,
    consentAt: new Date().toISOString(),
    phoneVerified: true,
    property: sanitizeProperty(body.property),
    status: 'pending_estimation',
    source: typeof body.source === 'string' ? body.source.slice(0, 100) : 'estimation',
    createdAt: new Date().toISOString()
  };

  await ensureIndexes();
  const collection = await getCollection('leads');
  await collection.insertOne(lead);

  // Le contact est créé dans Brevo dès maintenant, puis enrichi avec l'estimation
  await syncBrevo(lead);

  return json(request, { success: true, leadId: lead.id });
});
