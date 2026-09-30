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
      voie: 'RUE DE PROVENCE', code_postal: '75009', commune: 'Paris 9e Arrondissement', code_departement: '75',
      type_local: type, surface_reelle_bati: surface, valeur_fonciere: prix_m2 * surface, prix_m2,
      latitude: LAT + (rnd() - 0.5) * 0.02, longitude: LNG + (rnd() - 0.5) * 0.03,
      nature_mutation: 'Vente', id_mutation: `T-${i}`, imported_at: new Date().toISOString()
    };
  });
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
  for (const name of ['dvf_sales', 'leads', 'otp_verifications']) {
    await db.collection(name).deleteMany({});
  }
  await db.collection('dvf_sales').insertMany(syntheticSales());
  await db.collection('dvf_sales').createIndex({ type_local: 1, latitude: 1, longitude: 1, date_mutation: -1 });
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
  assert.equal(leads[0].estimation.dvf.comparables.length > 0, true);
  assert.notEqual(leads[0].property.type, 'maison');
});

test('admin : accès refusé sans session', async () => {
  assert.equal((await api('GET', '/api/leads')).status, 401);
  assert.equal((await api('GET', '/api/auth/session')).status, 401);
  assert.equal((await api('POST', '/api/admin/leads/update', { body: { leadId: 'x', status: 'contacted' } })).status, 401);
  assert.equal((await api('DELETE', '/api/admin/leads/delete?leadId=x')).status, 401);
  assert.equal((await api('GET', '/api/admin/dvf/status')).status, 401);
  assert.equal((await api('GET', '/api/admin/dvf?action=stats')).status, 401);
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

  assert.equal((await api('DELETE', `/api/admin/leads/delete?leadId=${lead.id}`, { cookie: adminCookie })).status, 200);
  assert.equal(await db.collection('leads').countDocuments(), 0);

  const logout = await api('POST', '/api/auth/logout', { cookie: adminCookie });
  assert.match(logout.headers.get('set-cookie'), /ae_admin=; .*Max-Age=0/);
});
