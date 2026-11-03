import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  normalizeKey, toNumber, normalizeInsee, detectDelimiter, categoryFromTitle, parseCarteRow, parseCarteCsv,
  normalizePeriod, parseParisFeatures, decodeCsv
} from '../lib/rent-ingestion.js';

test('en-têtes et valeurs tolérants (casse, ponctuation, virgule décimale, zéro initial)', () => {
  assert.equal(normalizeKey('lwr.IPm2'), 'lwripm2');
  assert.equal(normalizeKey('INSEE_C'), 'inseec');
  assert.equal(toNumber('12,34'), 12.34);
  assert.equal(toNumber('1 234'), 1234);
  assert.equal(toNumber(''), null);
  assert.equal(normalizeInsee('1001'), '01001');
  assert.equal(normalizeInsee('2A004'), '2A004');
  assert.equal(normalizeInsee('abc'), null);
  assert.equal(detectDelimiter('INSEE_C;LIBGEO;loypredm2'), ';');
  assert.equal(detectDelimiter('INSEE_C,LIBGEO,loypredm2'), ',');
  assert.equal(decodeCsv(Buffer.from('Vétheuil', 'latin1')), 'Vétheuil');
  assert.equal(decodeCsv(Buffer.from('Vétheuil', 'utf8')), 'Vétheuil');
});

test('catégorie d\'un fichier de la Carte des loyers d\'après son nom', () => {
  assert.equal(categoryFromTitle('pred-app-mef-dhup.csv'), 'appartement');
  assert.equal(categoryFromTitle('pred-app12-mef-dhup.csv'), 'appartement_1_2');
  assert.equal(categoryFromTitle('pred-app3-mef-dhup.csv'), 'appartement_3_plus');
  assert.equal(categoryFromTitle('pred-mai-mef-dhup.csv'), 'maison');
  assert.equal(categoryFromTitle('Indicateurs 2025 - Appartements 3 pièces et plus'), 'appartement_3_plus');
  assert.equal(categoryFromTitle('Indicateurs 2025 - Appartements 1-2 pièces'), 'appartement_1_2');
  assert.equal(categoryFromTitle('Carte des loyers 2023 - appartements'), 'appartement');
  assert.equal(categoryFromTitle('Maisons - loyers 2025'), 'maison');
  assert.equal(categoryFromTitle('Documentation méthodologique'), null);
});

test('ligne de la Carte des loyers : commune ou maille, observations, bornes', () => {
  const row = parseCarteRow(
    { INSEE_C: '92012', LIBGEO: 'Boulogne-Billancourt', EPCI: '200057966', DEP: '92', REG: '11', loypredm2: '28,4', 'lwr.IPm2': '26,1', 'upr.IPm2': '30,9', TYPPRED: 'commune', nbobs_com: '214', nbobs_mail: '950' },
    { category: 'appartement_3_plus', year: 2025 }
  );
  assert.equal(row.insee, '92012');
  assert.equal(row.rentPerM2, 28.4);
  assert.equal(row.low, 26.1);
  assert.equal(row.predictionLevel, 'commune');
  assert.equal(row.observations.commune, 214);
  assert.equal(row.referenceDate, '2025-09-01');

  const maille = parseCarteRow({ INSEE_C: '1001', loypredm2: '9.8', TYPPRED: 'maille', nbobs_com: '0', nbobs_mail: '40' }, { category: 'maison', year: 2025 });
  assert.equal(maille.insee, '01001');
  assert.equal(maille.predictionLevel, 'maille');
  assert.equal(maille.department, '01');

  // Type de prédiction inconnu : décidé par le nombre d'annonces dans la commune
  assert.equal(parseCarteRow({ INSEE_C: '75109', loypredm2: '35', TYPPRED: '2', nbobs_com: '3' }, { category: 'appartement', year: 2025 }).predictionLevel, 'maille');
  assert.equal(parseCarteRow({ INSEE_C: '75109', loypredm2: '35', TYPPRED: '1', nbobs_com: '80' }, { category: 'appartement', year: 2025 }).predictionLevel, 'commune');
  assert.equal(parseCarteRow({ INSEE_C: '', loypredm2: '35' }, { category: 'appartement', year: 2025 }), null);
  assert.equal(parseCarteRow({ INSEE_C: '75109', loypredm2: 'NA' }, { category: 'appartement', year: 2025 }), null);
});

test('fichier CSV complet : séparateur détecté, BOM, doublons ignorés', async () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'loyers-')), 'app12.csv');
  const lines = ['﻿id_zone;INSEE_C;LIBGEO;EPCI;DEP;REG;loypredm2;lwr.IPm2;upr.IPm2;TYPPRED;nbobs_com;nbobs_mail'];
  for (let i = 1; i <= 120; i++) {
    lines.push(`${i};${String(92000 + i)};Commune ${i};200057966;92;11;${(20 + i / 10).toFixed(1).replace('.', ',')};19,0;25,0;commune;${i};${i * 5}`);
  }
  lines.push('1;92001;Commune 1 (doublon);200057966;92;11;99,0;90,0;100,0;commune;1;5');
  lines.push('x;abc;Ligne invalide;;;;;;;;;');
  fs.writeFileSync(file, lines.join('\r\n'));

  const result = await parseCarteCsv(file, { category: 'appartement_1_2', year: 2025 });
  assert.equal(result.rows, 122);
  assert.equal(result.docs.length, 120);
  assert.equal(result.docs[0].name, 'Commune 1');
  assert.equal(result.docs[0].rentPerM2, 20.1);
  assert.deepEqual(result.predictionTypes, { commune: 121 });
  await assert.rejects(parseCarteCsv(file, { category: 'villa', year: 2025 }), /Catégorie inconnue/);
});

test('encadrement Paris : époques, meublé, regroupement par quartier, dernière année', () => {
  assert.equal(normalizePeriod('Avant 1946'), 'avant_1946');
  assert.equal(normalizePeriod('1946-1970'), '1946_1970');
  assert.equal(normalizePeriod('1971-1990'), '1971_1990');
  assert.equal(normalizePeriod('Apres 1990'), 'apres_1990');
  assert.equal(normalizePeriod('Après 1990'), 'apres_1990');
  assert.equal(normalizePeriod('?'), null);

  const polygon = { type: 'Polygon', coordinates: [[[2.33, 48.87], [2.34, 48.87], [2.34, 48.88], [2.33, 48.88], [2.33, 48.87]]] };
  const feature = (props) => ({ type: 'Feature', geometry: polygon, properties: props });
  const features = [];
  for (const annee of [2025, 2026]) {
    for (const piece of [1, 2, 3, 4]) {
      for (const epoque of ['Avant 1946', '1946-1970', '1971-1990', 'Apres 1990']) {
        for (const meuble_txt of ['non meublé', 'meublé']) {
          const ref = 30 + piece + (annee - 2025) + (meuble_txt === 'meublé' ? 3 : 0);
          features.push(feature({ id_zone: 3, id_quartier: 33, nom_quartier: 'Chaussée-d\'Antin', piece, epoque, meuble_txt, ref, max: ref * 1.2, min: ref * 0.7, annee, ville: 'PARIS' }));
        }
      }
    }
  }
  // Un second quartier, et une entité incomplète ignorée
  features.push(feature({ id_zone: 1, id_quartier: 1, nom_quartier: 'Saint-Germain-l\'Auxerrois', piece: '4', epoque: 'Avant 1946', meuble_txt: 'non meublé', ref: '40,5', max: '48,6', min: '28,35', annee: '2026' }));
  features.push(feature({ id_quartier: 2, piece: 2, epoque: 'Avant 1946', meuble_txt: 'non meublé', ref: '', annee: 2026 }));

  const parsed = parseParisFeatures({ type: 'FeatureCollection', features });
  assert.equal(parsed.year, 2026);
  assert.equal(parsed.zones.length, 2);
  const zone = parsed.zones.find(z => z.quartierId === 33);
  assert.equal(zone.refs.length, 32);
  assert.equal(zone.zoneId, 3);
  assert.deepEqual(zone.geometry, polygon);
  const ref = zone.refs.find(r => r.rooms === 2 && r.period === '1971_1990' && r.furnished === true);
  assert.equal(ref.ref, 36);
  assert.equal(Math.round(ref.max * 10) / 10, 43.2);
  const other = parsed.zones.find(z => z.quartierId === 1);
  assert.equal(other.refs[0].ref, 40.5);
  assert.equal(other.refs[0].rooms, 4);

  // Année imposée
  assert.equal(parseParisFeatures({ features }, { year: 2025 }).zones[0].refs.find(r => r.rooms === 1 && !r.furnished).ref, 31);
});
