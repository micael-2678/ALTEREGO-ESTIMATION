import { getCollection } from '../../../lib/mongodb';
import { getAdaptiveComparables } from '../../../lib/dvf-enhanced';
import { calculateAdjustments, calculateAdjustedPrice } from '../../../lib/dvf-adjustments';
import { ingestDVFDepartment } from '../../../lib/dvf-ingestion';
import { startDVFIngestion, clearDVFData } from '../../../lib/dvf-admin';
import {
  generateOTP,
  normalizePhoneNumber,
  isValidFrenchPhone,
  shouldBypassVerification,
  sendOTPSMS,
  calculateExpirationTime,
  isOTPExpired
} from '../../../lib/otp-service';
import { createOrUpdateBrevoContact } from '../../../lib/brevo-contact-service';
import { initOTPIndexes } from '../../../lib/init-otp-indexes';
import {
  json,
  serverError,
  corsHeadersFor,
  requireAdmin,
  getAdminUser,
  adminCookie,
  signAdminToken,
  getJwtSecret,
  safeEqual,
  rateLimit,
  clientIp
} from '../../../lib/api-helpers';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

// Durée pendant laquelle une vérification SMS permet de créer un lead
const PHONE_VERIFICATION_VALIDITY_MS = 30 * 60 * 1000;
const PROPERTY_TYPES = ['appartement', 'maison'];
const ESTIMATION_REASONS = ['Acheter', 'Vendre'];
const LEAD_STATUSES = ['pending_estimation', 'estimation_complete', 'contacted', 'qualified', 'closed_won', 'closed_lost'];

const DVF_SEARCH = {
  initialRadiusMeters: 500,
  maxRadiusMeters: 800,
  months: 24,
  maxMonths: 36,
  minComparables: 8
};

export async function OPTIONS(request) {
  return new NextResponse(null, { status: 204, headers: corsHeadersFor(request) });
}

// Index MongoDB (dont le TTL qui purge les codes OTP expirés), créés une fois par instance
let indexesReady = null;
function ensureIndexes() {
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

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function toNumber(value) {
  const n = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

// Valide les paramètres communs d'une recherche de comparables
function parseEstimateParams({ lat, lng, type, surface }) {
  const parsed = {
    lat: toNumber(lat),
    lng: toNumber(lng),
    type,
    surface: toNumber(surface)
  };
  if (parsed.lat === null || parsed.lng === null || Math.abs(parsed.lat) > 90 || Math.abs(parsed.lng) > 180) {
    return { error: 'Invalid coordinates' };
  }
  if (!PROPERTY_TYPES.includes(parsed.type)) {
    return { error: 'Invalid property type' };
  }
  if (parsed.surface === null || parsed.surface < 5 || parsed.surface > 5000) {
    return { error: 'Invalid surface' };
  }
  return { params: parsed };
}

async function isPhoneRecentlyVerified(phone) {
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
function sanitizeProperty(property = {}) {
  const allowed = [
    'address', 'lat', 'lng', 'type', 'surface', 'totalSurface', 'rooms', 'bathrooms',
    'floors', 'floor', 'hasElevator', 'hasBasement', 'basementSurface', 'hasBalconyTerrace',
    'balconyTerraceSurface', 'hasOutdoorParking', 'outdoorParkingCount', 'hasIndoorParking',
    'indoorParkingCount', 'hasPool', 'view', 'yearBuilt', 'dpe', 'standing'
  ];
  return Object.fromEntries(
    allowed.filter(key => property[key] !== undefined).map(key => [key, property[key]])
  );
}

function syncBrevo(lead) {
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

// Estimation complète : comparables DVF + ajustements
async function computeEstimation({ lat, lng, type, surface, characteristics = {} }) {
  const dvfResult = await getAdaptiveComparables({ lat, lng, type, surface, ...DVF_SEARCH });

  let adjustmentData = null;
  let finalPrice = null;

  if (dvfResult.stats) {
    const adjustmentResult = calculateAdjustments({ ...characteristics, type, surface }, dvfResult);
    const priceData = calculateAdjustedPrice(
      dvfResult.stats.weightedAverage,
      surface,
      adjustmentResult,
      dvfResult
    );

    adjustmentData = { ...adjustmentResult, ...priceData };
    // Un seul indicateur de fiabilité pour tout l'écran : l'avertissement suit la confiance finale
    dvfResult.warning = priceData.confidence < 50
      ? 'Peu de ventes comparables dans ce secteur : estimation indicative. Un rendez-vous avec un conseiller est recommandé pour l\'affiner.'
      : priceData.confidence < 65
        ? 'Données limitées dans ce secteur : estimation à considérer avec précaution.'
        : null;

    finalPrice = {
      mid: priceData.priceMid,
      low: priceData.priceLow,
      high: priceData.priceHigh,
      confidence: priceData.confidence
    };
  }

  return {
    dvf: dvfResult,
    adjustments: adjustmentData,
    finalPrice,
    disclaimer: 'Estimations basées sur DVF (open data) et ajustements selon caractéristiques — valeurs indicatives, non contractuelles.'
  };
}

// Création puis envoi d'un code OTP (partagé par send-otp et resend-otp)
async function issueOTP(request, phone) {
  const normalizedPhone = normalizePhoneNumber(phone);

  if (shouldBypassVerification(phone)) {
    return json(request, { success: true, bypass: true, message: 'Verification bypassed for this number' });
  }

  if (!isValidFrenchPhone(normalizedPhone)) {
    return json(request, { error: 'Numéro de téléphone invalide. Format attendu : 06 12 34 56 78' }, 400);
  }

  // Anti-abus : limite les envois de SMS (coût) par IP et par numéro
  const ip = clientIp(request);
  if (!rateLimit(`otp-ip:${ip}`, { limit: 10, windowMs: 60 * 60 * 1000 }) ||
      !rateLimit(`otp-phone:${normalizedPhone}`, { limit: 5, windowMs: 60 * 60 * 1000 })) {
    return json(request, { error: 'Trop de demandes. Réessayez plus tard.' }, 429);
  }

  await ensureIndexes();
  const collection = await getCollection('otp_verifications');

  const recentOTP = await collection.findOne({
    phone: normalizedPhone,
    verified: false,
    createdAt: { $gt: new Date(Date.now() - 30 * 1000) }
  });
  if (recentOTP) {
    return json(request, { error: 'Veuillez patienter 30 secondes avant de demander un nouveau code.' }, 429);
  }

  await collection.deleteMany({ phone: normalizedPhone, verified: false });

  const code = generateOTP(6);
  await collection.insertOne({
    phone: normalizedPhone,
    code,
    createdAt: new Date(),
    expiresAt: calculateExpirationTime(5),
    verified: false,
    attempts: 0
  });

  const smsResult = await sendOTPSMS(normalizedPhone, code);
  if (!smsResult.success) {
    await collection.deleteOne({ phone: normalizedPhone, code });
    return json(request, { error: "L'envoi du code a échoué. Veuillez réessayer." }, 500);
  }

  return json(request, { success: true, message: 'Verification code sent', expiresInSeconds: 5 * 60 });
}

export async function GET(request) {
  const { pathname, searchParams } = new URL(request.url);

  try {
    if (pathname === '/api/' || pathname === '/api') {
      return json(request, { message: 'AlterEgo API is running', version: '2.1.0' });
    }

    // Géocodage via la Base Adresse Nationale
    if (pathname === '/api/geo/resolve') {
      const address = (searchParams.get('address') || '').trim();
      if (address.length < 3) {
        return json(request, { error: 'Address is required' }, 400);
      }

      const response = await fetch(
        `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(address.slice(0, 200))}&limit=5&autocomplete=1`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (!response.ok) {
        return json(request, { suggestions: [] });
      }
      const data = await response.json();

      const suggestions = (data.features || []).map(f => ({
        address: f.properties.label,
        lat: f.geometry.coordinates[1],
        lng: f.geometry.coordinates[0],
        city: f.properties.city,
        postalCode: f.properties.postcode
      }));
      return json(request, { suggestions });
    }

    // Comparables DVF seuls
    if (pathname === '/api/dvf/comparables') {
      const { params, error } = parseEstimateParams({
        lat: searchParams.get('lat'),
        lng: searchParams.get('lng'),
        type: searchParams.get('type'),
        surface: searchParams.get('surface')
      });
      if (error) return json(request, { error }, 400);

      const radiusMeters = Math.min(parseInt(searchParams.get('radiusMeters')) || 500, DVF_SEARCH.maxRadiusMeters);
      const months = Math.min(parseInt(searchParams.get('months')) || 24, DVF_SEARCH.maxMonths);

      const result = await getAdaptiveComparables({
        ...params,
        ...DVF_SEARCH,
        initialRadiusMeters: radiusMeters,
        months
      });
      return json(request, result);
    }

    // Session admin courante
    if (pathname === '/api/auth/session') {
      const user = getAdminUser(request);
      return user ? json(request, { authenticated: true, user }) : json(request, { authenticated: false }, 401);
    }

    // Liste des leads (admin)
    if (pathname === '/api/leads') {
      const denied = requireAdmin(request);
      if (denied) return denied;

      const collection = await getCollection('leads');
      // Les 20 ventes comparables de chaque estimation ne servent pas à l'admin : exclues
      const leads = await collection
        .find({}, { projection: { _id: 0, 'estimation.dvf.comparables': 0 } })
        .sort({ createdAt: -1 })
        .limit(2000)
        .toArray();
      return json(request, { leads });
    }

    // Statistiques DVF par département (admin)
    if (pathname === '/api/admin/dvf/status') {
      const denied = requireAdmin(request);
      if (denied) return denied;

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
    }

    return json(request, { error: 'Not found' }, 404);
  } catch (error) {
    return serverError(request, error);
  }
}

export async function POST(request) {
  const { pathname } = new URL(request.url);

  try {
    // Connexion admin
    if (pathname === '/api/auth/login') {
      const { username, password } = await readJson(request);
      const expectedUser = process.env.ADMIN_USERNAME;
      const expectedPassword = process.env.ADMIN_PASSWORD;

      if (!expectedUser || !expectedPassword || !getJwtSecret()) {
        return json(request, { error: 'Admin login is not configured' }, 503);
      }
      // Mots de passe publiés dans l'historique du dépôt : considérés comme compromis
      if (['Micael123', 'MotDePasseSecurise123!', 'VotreMotDePasse123', 'VotreMotDePasse123!', 'VotreMotDePasseSecurise123!'].includes(expectedPassword)) {
        return json(request, { error: 'ADMIN_PASSWORD compromis : définissez un nouveau mot de passe administrateur' }, 503);
      }

      if (!rateLimit(`login:${clientIp(request)}`, { limit: 10, windowMs: 15 * 60 * 1000 })) {
        return json(request, { error: 'Too many attempts, try again later' }, 429);
      }

      if (safeEqual(username, expectedUser) && safeEqual(password, expectedPassword)) {
        const token = signAdminToken(username);
        const response = json(request, { user: { username } });
        response.headers.append('Set-Cookie', adminCookie(token));
        return response;
      }

      return json(request, { error: 'Invalid credentials' }, 401);
    }

    // Déconnexion admin
    if (pathname === '/api/auth/logout') {
      const response = json(request, { success: true });
      response.headers.append('Set-Cookie', adminCookie(null));
      return response;
    }

    // Envoi / renvoi du code OTP
    if (pathname === '/api/verification/send-otp' || pathname === '/api/verification/resend-otp') {
      const { phone } = await readJson(request);
      if (!phone || typeof phone !== 'string') {
        return json(request, { error: 'Le numéro de téléphone est requis.' }, 400);
      }
      return issueOTP(request, phone);
    }

    // Vérification du code OTP
    if (pathname === '/api/verification/verify-otp') {
      const { phone, code } = await readJson(request);
      if (!phone || !code) {
        return json(request, { error: 'Phone and code are required' }, 400);
      }

      if (shouldBypassVerification(phone)) {
        return json(request, { success: true, verified: true, bypass: true });
      }

      const normalizedPhone = normalizePhoneNumber(phone);
      const collection = await getCollection('otp_verifications');
      const otpRecord = await collection.findOne({ phone: normalizedPhone, verified: false });

      if (!otpRecord) {
        return json(request, { error: 'Aucune vérification en cours pour ce numéro.' }, 404);
      }

      if (isOTPExpired(otpRecord.expiresAt)) {
        await collection.deleteOne({ _id: otpRecord._id });
        return json(request, { error: 'Le code a expiré. Demandez-en un nouveau.' }, 400);
      }

      const maxAttempts = parseInt(process.env.MAX_OTP_ATTEMPTS) || 5;
      if (otpRecord.attempts >= maxAttempts) {
        await collection.deleteOne({ _id: otpRecord._id });
        return json(request, { error: 'Trop de tentatives. Demandez un nouveau code.' }, 429);
      }

      if (!safeEqual(String(code), otpRecord.code)) {
        await collection.updateOne({ _id: otpRecord._id }, { $inc: { attempts: 1 } });
        return json(request, {
          error: 'Code incorrect.',
          attemptsRemaining: maxAttempts - otpRecord.attempts - 1
        }, 400);
      }

      await collection.updateOne(
        { _id: otpRecord._id },
        // Le document vérifié doit survivre à l'index TTL le temps de créer le lead
        { $set: { verified: true, verifiedAt: new Date(), expiresAt: new Date(Date.now() + PHONE_VERIFICATION_VALIDITY_MS) } }
      );
      return json(request, { success: true, verified: true });
    }

    // Création d'un lead (après vérification du téléphone côté serveur)
    if (pathname === '/api/leads') {
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
    }

    // Estimation complète. Si leadId est fourni, l'estimation est rattachée au lead
    // existant (un seul lead par estimation, plus de doublon).
    if (pathname === '/api/estimate') {
      const body = await readJson(request);
      const { params, error } = parseEstimateParams(body);
      if (error) return json(request, { error }, 400);

      if (!rateLimit(`estimate:${clientIp(request)}`, { limit: 30, windowMs: 60 * 60 * 1000 })) {
        return json(request, { error: 'Trop de demandes. Réessayez plus tard.' }, 429);
      }

      const result = await computeEstimation({
        ...params,
        characteristics: body.characteristics && typeof body.characteristics === 'object' ? body.characteristics : {}
      });

      if (typeof body.leadId === 'string' && body.leadId) {
        const collection = await getCollection('leads');
        const lead = await collection.findOneAndUpdate(
          { id: body.leadId, status: 'pending_estimation' },
          {
            $set: {
              estimation: result,
              status: 'estimation_complete',
              lastModified: new Date().toISOString()
            }
          },
          { returnDocument: 'after' }
        );
        // Compatibilité driver MongoDB v5 ({ value }) et v6 (document)
        const updatedLead = lead && lead.value !== undefined ? lead.value : lead;
        if (updatedLead) {
          await syncBrevo(updatedLead);
        }
      }

      return json(request, result);
    }

    // Lancer une ingestion DVF par départements (admin)
    if (pathname === '/api/admin/dvf/ingest') {
      const denied = requireAdmin(request);
      if (denied) return denied;

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
    }

    // Mise à jour d'un lead (admin)
    if (pathname === '/api/admin/leads/update') {
      const denied = requireAdmin(request);
      if (denied) return denied;

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
    }

    // Ajout d'un commentaire sur un lead (admin)
    if (pathname === '/api/admin/leads/comment') {
      const denied = requireAdmin(request);
      if (denied) return denied;

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
    }

    // DVF admin : ingestion complète
    if (pathname === '/api/admin/dvf/start') {
      const denied = requireAdmin(request);
      if (denied) return denied;

      try {
        const result = await startDVFIngestion();
        return json(request, result);
      } catch (error) {
        return json(request, { error: error.message }, 400);
      }
    }

    // DVF admin : purge des données
    if (pathname === '/api/admin/dvf/clear') {
      const denied = requireAdmin(request);
      if (denied) return denied;

      const result = await clearDVFData();
      return json(request, result);
    }

    return json(request, { error: 'Not found' }, 404);
  } catch (error) {
    return serverError(request, error);
  }
}

export async function DELETE(request) {
  const { pathname, searchParams } = new URL(request.url);

  try {
    // Suppression d'un lead (admin)
    if (pathname === '/api/admin/leads/delete') {
      const denied = requireAdmin(request);
      if (denied) return denied;

      const leadId = searchParams.get('leadId');
      if (!leadId) {
        return json(request, { error: 'Lead ID is required' }, 400);
      }

      const collection = await getCollection('leads');
      const result = await collection.deleteOne({ id: leadId });
      if (result.deletedCount === 0) {
        return json(request, { error: 'Lead not found' }, 404);
      }
      return json(request, { success: true, deleted: true });
    }

    return json(request, { error: 'Not found' }, 404);
  } catch (error) {
    return serverError(request, error);
  }
}
