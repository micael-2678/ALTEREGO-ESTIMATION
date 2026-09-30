import {
  json, preflight, handler, readJson, adminCookie, signAdminToken, adminConfigProblems, safeEqual, rateLimit, clientIp
} from '@/lib/api-helpers';

export const OPTIONS = preflight;

// Mots de passe publiés dans l'historique du dépôt : considérés comme compromis
const COMPROMISED_PASSWORDS = ['Micael123', 'MotDePasseSecurise123!', 'VotreMotDePasse123', 'VotreMotDePasse123!', 'VotreMotDePasseSecurise123!'];

// Connexion admin : session dans un cookie httpOnly
export const POST = handler(async (request) => {
  const { username, password } = await readJson(request);
  const expectedUser = process.env.ADMIN_USERNAME;
  const expectedPassword = process.env.ADMIN_PASSWORD;

  // Indique précisément le réglage à corriger dans Dokploy (sans jamais afficher de valeur)
  const problems = adminConfigProblems();
  if (problems.length > 0) {
    return json(request, { error: `Connexion admin non configurée sur le serveur : ${problems.join(' ; ')}.` }, 503);
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
