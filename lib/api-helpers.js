import { NextResponse } from 'next/server';
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

// Aucun secret par défaut : sans JWT_SECRET solide, l'admin est désactivé
export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16 || KNOWN_WEAK_SECRETS.has(secret)) {
    return null;
  }
  return secret;
}

export function signAdminToken(username) {
  const secret = getJwtSecret();
  if (!secret) throw new Error('JWT_SECRET is not configured');
  return jwt.sign({ username, role: 'admin' }, secret, { expiresIn: '12h' });
}

// Retourne null si autorisé, sinon la réponse d'erreur à renvoyer
export function requireAdmin(request) {
  const secret = getJwtSecret();
  if (!secret) {
    return json(request, { error: 'Admin disabled: JWT_SECRET is not configured' }, 503);
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return json(request, { error: 'Unauthorized' }, 401);
  }

  try {
    const payload = jwt.verify(authHeader.slice(7), secret);
    if (payload.role !== 'admin') {
      return json(request, { error: 'Invalid token' }, 401);
    }
    return null;
  } catch {
    return json(request, { error: 'Invalid token' }, 401);
  }
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
