/**
 * Tests d'intégration de l'API contre un serveur réel et une vraie base MongoDB.
 * Lancement : yarn test:api (voir tests/api/run.sh), ou en CI avec un service MongoDB.
 * Variables : BASE_URL (défaut http://127.0.0.1:3200), MONGO_URL, DB_NAME,
 * ADMIN_USERNAME / ADMIN_PASSWORD identiques à ceux du serveur.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { MongoClient } from 'mongodb';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3200';
const ADMIN = { username: process.env.ADMIN_USERNAME || 'admin', password: process.env.ADMIN_PASSWORD || 'Test-Admin-2026!' };
const PHONE = '0612345678';
const LAT = 48.8718;
const LNG = 2.3372;

let client;
let db;
let adminCookie = '';

async function api(method, path, { body, headers = {}, cookie } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
      ...headers
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual'
  });
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, headers: res.headers };
}

// Ventes synthétiques autour de Paris 9e (générateur déterministe)
function syntheticSales(count = 1500) {
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => {
    const type = rnd() < 0.85 ? 'appartement' : 'maison';
    const ageYears = rnd() * 4;
    const surface = Math.round(20 + rnd() * 100);
    const prix_m2 = Math.round((type === 'appartement' ? 10500 : 8000) * Math.pow(0.97, ageYears) * (0.85 + rnd() * 0.3));
    return {
      date_mutation: new Date(now - ageYears * 365.25 * 864e5).toISOString().split('T')[0],
      voie: 'RUE DE PROVENCE', code_postal: '75009', commune: 'Paris 9e Arrondissement', code_departement: '75', code_commune: '75109',
      type_local: type, surface_reelle_bati: surface, valeur_fonciere: prix_m2 * surface, prix_m2,
      latitude: LAT + (rnd() - 0.5) * 0.02, longitude: LNG + (rnd() - 0.5) * 0.03,
      nature_mutation: 'Vente', id_mutation: `T-${i}`, imported_at: new Date().toISOString()
    };
  });
}

// Références de loyers synthétiques : Carte des loyers (Paris 9e, Boulogne) et un quartier parisien
// de l'encadrement couvrant le point de test
const PERIODS = ['avant_1946', '1946_1970', '1971_1990', 'apres_1990'];
function rentIndicators() {
  const docs = [];
  for (const [insee, name, base] of [['75109', 'Paris 9e Arrondissement', 36], ['92012', 'Boulogne-Billancourt', 28]]) {
    for (const [category, delta] of [['appartement_1_2', 4], ['appartement_3_plus', -2], ['appartement', 0], ['maison', -6]]) {
      docs.push({ insee, name, department: insee.slice(0, 2), category, year: 2025, referenceDate: '2025-09-01', rentPerM2: base + delta,
        low: base + delta - 2, high: base + delta + 2, predictionLevel: 'commune', observations: { commune: 150, maille: 900 } });
    }
  }
  return docs;
}
function parisZone() {
  const refs = [];
  for (const rooms of [1, 2, 3, 4]) {
    PERIODS.forEach((period, i) => {
      for (const furnished of [false, true]) {
        const ref = 34 - rooms * 1.5 + i * 0.5 + (furnished ? 3 : 0);
        refs.push({ rooms, period, furnished, ref, max: Math.round(ref * 120) / 100, min: Math.round(ref * 70) / 100 });
      }
    });
  }
  return {
    city: 'paris', year: 2026, quartierId: 33, quartierName: 'Chaussée-d\'Antin', zoneId: 3, refs,
    geometry: { type: 'Polygon', coordinates: [[[LNG - 0.02, LAT - 0.015], [LNG + 0.02, LAT - 0.015], [LNG + 0.02, LAT + 0.015], [LNG - 0.02, LAT + 0.015], [LNG - 0.02, LAT - 0.015]]] }
  };
}

async function insertOtp(code) {
  await db.collection('otp_verifications').deleteMany({});
  await db.collection('otp_verifications').insertOne({
    phone: '+33612345678', code, createdAt: new Date(Date.now() - 60000),
    expiresAt: new Date(Date.now() + 300000), verified: false, attempts: 0
  });
}

before(async () => {
  client = await MongoClient.connect(process.env.MONGO_URL || 'mongodb://127.0.0.1:27017');
  db = client.db(process.env.DB_NAME || 'alterego_test');
  for (const name of ['dvf_sales', 'leads', 'otp_verifications', 'rent_indicators', 'rent_control_zones']) {
    await db.collection(name).deleteMany({});
  }
  await db.collection('dvf_sales').insertMany(syntheticSales());
  await db.collection('dvf_sales').createIndex({ type_local: 1, latitude: 1, longitude: 1, date_mutation: -1 });
  await db.collection('rent_indicators').insertMany(rentIndicators());
  await db.collection('rent_control_zones').insertOne(parisZone());
  await db.collection('rent_control_zones').createIndex({ geometry: '2dsphere' });
});

after(async () => {
  await client?.close();
});

test('racine et route inconnue', async () => {
  const root = await api('GET', '/api');
  assert.equal(root.status, 200);
  assert.match(root.data.message, /AlterEgo API/);

  const unknown = await api('GET', '/api/nope');
  assert.equal(unknown.status, 404);
  assert.equal(unknown.data.error, 'Not found');
  assert.equal((await api('POST', '/api/admin/nope')).status, 404);
});

test('CORS : seules les origines du site sont autorisées', async () => {
  const allowed = await api('OPTIONS', '/api/estimate', { headers: { origin: 'https://alteregopatrimoine.com' } });
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://alteregopatrimoine.com');
  const other = await api('OPTIONS', '/api/estimate', { headers: { origin: 'https://evil.example' } });
  assert.equal(other.headers.get('access-control-allow-origin'), null);
});

test('validation des paramètres', async () => {
  assert.equal((await api('GET', '/api/geo/resolve')).status, 400);
  assert.equal((await api('POST', '/api/estimate', { body: { lat: LAT, lng: LNG, type: 'villa', surface: 50 } })).status, 400);
  assert.equal((await api('POST', '/api/estimate', { body: { lat: 'x', lng: LNG, type: 'maison', surface: 50 } })).status, 400);
  assert.equal((await api('POST', '/api/verification/send-otp', { body: { phone: '123' } })).status, 400);
  assert.equal((await api('POST', '/api/verification/resend-otp', { body: { phone: '123' } })).status, 400);
  assert.equal((await api('POST', '/api/verification/verify-otp', { body: {} })).status, 400);
  assert.equal((await api('POST', '/api/leads', { body: { name: 'A', email: 'bad', phone: PHONE } })).status, 400);
});

test('estimation et comparables', async () => {
  const estimate = await api('POST', '/api/estimate', {
    body: { lat: LAT, lng: LNG, type: 'appartement', surface: 60, characteristics: { floor: '1-3', hasElevator: true, dpe: 'D' } }
  });
  assert.equal(estimate.status, 200);
  const { finalPrice, dvf, adjustments } = estimate.data;
  assert.ok(finalPrice.low < finalPrice.mid && finalPrice.mid < finalPrice.high);
  assert.ok(dvf.count >= 8);
  assert.ok(dvf.trend && typeof dvf.trend.annualRatePercent === 'number');
  assert.ok(adjustments.adjustments.some(a => a.factor === 'DPE'));
  assert.ok(!/XX/.test(dvf.comparables[0].address));

  const comps = await api('GET', `/api/dvf/comparables?lat=${LAT}&lng=${LNG}&type=appartement&surface=60`);
  assert.equal(comps.status, 200);
  assert.ok(comps.data.count > 0);
});

test('estimation de loyer : Paris plafonné, commune via la Carte des loyers, validation', async () => {
  // Paris : observatoire du quartier + annonces de l'arrondissement, plafond du loyer majoré, dernier loyer connu
  const paris = await api('POST', '/api/estimate', {
    body: {
      lat: LAT, lng: LNG, type: 'appartement', surface: 60, purpose: 'rent',
      characteristics: { floor: '1-3', hasElevator: true, dpe: 'D', condition: 'renovated' },
      rent: { rooms: 3, furnished: false, constructionPeriod: '1946_1970', insee: '75109', rentedRecently: true, previousRent: 2500, parking: { indoor: 1 } }
    }
  });
  assert.equal(paris.status, 200);
  const { rent, finalPrice } = paris.data;
  assert.equal(rent.available, true);
  assert.equal(rent.source.kind, 'paris_blend');
  assert.equal(rent.legal.parisControl.quartier, 'Chaussée-d\'Antin');
  assert.equal(rent.legal.parisControl.rooms, 3);
  assert.ok(rent.monthly.exclCharges <= rent.legal.parisControl.maxMonthly);
  assert.ok(rent.monthly.exclCharges <= 2500);
  assert.ok(rent.monthly.exclCharges > 1000, `${rent.monthly.exclCharges}`);
  assert.deepEqual(rent.legal.caps.map(c => c.code).sort(), ['paris_max', 'previous_rent']);
  assert.equal(rent.monthly.parking, 100);
  assert.ok(rent.yield.gross > 0 && finalPrice.mid > 0);
  assert.ok(rent.market.references.some(r => r.code === 'paris_observatory') && rent.market.references.some(r => r.code === 'carte_loyers'));
  assert.match(paris.data.disclaimer, /Carte des loyers/);

  // Hors Paris, sans vente DVF : loyer d'annonce de la commune, meublé, DPE G interdit
  const suburb = await api('POST', '/api/estimate', {
    body: {
      lat: 48.84, lng: 2.24, type: 'appartement', surface: 30, purpose: 'rent', characteristics: { dpe: 'G' },
      rent: { rooms: 1, furnished: true, insee: '92012', rentedRecently: false }
    }
  });
  assert.equal(suburb.status, 200);
  assert.equal(suburb.data.finalPrice, null);
  assert.equal(suburb.data.rent.available, true);
  assert.equal(suburb.data.rent.source.kind, 'carte_loyers');
  assert.equal(suburb.data.rent.legal.rentable, false);
  assert.equal(suburb.data.rent.yield, null);
  assert.ok(suburb.data.rent.market.steps.some(s => s.code === 'furnished'));
  assert.ok(suburb.data.rent.monthly.exclCharges > 500 && suburb.data.rent.monthly.exclCharges < 1300, `${suburb.data.rent.monthly.exclCharges}`);

  // Commune sans référence : estimation de vente seule, loyer indisponible mais réponse propre
  const unknown = await api('POST', '/api/estimate', {
    body: { lat: 45.76, lng: 4.84, type: 'maison', surface: 120, purpose: 'rent', rent: { rooms: 5, insee: '69123' } }
  });
  assert.equal(unknown.status, 200);
  assert.equal(unknown.data.rent.available, false);

  // Paramètres de location invalides
  assert.equal((await api('POST', '/api/estimate', { body: { lat: LAT, lng: LNG, type: 'appartement', surface: 60, purpose: 'rent', rent: { rooms: 0 } } })).status, 400);
  assert.equal((await api('POST', '/api/estimate', { body: { lat: LAT, lng: LNG, type: 'appartement', surface: 60, purpose: 'rent' } })).status, 400);
});

test('lead « Louer » : champs de location conservés, estimation de loyer rattachée', async () => {
  const created = await api('POST', '/api/leads', {
    body: {
      name: 'Marie Bailleur', email: 'marie@example.fr', phone: '0698793430', estimationReason: 'Louer', consent: true,
      property: { address: '2 Rue des Italiens', type: 'appartement', surface: '60', rooms: '3', insee: '75109', furnished: true, rentedRecently: false, previousRent: '', bogus: 1 }
    }
  });
  assert.equal(created.status, 200);
  const estimate = await api('POST', '/api/estimate', {
    body: { leadId: created.data.leadId, lat: LAT, lng: LNG, type: 'appartement', surface: 60, purpose: 'rent', rent: { rooms: 3, furnished: true, insee: '75109' } }
  });
  assert.equal(estimate.status, 200);
  const lead = await db.collection('leads').findOne({ id: created.data.leadId });
  assert.equal(lead.property.furnished, true);
  assert.equal(lead.property.insee, '75109');
  assert.equal(lead.property.bogus, undefined);
  assert.equal(lead.estimation.rent.available, true);
  assert.equal(lead.estimation.rent.furnished, true);
  assert.equal(lead.estimation.rent.legal.parisControl.furnished, true);
  await db.collection('leads').deleteOne({ id: created.data.leadId });
  assert.equal((await api('POST', '/api/leads', { body: { name: 'X', email: 'x@example.fr', phone: '0698793430', estimationReason: 'Squatter', consent: true } })).status, 400);
});

test('lead : vérification SMS obligatoire, un seul lead, champs injectés ignorés', async () => {
  const lead = { name: 'Jean Test', email: 'Jean@Test.fr', phone: PHONE, estimationReason: 'Vendre', consent: true };
  assert.equal((await api('POST', '/api/leads', { body: lead })).status, 403);

  await insertOtp('424242');
  const wrong = await api('POST', '/api/verification/verify-otp', { body: { phone: '06 12 34 56 78', code: '000000' } });
  assert.equal(wrong.status, 400);
  assert.equal(wrong.data.attemptsRemaining, 4);
  const right = await api('POST', '/api/verification/verify-otp', { body: { phone: '06 12 34 56 78', code: '424242' } });
  assert.equal(right.status, 200);

  const created = await api('POST', '/api/leads', {
    body: { ...lead, status: 'closed_won', property: { address: '2 Rue des Italiens', type: 'appartement', surface: '60', evil: 'x' } }
  });
  assert.equal(created.status, 200);
  const { leadId } = created.data;

  const estimate = await api('POST', '/api/estimate', { body: { leadId, lat: LAT, lng: LNG, type: 'appartement', surface: 60 } });
  assert.equal(estimate.status, 200);
  // Une seconde estimation n'écrase pas celle du lead
  await api('POST', '/api/estimate', { body: { leadId, lat: LAT, lng: LNG, type: 'maison', surface: 200 } });

  const leads = await db.collection('leads').find().toArray();
  assert.equal(leads.length, 1);
  assert.equal(leads[0].status, 'estimation_complete');
  assert.equal(leads[0].email, 'jean@test.fr');
  assert.equal(leads[0].property.evil, undefined);
  // Preuve du consentement enregistrée ; prospection refusée par défaut
  assert.equal(leads[0].marketingConsent, false);
  assert.match(leads[0].consentRecord.service, /estimation/);
  assert.equal(leads[0].consentRecord.marketing, null);
  assert.ok(leads[0].consentRecord.version);
  assert.equal(leads[0].estimation.dvf.comparables.length > 0, true);
  assert.notEqual(leads[0].property.type, 'maison');
});

test('numéro dispensé : ni SMS ni code, lead et estimation directs', async () => {
  const sent = await api('POST', '/api/verification/send-otp', { body: { phone: '06 98 79 34 30' } });
  assert.equal(sent.status, 200);
  assert.equal(sent.data.bypass, true);

  const lead = await api('POST', '/api/leads', {
    body: { name: 'Micael Test', email: 'contact@example.fr', phone: '0698793430', estimationReason: 'Acheter', consent: true }
  });
  assert.equal(lead.status, 200);
  await db.collection('leads').deleteOne({ id: lead.data.leadId });
});

test('numéro non dispensé : sans clé Brevo, échec explicite côté admin', async () => {
  const sent = await api('POST', '/api/verification/send-otp', { body: { phone: '0622334455' } });
  assert.equal(sent.status, 500);
});

test('admin : accès refusé sans session', async () => {
  assert.equal((await api('GET', '/api/admin/health')).status, 401);
  assert.equal((await api('GET', '/api/leads')).status, 401);
  assert.equal((await api('GET', '/api/auth/session')).status, 401);
  assert.equal((await api('POST', '/api/admin/leads/update', { body: { leadId: 'x', status: 'contacted' } })).status, 401);
  assert.equal((await api('DELETE', '/api/admin/leads/delete?leadId=x')).status, 401);
  assert.equal((await api('GET', '/api/admin/dvf/status')).status, 401);
  assert.equal((await api('GET', '/api/admin/dvf?action=stats')).status, 401);
  assert.equal((await api('GET', '/api/admin/rent')).status, 401);
  assert.equal((await api('POST', '/api/admin/rent')).status, 401);
  assert.equal((await api('GET', '/api/leads', { headers: { authorization: 'Bearer forged' } })).status, 401);
});

test('admin : connexion par cookie httpOnly et gestion des leads', async () => {
  assert.equal((await api('POST', '/api/auth/login', { body: { username: ADMIN.username, password: 'wrong' } })).status, 401);

  const login = await api('POST', '/api/auth/login', { body: ADMIN });
  assert.equal(login.status, 200);
  const setCookie = login.headers.get('set-cookie');
  assert.match(setCookie, /ae_admin=.+; Path=\/; HttpOnly; SameSite=Strict/);
  assert.equal(login.data.token, undefined);
  adminCookie = setCookie.split(';')[0];

  const session = await api('GET', '/api/auth/session', { cookie: adminCookie });
  assert.equal(session.status, 200);
  assert.equal(session.data.user.username, ADMIN.username);

  const list = await api('GET', '/api/leads', { cookie: adminCookie });
  assert.equal(list.status, 200);
  const [lead] = list.data.leads;
  assert.equal(lead.estimation.dvf.comparables, undefined);

  assert.equal((await api('POST', '/api/admin/leads/update', { cookie: adminCookie, body: { leadId: lead.id, status: 'hacked' } })).status, 400);
  assert.equal((await api('POST', '/api/admin/leads/update', { cookie: adminCookie, body: { leadId: lead.id, status: 'contacted' } })).status, 200);
  assert.equal((await api('POST', '/api/admin/leads/comment', { cookie: adminCookie, body: { leadId: lead.id, comment: 'Rappeler lundi' } })).status, 200);
  const stored = await db.collection('leads').findOne({ id: lead.id });
  assert.equal(stored.status, 'contacted');
  assert.equal(stored.comments[0].comment, 'Rappeler lundi');

  const stats = await api('GET', '/api/admin/dvf?action=stats', { cookie: adminCookie });
  assert.equal(stats.status, 200);
  assert.equal(stats.data.total, 1500);
  const status = await api('GET', '/api/admin/dvf/status', { cookie: adminCookie });
  assert.equal(status.status, 200);
  assert.equal(status.data.total, 1500);

  const rentImport = await api('GET', '/api/admin/rent', { cookie: adminCookie });
  assert.equal(rentImport.status, 200);
  assert.equal(rentImport.data.isRunning, false);

  const health = await api('GET', '/api/admin/health', { cookie: adminCookie });
  assert.equal(health.status, 200);
  assert.equal(health.data.database.ok, true);
  assert.equal(health.data.sms.ok, false);
  assert.match(health.data.sms.message, /BREVO_API_KEY absente/);
  assert.match(health.data.sms.lastFailure.reason, /BREVO_API_KEY absente/);
  assert.equal(health.data.bypass.count, 1);
  assert.equal(health.data.rent.ok, true);
  assert.equal(health.data.rent.parisQuartiers, 1);
  assert.match(health.data.rent.message, /Carte des loyers 2025.*Paris : 1 quartiers \(arrêté 2026\)/);

  assert.equal((await api('DELETE', `/api/admin/leads/delete?leadId=${lead.id}`, { cookie: adminCookie })).status, 200);
  assert.equal(await db.collection('leads').countDocuments(), 0);

  const logout = await api('POST', '/api/auth/logout', { cookie: adminCookie });
  assert.match(logout.headers.get('set-cookie'), /ae_admin=; .*Max-Age=0/);
});
