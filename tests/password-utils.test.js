import test from 'node:test';
import assert from 'node:assert/strict';

import { hashSharedPassword, verifySharedPassword } from '../src/auth/password-utils.js';

test('hashSharedPassword produces deterministic base64 hash', async () => {
  const hash = await hashSharedPassword('example-password');
  const hashAgain = await hashSharedPassword('example-password');
  assert.equal(hash, hashAgain);
});

test('verifySharedPassword compares hashes securely', async () => {
  const hash = await hashSharedPassword('example-password');
  const result = await verifySharedPassword('example-password', hash);
  const resultMismatch = await verifySharedPassword('wrong-password', hash);
  assert.equal(result, true);
  assert.equal(resultMismatch, false);
});
