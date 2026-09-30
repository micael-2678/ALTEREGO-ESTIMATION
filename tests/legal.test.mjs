import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEGAL, CONSENT_TEXTS, missingLegalFields, legalValue } from '../lib/legal.js';
import { retentionCutoff, expiredLeadsFilter } from '../lib/server/retention.js';

test('consentements : aucun partenaire, prospection distincte et révocable', () => {
  assert.doesNotMatch(CONSENT_TEXTS.service, /partenaire/i);
  assert.doesNotMatch(CONSENT_TEXTS.service, /offre|prospection|newsletter/i);
  assert.match(CONSENT_TEXTS.marketing, /désinscrire/);
});

test('champs légaux manquants signalés et affichés « à compléter »', () => {
  assert.ok(missingLegalFields().every(key => !LEGAL[key]));
  const missing = missingLegalFields()[0];
  if (missing) assert.equal(legalValue(missing), '[à compléter]');
});

test('durée de conservation : 36 mois après le dernier échange', () => {
  assert.equal(retentionCutoff(new Date('2026-09-30T00:00:00Z'), 36).slice(0, 10), '2023-09-30');
  const filter = expiredLeadsFilter(new Date('2026-09-30T00:00:00Z'), 36);
  assert.equal(filter.$or[0].lastModified.$lt.slice(0, 10), '2023-09-30');
  assert.equal(filter.$or[1].lastModified.$exists, false);
});
