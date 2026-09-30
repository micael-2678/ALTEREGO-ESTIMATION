import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adminConfigProblems, getJwtSecret } from '../lib/api-helpers.js';

function withEnv(env, fn) {
  const saved = {};
  for (const key of Object.keys(env)) {
    saved[key] = process.env[key];
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key];
  }
  try { return fn(); } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('configuration admin complète : aucun problème', () => {
  withEnv({ ADMIN_USERNAME: 'admin', ADMIN_PASSWORD: 'x', JWT_SECRET: 'a'.repeat(32) }, () => {
    assert.deepEqual(adminConfigProblems(), []);
    assert.equal(getJwtSecret(), 'a'.repeat(32));
  });
});

test('chaque réglage manquant ou refusé est nommé, sans révéler de valeur', () => {
  withEnv({ ADMIN_USERNAME: undefined, ADMIN_PASSWORD: 'x', JWT_SECRET: 'court' }, () => {
    const problems = adminConfigProblems();
    assert.deepEqual(problems, ['ADMIN_USERNAME absent', 'JWT_SECRET trop court (5 caractères, 16 minimum)']);
  });
  withEnv({ ADMIN_USERNAME: 'a', ADMIN_PASSWORD: undefined, JWT_SECRET: 'votre-secret-jwt-minimum-32-caracteres-aleatoires-securises' }, () => {
    const problems = adminConfigProblems();
    assert.equal(problems[0], 'ADMIN_PASSWORD absent');
    assert.match(problems[1], /valeur d'exemple publiée/);
    assert.equal(getJwtSecret(), null);
  });
  withEnv({ ADMIN_USERNAME: 'a', ADMIN_PASSWORD: 'b', JWT_SECRET: undefined }, () => {
    assert.deepEqual(adminConfigProblems(), ['JWT_SECRET absent']);
  });
});
