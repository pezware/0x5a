import test from 'node:test';
import assert from 'node:assert/strict';

import { createSessionToken } from '../src/auth/session-token.js';

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
