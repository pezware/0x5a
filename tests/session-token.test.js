import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';

import { createSessionToken } from '../src/auth/session-token.js';

function decodeJwtPayload(token) {
  const [, payload] = token.split('.');
  const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (normalized.length % 4)) % 4;
  const padded = normalized + '='.repeat(padLength);
  return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
}

test('createSessionToken produces deterministic JWT with fixed clock', async () => {
  const { token, expiresAt } = await createSessionToken(
    { roles: ['Volunteer'] },
    {
      secret: 'super-secret',
      issuer: 'demo-issuer',
      audience: 'demo-audience',
      ttlSeconds: 3600
    },
    { now: 1_700_000_000_000 }
  );
  assert.equal(expiresAt, 1_700_000_000_000 / 1000 + 3600);
  const parts = token.split('.');
  assert.equal(parts.length, 3);
});

test('createSessionToken embeds claims + exp correctly', async () => {
  const now = 1_700_000_000_000;
  const { token, expiresAt } = await createSessionToken(
    { roles: ['Volunteer'], tenantId: 'default' },
    {
      secret: 'super-secret',
      issuer: 'demo-issuer',
      audience: 'demo-audience',
      ttlSeconds: 600
    },
    { now }
  );
  const payload = decodeJwtPayload(token);
  assert.equal(payload.iss, 'demo-issuer');
  assert.equal(payload.aud, 'demo-audience');
  assert.equal(payload.roles[0], 'Volunteer');
  assert.equal(payload.tenantId, 'default');
  assert.equal(payload.iat, Math.floor(now / 1000));
  assert.equal(payload.exp, payload.iat + 600);
  assert.equal(expiresAt, payload.exp);
});

test('createSessionToken enforces positive ttlSeconds', async () => {
  await assert.rejects(
    () =>
      createSessionToken(
        { roles: [] },
        { secret: 'secret', issuer: 'iss', audience: 'aud', ttlSeconds: 0 },
        { now: 0 }
      ),
    /ttlSeconds must be a positive finite number/
  );
});

test('createSessionToken produces different signatures per secret', async () => {
  const baseClaims = { roles: ['Volunteer'] };
  const options = { now: 1_700_000_000_000 };
  const first = await createSessionToken(baseClaims, {
    secret: 'secret-a',
    issuer: 'issuer',
    audience: 'audience',
    ttlSeconds: 300
  }, options);
  const second = await createSessionToken(baseClaims, {
    secret: 'secret-b',
    issuer: 'issuer',
    audience: 'audience',
    ttlSeconds: 300
  }, options);
  assert.notEqual(first.token, second.token);
});
