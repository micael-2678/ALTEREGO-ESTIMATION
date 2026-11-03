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
  dvf: { count: 9, radius: 500, months: 24, stats: { weightedAverage: 11700 }, trend: { annualRatePercent: -3.2, sampleSize: 640, applied: true }, comparables, warning: null },
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

// Estimation de loyer (projet « Louer ») : Paris, plafonnée par l'encadrement
const rentEstimate = {
  ...estimate,
  rent: {
    available: true,
    monthly: { exclCharges: 1562, inclCharges: 1725, low: 1500, high: 1562, charges: 163, parking: 0, perM2ExclCharges: 24.03 },
    market: {
      monthly: 1690, perM2ExclCharges: 26, totalAdjustmentPercent: 6.5, district: null,
      references: [
        { code: 'paris_observatory', label: 'Observatoire des loyers — quartier Chaussée-d\'Antin (arrêté 2026)', detail: '3 pièces, 1946-1970, non meublé : loyer de référence', perM2: 20.03, unit: '€/m² hors charges' },
        { code: 'carte_loyers', label: 'Loyers d\'annonce — Paris 9e Arrondissement (Carte des loyers 2025)', detail: 'appartements 3 pièces et plus, logement vide de 72 m², 150 annonces observées', perM2: 34, unit: '€/m² charges comprises' }
      ],
      steps: [{ code: 'base', label: 'Loyer de référence du quartier', description: 'Observatoire des loyers et loyers d\'annonce', perM2: 24.4, unit: '€/m² hors charges' }],
      adjustments: [{ factor: 'État intérieur', description: 'Rénové récent', impact: 10 }, { factor: 'DPE', description: 'DPE F', impact: -8 }]
    },
    legal: {
      rentable: true,
      notices: [
        { code: 'paris_control', level: 'info', title: 'Encadrement des loyers à Paris', text: 'Arrêté préfectoral 2026, zone 3, quartier Chaussée-d\'Antin. Le loyer hors charges ne peut pas dépasser 1 562 € par mois.' },
        { code: 'dpe_freeze', level: 'warning', title: 'Loyer gelé (DPE F ou G)', text: 'Depuis le 24 août 2022, le loyer d\'un logement classé F ou G ne peut plus être augmenté.' }
      ],
      caps: [{ code: 'paris_max', label: 'Plafond de l\'encadrement (loyer de référence majoré)', monthly: 1562, perM2: 24.03 }],
      applied: { code: 'paris_max', label: 'Plafond de l\'encadrement (loyer de référence majoré)', monthly: 1562, perM2: 24.03 },
      parisControl: { city: 'Paris', year: 2026, zoneId: 3, quartier: 'Chaussée-d\'Antin', rooms: 3, refPerM2: 20.03, maxPerM2: 24.03, minPerM2: 14.02, maxMonthly: 1562 },
      tenseZone: 'yes'
    },
    confidence: 80, uncertaintyBand: 7,
    source: { kind: 'paris_blend', category: 'appartement_3_plus', label: 'Observatoire des loyers (quartier Chaussée-d\'Antin) et Carte des loyers 2025', referenceDate: '2026-07-01' },
    yield: { gross: 2.7 }, furnished: false, constructionPeriod: '1946_1970', warning: null
  },
  disclaimer: 'Valeurs indicatives, non contractuelles.'
};

async function mockApi(page, calls) {
  await page.route('**/api/geo/resolve*', r => r.fulfill({ json: { suggestions: [
    { address: '2 Rue des Italiens 75009 Paris', lat: 48.8718, lng: 2.3372, insee: '75109' },
    { address: '2 Rue des Italiens 13001 Marseille', lat: 43.29, lng: 5.38 }
  ] } }));
  await page.route('**/api/verification/send-otp', r => { calls.push('send'); r.fulfill({ json: { success: true } }); });
  await page.route('**/api/verification/verify-otp', r => { calls.push('verify'); r.fulfill({ json: { success: true, verified: true } }); });
  await page.route('**/api/leads', r => { calls.push('lead'); r.fulfill({ json: { success: true, leadId: 'L1' } }); });
  await page.route('**/api/estimate', r => {
    const body = JSON.parse(r.request().postData());
    calls.push(`estimate:${body.leadId}`);
    if (body.purpose === 'rent') calls.push(`rent:${body.rent.rooms}:${body.rent.furnished}:${body.rent.insee}:${body.rent.rentedRecently}`);
    r.fulfill({ json: body.purpose === 'rent' ? rentEstimate : estimate });
  });
  // Tuiles de carte et tags externes inutiles au test
  await page.route(/(tile\.openstreetmap\.org|basemaps\.cartocdn\.com|googletagmanager\.com)/, r => r.abort());
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
  await page.getByRole('button', { name: 'Tout refuser' }).click();

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
  // Consentement à la prospection : case distincte, décochée par défaut
  await expect(page.locator('#marketingConsent')).not.toBeChecked();
  await expect(page.getByText(/partenaires/)).toHaveCount(0);
  await page.check('#consent');
  await page.getByRole('button', { name: /Recevoir mon estimation/ }).click();

  await expect(page.getByText('Vérifiez votre téléphone')).toBeVisible();
  await page.keyboard.type('123456');

  await expect(page.getByText('Valeur estimée')).toBeVisible();
  await expect(page.getByText('703 300 €').first()).toBeVisible();
  await expect(page.getByText('Ajustement de prudence')).toBeVisible();
  await expect(page.getByText(/évolue de -3,2 % par an/)).toBeVisible();
  await expectNoHorizontalOverflow(page);

  // Un seul lead, auquel l'estimation est rattachée
  expect(calls).toEqual(['send', 'verify', 'lead', 'estimate:L1']);

  // Nouvelle estimation : retour à l'accueil, pas de nouveau SMS nécessaire
  await page.getByRole('button', { name: 'Nouvelle estimation' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Combien vaut votre bien');
});

test('parcours location : questions propres au loyer, résultat plafonné et cadre légal', async ({ page }) => {
  const calls = [];
  await mockApi(page, calls);
  await page.goto('/');
  await page.getByRole('button', { name: 'Tout refuser' }).click();

  await page.fill('#address', '2 rue des ital');
  await page.getByRole('option').first().click();
  await page.getByRole('button', { name: /Commencer/ }).click();
  await page.getByRole('button', { name: 'Appartement' }).click();
  await page.fill('#surface', '65');
  await page.fill('#rooms', '3');
  await page.fill('#floor', '2');
  await page.fill('#floors', '6');
  await page.getByRole('button', { name: 'Oui', exact: true }).click();
  await page.getByRole('button', { name: /Continuer/ }).click();
  await page.getByRole('button', { name: /Continuer/ }).click();
  await page.getByRole('button', { name: /Continuer/ }).click();

  await page.fill('#name', 'Marie Bailleur');
  await page.fill('#email', 'marie@test.fr');
  await page.fill('#phone', '0612345678');
  await page.getByRole('button', { name: /Louer/ }).click();
  // Les questions de location apparaissent ; l'époque est demandée car l'année n'a pas été saisie
  await expect(page.getByText('Type de location')).toBeVisible();
  await expect(page.getByText('Époque de construction')).toBeVisible();
  await page.check('#consent');
  await expect(page.getByRole('button', { name: /Recevoir mon estimation/ })).toBeDisabled();
  await page.getByRole('button', { name: 'Vide' }).click();
  await page.getByRole('button', { name: '1946-1970' }).click();
  await page.getByRole('button', { name: 'Non', exact: true }).click();
  await expectNoHorizontalOverflow(page);
  await page.getByRole('button', { name: /Recevoir mon estimation/ }).click();
  // Attendre l'écran de saisie du code avant de taper (le runner CI est plus lent)
  await expect(page.getByText('Vérifiez votre téléphone')).toBeVisible();
  await page.keyboard.type('123456');

  await expect(page.getByText('Loyer estimé', { exact: true })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('1 562 €').first()).toBeVisible();
  await expect(page.getByText(/plafonné par la loi/)).toBeVisible();
  await expect(page.getByText('Encadrement des loyers à Paris')).toBeVisible();
  await expect(page.getByText('Loyer gelé (DPE F ou G)')).toBeVisible();
  await expect(page.getByText('Rendement locatif brut')).toBeVisible();
  await expect(page.getByText('Valeur de vente et rendement')).toBeVisible();
  await expectNoHorizontalOverflow(page);

  expect(calls).toEqual(['send', 'verify', 'lead', 'estimate:L1', 'rent:3:false:75109:false']);
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

test('cookies : aucun traceur Google avant accord, refus aussi simple qu\'acceptation', async ({ page }) => {
  const googleRequests = [];
  page.on('request', r => { if (/googletagmanager\.com/.test(r.url())) googleRequests.push(r.url()); });
  await page.route(/googletagmanager\.com/, r => r.abort());

  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Tout refuser' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tout accepter' })).toBeVisible();
  await page.waitForTimeout(500);
  expect(googleRequests).toHaveLength(0);

  // Refus : bandeau fermé, toujours aucun traceur, choix mémorisé
  await page.getByRole('button', { name: 'Tout refuser' }).click();
  await page.reload();
  await page.waitForTimeout(500);
  await expect(page.getByRole('button', { name: 'Tout refuser' })).toHaveCount(0);
  expect(googleRequests).toHaveLength(0);

  // Changement d'avis depuis le pied de page : acceptation → traceurs chargés
  await page.getByRole('button', { name: 'Gérer les cookies' }).click();
  await page.getByRole('button', { name: 'Tout accepter' }).click();
  await expect.poll(() => googleRequests.length).toBeGreaterThan(0);
});

test('pages légales accessibles depuis le pied de page', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Tout refuser' }).click();
  await page.getByRole('link', { name: 'Confidentialité' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Politique de confidentialité');
  await expect(page.locator('#cookies')).toBeVisible();
  await expect(page.getByText('www.cnil.fr/fr/plaintes')).toBeVisible();
  await page.goto('/mentions-legales');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mentions légales');
});
