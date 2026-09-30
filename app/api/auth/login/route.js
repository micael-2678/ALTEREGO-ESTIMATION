import {
  json, preflight, handler, readJson, adminCookie, signAdminToken, getJwtSecret, safeEqual, rateLimit, clientIp
} from '@/lib/api-helpers';

export const OPTIONS = preflight;

// Mots de passe publiés dans l'historique du dépôt : considérés comme compromis
const COMPROMISED_PASSWORDS = ['Micael123', 'MotDePasseSecurise123!', 'VotreMotDePasse123', 'VotreMotDePasse123!', 'VotreMotDePasseSecurise123!'];

// Connexion admin : session dans un cookie httpOnly
export const POST = handler(async (request) => {
  const { username, password } = await readJson(request);
  const expectedUser = process.env.ADMIN_USERNAME;
  const expectedPassword = process.env.ADMIN_PASSWORD;

  if (!expectedUser || !expectedPassword || !getJwtSecret()) {
    return json(request, { error: 'Admin login is not configured' }, 503);
  }
  if (COMPROMISED_PASSWORDS.includes(expectedPassword)) {
    return json(request, { error: 'ADMIN_PASSWORD compromis : définissez un nouveau mot de passe administrateur' }, 503);
  }

  if (!rateLimit(`login:${clientIp(request)}`, { limit: 10, windowMs: 15 * 60 * 1000 })) {
    return json(request, { error: 'Too many attempts, try again later' }, 429);
  }

  if (safeEqual(username, expectedUser) && safeEqual(password, expectedPassword)) {
    const response = json(request, { user: { username } });
    response.headers.append('Set-Cookie', adminCookie(signAdminToken(username)));
    return response;
  }

  return json(request, { error: 'Invalid credentials' }, 401);
});
