/**
 * RÉGLAGES DE L'ESTIMATION DE LOYER
 *
 * Il n'existe pas de base publique des loyers signés (l'équivalent de DVF pour la
 * location). Le loyer est donc reconstruit à partir de références publiques
 * (observatoire des loyers à Paris, « Carte des loyers » ailleurs), puis corrigé selon la
 * surface, le quartier et les caractéristiques du bien, avant application des règles
 * légales. Les coefficients ci-dessous viennent des observatoires des loyers et de
 * l'expérience du marché francilien ; aucun loyer réel n'ayant servi à les caler, ils sont
 * à ajuster dès que des loyers signés sont connus (voir docs/LOYERS.md).
 *
 * Les pourcentages sont exprimés en fraction (0.12 = 12 %).
 */

// Catégories de la « Carte des loyers » (loyers d'annonce par commune, charges comprises,
// logements vides). Pour un appartement, la catégorie suit le nombre de pièces.
export const RENT_CATEGORIES = ['appartement_1_2', 'appartement_3_plus', 'appartement', 'maison'];

export const CONSTRUCTION_PERIODS = ['avant_1946', '1946_1970', '1971_1990', 'apres_1990'];
export const PERIOD_LABELS = {
  avant_1946: 'avant 1946',
  '1946_1970': '1946-1970',
  '1971_1990': '1971-1990',
  apres_1990: 'après 1990'
};

// Surface du bien de référence de chaque catégorie (guide d'utilisation de la Carte des
// loyers). ⚠️ Valeurs à confirmer sur le guide de l'édition importée ; surcharge :
// RENT_REFERENCE_SURFACES="appartement_1_2:38,appartement_3_plus:72,maison:92"
const DEFAULT_REFERENCE_SURFACES = { appartement_1_2: 40, appartement_3_plus: 72, appartement: 49, maison: 92 };
export const RENT_REFERENCE_SURFACES = { ...DEFAULT_REFERENCE_SURFACES };
for (const pair of (process.env.RENT_REFERENCE_SURFACES || '').split(',')) {
  const [key, value] = pair.split(':').map(s => s && s.trim());
  if (key in DEFAULT_REFERENCE_SURFACES && parseFloat(value) > 0) RENT_REFERENCE_SURFACES[key] = parseFloat(value);
}

// Élasticité du loyer au m² à la surface : loyer/m² = référence × (surface / surface_ref)^(-β).
// Un studio se loue nettement plus cher au m² qu'un grand appartement. Effet borné.
export const SURFACE_ELASTICITY = { appartement: 0.25, maison: 0.15, max_effect: 0.20 };

// Correction de quartier (hors Paris) : la Carte des loyers ne distingue pas les quartiers
// d'une commune. On compare les prix de vente DVF autour du bien à ceux de la commune ;
// les loyers varient environ deux fois moins que les prix (exposant 0,5). Facteur borné.
export const DISTRICT_CORRECTION = {
  exponent: 0.5,
  min_factor: 0.85,
  max_factor: 1.15,
  min_local_sales: 8,        // ventes comparables autour du bien nécessaires
  min_commune_sales: 30      // ventes dans la commune nécessaires
};

// Charges locatives récupérables estimées (€/m²/mois) : la Carte des loyers est charges
// comprises, l'encadrement parisien est hors charges.
export const CHARGES_PER_M2 = { appartement: 2.5, maison: 0.6, min_monthly: 15 };

// Meublé : supplément par rapport au loyer vide, hors Paris (où l'observatoire publie des
// références meublées distinctes).
export const FURNISHED_PREMIUM = 0.12;

// Stationnement loué en plus du logement (€/mois, indicatif)
export const PARKING_RENT = { outdoor: 60, indoor: 100 };

// Paris : le loyer de référence de l'encadrement est la médiane des loyers de tout le parc
// (observatoire OLAP), locataires en place compris. Un logement remis en location se loue
// au-dessus de cette médiane.
export const PARIS = {
  new_lease_premium: 0.10,      // relocation vs médiane du parc
  weight_observatory: 0.6,      // pondération observatoire (quartier) / loyers d'annonce (arrondissement)
  typical_surfaces: { 1: 25, 2: 42, 3: 65, 4: 95 },   // surface typique par nombre de pièces
  surface_elasticity: 0.15,     // correction de surface à l'intérieur d'une catégorie de pièces
  max_surface_effect: 0.08
};

// Dérive annuelle des loyers appliquée entre la date de référence des données et aujourd'hui
export const ANNUAL_RENT_DRIFT = 0.01;

// Poids des caractéristiques, en % du loyer (même moteur que la vente, poids propres à la
// location). Le stationnement est traité à part (loyer séparé), la surface par l'élasticité.
export const RENT_ADJUSTMENT_WEIGHTS = {
  floor_elevator: 5,
  outside: 6,
  view: 3,
  parking: 0,
  condition: 10,
  dpe: 8,
  surface_effect: 0,
  plot: 4,
  house_extras: 4
};

// Indice de confiance (30-90) selon la qualité de la référence
export const RENT_CONFIDENCE = {
  paris_blend: 80,              // observatoire du quartier + annonces de l'arrondissement
  paris_observatory: 75,        // observatoire seul
  commune_many: 72,             // Carte des loyers au niveau commune, nombreuses annonces
  commune_some: 65,
  commune_few: 58,
  maille: 50,                   // commune trop petite : indicateur d'une zone plus large
  commune_many_threshold: 50,   // nombre d'annonces observées dans la commune
  commune_some_threshold: 20,
  bonus_district_correction: 4,
  penalty_generic_category: 5,  // indicateur « tous appartements » faute de catégorie
  penalty_unknown_period: 5,    // Paris : époque de construction inconnue
  min: 30,
  max: 90
};

// Zones tendues (décret 2013-392) : départements entièrement couverts, et ceux où la
// quasi-totalité des communes de l'agglomération parisienne le sont.
export const TENSE_ZONE = {
  departments: ['75', '92', '93', '94'],
  likely_departments: ['77', '78', '91', '95']
};

// Décence énergétique (loi Climat et résilience) et gel des loyers des passoires
export const DPE_RULES = {
  banned: ['G'],                                   // interdits à la location depuis le 1er janvier 2025
  banned_from: { F: '1er janvier 2028', E: '1er janvier 2034' },
  rent_freeze: ['F', 'G']                          // loyers gelés depuis le 24 août 2022
};
