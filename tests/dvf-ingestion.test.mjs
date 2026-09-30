import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeMutation, collectSales, cleanOutliers, getDefaultYears } from '../lib/dvf-ingestion.js';

const row = (overrides = {}) => ({
  id_mutation: '2024-1',
  date_mutation: '2024-03-12',
  nature_mutation: 'Vente',
  valeur_fonciere: '300000',
  adresse_numero: '12',
  adresse_nom_voie: 'RUE DE PROVENCE',
  code_postal: '75009',
  code_commune: '75109',
  nom_commune: 'Paris 9e Arrondissement',
  code_departement: '75',
  id_parcelle: '75109000AB0001',
  lot1_numero: '',
  type_local: 'Appartement',
  surface_reelle_bati: '30',
  nombre_pieces_principales: '2',
  nature_culture: '',
  surface_terrain: '',
  longitude: '2.34',
  latitude: '48.87',
  ...overrides
});

test('une vente simple donne un prix/m² exact', () => {
  const sale = summarizeMutation([row()]);
  assert.equal(sale.type_local, 'appartement');
  assert.equal(sale.prix_m2, 10000);
  assert.equal(sale.id_mutation, '2024-1');
});

test('appartement + cave : la dépendance ne fausse pas le prix', () => {
  const sale = summarizeMutation([
    row(),
    row({ type_local: 'Dépendance', surface_reelle_bati: '', nombre_pieces_principales: '0', lot1_numero: '45' })
  ]);
  assert.equal(sale.prix_m2, 10000);
  assert.equal(sale.has_dependance, true);
});

test('vente de plusieurs appartements en un seul prix : écartée', () => {
  // valeur_fonciere = prix total répété sur chaque lot
  const sale = summarizeMutation([
    row({ lot1_numero: '1', surface_reelle_bati: '30' }),
    row({ lot1_numero: '2', surface_reelle_bati: '45' }),
    row({ lot1_numero: '3', surface_reelle_bati: '50' })
  ]);
  assert.equal(sale, null);
});

test('maison sur plusieurs cultures : dédoublonnée, terrain additionné', () => {
  const house = { type_local: 'Maison', surface_reelle_bati: '120', nombre_pieces_principales: '5', valeur_fonciere: '360000' };
  const sale = summarizeMutation([
    row({ ...house, nature_culture: 'sols', surface_terrain: '200' }),
    row({ ...house, nature_culture: 'jardins', surface_terrain: '500' })
  ]);
  assert.equal(sale.type_local, 'maison');
  assert.equal(sale.prix_m2, 3000);
  assert.equal(sale.surface_terrain, 700);
});

test('VEFA, échanges et ventes mixtes avec commerce : écartés', () => {
  assert.equal(summarizeMutation([row({ nature_mutation: "Vente en l'état futur d'achèvement" })]), null);
  assert.equal(summarizeMutation([row({ nature_mutation: 'Echange' })]), null);
  assert.equal(summarizeMutation([row(), row({ type_local: 'Local industriel. commercial ou assimilé', surface_reelle_bati: '80' })]), null);
});

test('collectSales regroupe les lignes contiguës par mutation', async () => {
  const rows = [
    row({ id_mutation: 'A' }),
    row({ id_mutation: 'A', type_local: 'Dépendance', surface_reelle_bati: '' }),
    row({ id_mutation: 'B', lot1_numero: '1' }),
    row({ id_mutation: 'B', lot1_numero: '2' }),
    row({ id_mutation: 'C', valeur_fonciere: '240000' })
  ];
  const { sales, rawRows } = await collectSales(rows);
  assert.equal(rawRows, 5);
  assert.deepEqual(sales.map(s => s.id_mutation), ['A', 'C']);
});

test('collectSales écarte une mutation dont les lignes ne sont pas contiguës', async () => {
  const rows = [row({ id_mutation: 'A' }), row({ id_mutation: 'B' }), row({ id_mutation: 'A', lot1_numero: '9' })];
  const { sales } = await collectSales(rows);
  assert.deepEqual(sales.map(s => s.id_mutation), ['B']);
});

test('collectSales applique la date limite', async () => {
  const { sales } = await collectSales([row({ id_mutation: 'old', date_mutation: '2015-01-01' })], { cutoffDate: new Date('2020-01-01') });
  assert.equal(sales.length, 0);
});

test('getDefaultYears : les 5 dernières années civiles', () => {
  delete process.env.DVF_YEARS;
  assert.deepEqual(getDefaultYears(new Date('2026-09-30')), ['2021', '2022', '2023', '2024', '2025']);
});

test('cleanOutliers retire les prix aberrants', () => {
  const sales = [9800, 10000, 10100, 10200, 9900, 10050, 30000].map(prix_m2 => ({ prix_m2 }));
  const cleaned = cleanOutliers(sales).map(s => s.prix_m2);
  assert.ok(!cleaned.includes(30000));
  assert.equal(cleaned.length, 6);
});
