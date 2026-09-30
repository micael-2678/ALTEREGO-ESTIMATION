import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldBypassVerification, normalizePhoneNumber, isValidFrenchPhone } from '../lib/otp-service.js';

test('numéros dispensés : un ou plusieurs, quel que soit le format saisi', () => {
  process.env.BYPASS_PHONE_NUMBER = '06 98 79 34 30, +33611223344';
  assert.equal(shouldBypassVerification('0698793430'), true);
  assert.equal(shouldBypassVerification('+33 6 98 79 34 30'), true);
  assert.equal(shouldBypassVerification('06.11.22.33.44'), true);
  assert.equal(shouldBypassVerification('0612345678'), false);
});

test('aucune dispense sans configuration', () => {
  delete process.env.BYPASS_PHONE_NUMBER;
  assert.equal(shouldBypassVerification('0698793430'), false);
});

test('normalisation et validation des numéros français', () => {
  assert.equal(normalizePhoneNumber('06 12 34 56 78'), '+33612345678');
  assert.equal(normalizePhoneNumber('0033612345678'), '+33612345678');
  assert.equal(isValidFrenchPhone('+33612345678'), true);
  assert.equal(isValidFrenchPhone('+3361234'), false);
});
