import { NextResponse } from 'next/server.js';
import jwt from 'jsonwebtoken';
import { timingSafeEqual } from 'crypto';

// Origines autorisées à appeler l'API depuis un autre domaine (intégration
// dans le site alteregopatrimoine). Surchargeable via CORS_ORIGINS="https://a.fr,https://b.fr".
const DEFAULT_ORIGINS = [
  'https://alteregopatrimoine.com',
  'https://www.alteregopatrimoine.com',
];

export function getAllowedOrigins() {
  const fromEnv = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);
  return fromEnv.length > 0 ? fromEnv : DEFAULT_ORIGINS;
}

export function corsHeadersFor(request) {
  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    Vary: 'Origin',
  };
  const origin = request?.headers?.get('origin');
  if (origin && getAllowedOrigins().includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

export function json(request, body, status = 200) {
  return NextResponse.json(body, { status, headers: corsHeadersFor(request) });
}

// Réponse aux requêtes CORS préalables (à exporter comme OPTIONS dans chaque route)
export function preflight(request) {
  return new NextResponse(null, { status: 204, headers: corsHeadersFor(request) });
}

// Enveloppe une route : toute exception devient une réponse 500 sans détail technique
export function handler(fn) {
  return async (request, context) => {
    try {
      return await fn(request, context);
    } catch (error) {
      return serverError(request, error);
    }
  };
}

// Route réservée à l'admin (cookie de session ou en-tête Bearer)
export function adminHandler(fn) {
  return handler((request, context) => requireAdmin(request) || fn(request, context));
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

// Réponse 500 sans divulguer le détail technique en production
export function serverError(request, error) {
  console.error('API Error:', error);
  const body = { error: 'Internal server error' };
  if (process.env.NODE_ENV !== 'production') {
    body.message = error?.message;
  }
  return json(request, body, 500);
}

// Valeurs d'exemple publiées dans d'anciennes docs / docker-compose : refusées
const KNOWN_WEAK_SECRETS = new Set([
  'fallback-secret',
  'your-secret-key-change-in-production',
  'votre-secret-key',
  'votre-secret-key-securise',
  'votre-secret-key-securise-changez-moi',
  'votre-secret-jwt-minimum-32-caracteres',
  'votre-secret-jwt-minimum-32-caracteres-aleatoires-securises',
  'votre-secret-jwt-32-caracteres-minimum',
  'votre-secret-securise-32-caracteres',
  'un-secret-tres-long-et-securise-32-caracteres-minimum',
  'votre-secret-tres-long',
]);

// Raison pour laquelle JWT_SECRET est refusé (null si utilisable). Ne révèle jamais la valeur.
export function jwtSecretProblem() {
  const secret = process.env.JWT_SECRET;
  if (!secret) return 'JWT_SECRET absent';
  if (secret.length < 16) return `JWT_SECRET trop court (${secret.length} caractères, 16 minimum)`;
  if (KNOWN_WEAK_SECRETS.has(secret)) return "JWT_SECRET est une valeur d'exemple publiée dans l'ancienne documentation";
  return null;
}

// Aucun secret par défaut : sans JWT_SECRET solide, l'admin est désactivé
export function getJwtSecret() {
  return jwtSecretProblem() ? null : process.env.JWT_SECRET;
}

// Liste des réglages admin manquants ou refusés (vide si l'admin est utilisable)
export function adminConfigProblems() {
  const problems = [];
  if (!process.env.ADMIN_USERNAME) problems.push('ADMIN_USERNAME absent');
  if (!process.env.ADMIN_PASSWORD) problems.push('ADMIN_PASSWORD absent');
  const jwtProblem = jwtSecretProblem();
  if (jwtProblem) problems.push(jwtProblem);
  return problems;
}

export function signAdminToken(username) {
  const secret = getJwtSecret();
  if (!secret) throw new Error('JWT_SECRET is not configured');
  return jwt.sign({ username, role: 'admin' }, secret, { expiresIn: '12h' });
}

export const ADMIN_COOKIE = 'ae_admin';
const ADMIN_SESSION_SECONDS = 12 * 60 * 60;

// Cookie de session admin : httpOnly (illisible par un script), SameSite=Strict (anti-CSRF)
export function adminCookie(token) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return token
    ? `${ADMIN_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${ADMIN_SESSION_SECONDS}${secure}`
    : `${ADMIN_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
}

function readCookie(request, name) {
  const header = request.headers.get('cookie') || '';
  const match = header.split(/;\s*/).find(c => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

// Jeton admin : cookie de session (navigateur) ou en-tête Bearer (scripts)
function readAdminToken(request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) return authHeader.slice(7);
  return readCookie(request, ADMIN_COOKIE);
}

// Retourne l'utilisateur admin si le jeton est valide, sinon null
export function getAdminUser(request) {
  const secret = getJwtSecret();
  const token = readAdminToken(request);
  if (!secret || !token) return null;
  try {
    const payload = jwt.verify(token, secret);
    return payload.role === 'admin' ? { username: payload.username } : null;
  } catch {
    return null;
  }
}

// Retourne null si autorisé, sinon la réponse d'erreur à renvoyer
export function requireAdmin(request) {
  const jwtProblem = jwtSecretProblem();
  if (jwtProblem) {
    return json(request, { error: `Administration désactivée : ${jwtProblem}` }, 503);
  }
  if (!readAdminToken(request)) {
    return json(request, { error: 'Unauthorized' }, 401);
  }
  return getAdminUser(request) ? null : json(request, { error: 'Invalid token' }, 401);
}

export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

// Limiteur de débit en mémoire (suffisant pour une instance unique)
const buckets = new Map();

export function rateLimit(key, { limit, windowMs }) {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= limit;
}

export function clientIp(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}
