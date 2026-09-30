import { test, expect } from '@playwright/test';

const comparables = Array.from({ length: 9 }, (_, i) => ({
  id: `c${i}`,
  address: 'Rue de la Chaussée d\'Antin, 75009 Paris 9e Arrondissement',
  price: 420000 + i * 15000,
  surface: 40 + i * 3,
  pricePerM2: 10200 + i * 120,
  date: `2025-0${(i % 9) + 1}-12`,
  distance: 80 + i * 45,
  latitude: 48.8738 + (i - 4) * 0.0009,
  longitude: 2.3372 + ((i % 3) - 1) * 0.0012
}));

const estimate = {
  dvf: { count: 9, radius: 500, months: 24, stats: { weightedAverage: 11700 }, comparables, warning: null },
  adjustments: {
    basePricePerM2: 11700, adjustedPricePerM2: 10820, totalImpact: -0.05, offsetApplied: -8, clampApplied: false,
    adjustments: [
      { factor: 'Étage & ascenseur', description: 'Étages 1-3 avec ascenseur', impact: 4 },
      { factor: 'Extérieur', description: 'Petit balcon', impact: 3 },
      { factor: 'DPE', description: 'DPE F', impact: -12 }
    ]
  },
  finalPrice: { mid: 703300, low: 654069, high: 752531, confidence: 81 },
  disclaimer: 'Valeurs indicatives, non contractuelles.'
};

async function mockApi(page, calls) {
  await page.route('**/api/geo/resolve*', r => r.fulfill({ json: { suggestions: [
    { address: '2 Rue des Italiens 75009 Paris', lat: 48.8718, lng: 2.3372 },
    { address: '2 Rue des Italiens 13001 Marseille', lat: 43.29, lng: 5.38 }
  ] } }));
  await page.route('**/api/verification/send-otp', r => { calls.push('send'); r.fulfill({ json: { success: true } }); });
  await page.route('**/api/verification/verify-otp', r => { calls.push('verify'); r.fulfill({ json: { success: true, verified: true } }); });
  await page.route('**/api/leads', r => { calls.push('lead'); r.fulfill({ json: { success: true, leadId: 'L1' } }); });
  await page.route('**/api/estimate', r => {
    calls.push(`estimate:${JSON.parse(r.request().postData()).leadId}`);
    r.fulfill({ json: estimate });
  });
  // Tuiles de carte et tags externes inutiles au test
  await page.route(/(basemaps\.cartocdn\.com|googletagmanager\.com)/, r => r.abort());
}

// Sur mobile, un contenu trop large fait dézoomer le navigateur (innerWidth grandit) :
// on compare donc à la largeur réelle de l'écran
async function expectNoHorizontalOverflow(page) {
  const screenWidth = page.viewportSize().width;
  const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(pageWidth).toBeLessThanOrEqual(screenWidth + 1);
}

test('parcours complet : adresse → estimation, un seul lead', async ({ page }) => {
  const calls = [];
  await mockApi(page, calls);
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1 })).toContainText('Combien vaut votre bien');
  await page.fill('#address', '2 rue des ital');
  await page.getByRole('option').first().waitFor();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: /Commencer/ }).click();

  await page.getByRole('button', { name: 'Appartement' }).click();
  await page.fill('#surface', '65');
  await page.fill('#rooms', '3');
  await page.fill('#floor', '2');
  await page.fill('#floors', '6');
  await page.getByRole('button', { name: 'Oui', exact: true }).click();
  await expectNoHorizontalOverflow(page);
  await page.getByRole('button', { name: /Continuer/ }).click();

  await page.getByText('Balcon ou terrasse').click();
  await page.getByRole('button', { name: 'Dégagée' }).click();
  await page.getByRole('button', { name: /Continuer/ }).click();

  await page.getByRole('button', { name: 'DPE F' }).click();
  await page.getByRole('button', { name: /Continuer/ }).click();

  await page.fill('#name', 'Jean Test');
  await page.fill('#email', 'jean@test.fr');
  await page.fill('#phone', '0612345678');
  await page.getByRole('button', { name: /Vendre/ }).click();
  await page.check('#consent');
  await page.getByRole('button', { name: /Recevoir mon estimation/ }).click();

  await expect(page.getByText('Vérifiez votre téléphone')).toBeVisible();
  await page.keyboard.type('123456');

  await expect(page.getByText('Valeur estimée')).toBeVisible();
  await expect(page.getByText('703 300 €').first()).toBeVisible();
  await expect(page.getByText('Ajustement de prudence')).toBeVisible();
  await expectNoHorizontalOverflow(page);

  // Un seul lead, auquel l'estimation est rattachée
  expect(calls).toEqual(['send', 'verify', 'lead', 'estimate:L1']);

  // Nouvelle estimation : retour à l'accueil, pas de nouveau SMS nécessaire
  await page.getByRole('button', { name: 'Nouvelle estimation' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Combien vaut votre bien');
});

test("mode intégré : pas d'en-tête ni de pied de page", async ({ page }) => {
  await mockApi(page, []);
  await page.goto('/?embed=1');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('header')).toHaveCount(0);
  await expect(page.locator('footer')).toHaveCount(0);
});

test("admin : connexion puis liste des leads", async ({ page }) => {
  let loggedIn = false;
  await page.route('**/api/auth/session', r => loggedIn
    ? r.fulfill({ json: { authenticated: true, user: { username: 'admin' } } })
    : r.fulfill({ status: 401, json: { authenticated: false } }));
  await page.route('**/api/auth/login', r => { loggedIn = true; r.fulfill({ json: { user: { username: 'admin' } } }); });
  await page.route('**/api/leads', r => r.fulfill({ json: { leads: [{
    id: 'L1', name: 'Jeanne Martin', email: 'jeanne@test.fr', phone: '0612345678', estimationReason: 'Vendre',
    status: 'estimation_complete', createdAt: '2026-09-30T10:00:00.000Z',
    property: { address: '2 Rue des Italiens 75009 Paris', type: 'appartement', surface: '65' },
    estimation: { finalPrice: { low: 654069, mid: 703300, high: 752531, confidence: 81 } }
  }] } }));

  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
  await page.getByPlaceholder("Entrez votre nom d'utilisateur").fill('admin');
  await page.getByPlaceholder('Entrez votre mot de passe').fill('secret');
  await page.getByRole('button', { name: 'Se connecter' }).click();

  await expect(page.getByText('Jeanne Martin')).toBeVisible();
  // Le prix affiché est le prix estimé, pas le bas de fourchette
  await expect(page.getByText(/703.300 €/).first()).toBeVisible();
});
