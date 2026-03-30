import test from 'node:test';
import assert from 'node:assert/strict';

import { hashSharedPassword, verifySharedPassword, constantTimeEquals } from '../src/auth/password-utils.js';

test('hashSharedPassword produces deterministic base64 hash', async () => {
  const hash = await hashSharedPassword('example-password');
  const hashAgain = await hashSharedPassword('example-password');
  assert.equal(hash, hashAgain);
  assert.equal(hash, 'Y6Nf+3OUcuuMIu+0qrpjhLZRbWTOJwLfftI0sBgp3mc=');
});

test('verifySharedPassword compares hashes securely', async () => {
  const hash = await hashSharedPassword('example-password');
  const result = await verifySharedPassword('example-password', hash);
  const resultMismatch = await verifySharedPassword('wrong-password', hash);
  assert.equal(result, true);
  assert.equal(resultMismatch, false);
});

test('constantTimeEquals handles strings of different lengths', () => {
  assert.equal(constantTimeEquals('abc', 'abcd'), false);
  assert.equal(constantTimeEquals('abcd', 'abc'), false);
  assert.equal(constantTimeEquals('', ''), true);
});
