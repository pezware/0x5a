import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parsePlatformConfig } from '../src/config/platform-config.js';
import { createAccessPolicy } from '../src/auth/access-policy.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const exampleConfigPath = path.resolve(__dirname, '../config/platform.example.json');
const parsedConfig = parsePlatformConfig(JSON.parse(fs.readFileSync(exampleConfigPath, 'utf8')));

test('getRolePermissions exposes explicit permissions from config', () => {
  const accessPolicy = createAccessPolicy(parsedConfig);
  const cashierPermissions = accessPolicy.getRolePermissions('Cashier');
  assert.deepEqual(new Set(cashierPermissions), new Set(['checkout.read', 'checkout.write', 'payments.write']));
});

test('hasPermission respects wildcard Admin role', () => {
  const accessPolicy = createAccessPolicy(parsedConfig);
  assert.equal(accessPolicy.hasPermission('Admin', 'any.permission'), true);
});

test('hasPermission aggregates multiple roles', () => {
  const accessPolicy = createAccessPolicy(parsedConfig);
  const canReadGuests = accessPolicy.hasPermission(['Volunteer', 'Cashier'], 'guests.read');
  const canWriteContacts = accessPolicy.hasPermission(['Volunteer', 'Cashier'], 'contacts.write');
  assert.equal(canReadGuests, true);
  assert.equal(canWriteContacts, false);
});

test('assertPermission throws with contextual message', () => {
  const accessPolicy = createAccessPolicy(parsedConfig);
  assert.throws(
    () => accessPolicy.assertPermission('Volunteer', 'payments.write'),
    /Access denied/
  );
});

test('getPermissionsForRoles returns a Set and ignores unknown roles', () => {
  const accessPolicy = createAccessPolicy(parsedConfig);
  const permissions = accessPolicy.getPermissionsForRoles(['Volunteer', 'UnknownRole', undefined]);
  assert.equal(permissions instanceof Set, true);
  assert.equal(permissions.has('guests.read'), true);
  assert.equal(permissions.has('UnknownRole'), false);
});

test('hasPermission falls back to false when no roles are provided', () => {
  const accessPolicy = createAccessPolicy(parsedConfig);
  assert.equal(accessPolicy.hasPermission(undefined, 'guests.read'), false);
});

test('createAccessPolicy validates role definitions', () => {
  const malformedConfig = {
    ...parsedConfig,
    roles: {
      ...parsedConfig.roles,
      BrokenRole: 'not-an-array'
    }
  };
  assert.throws(() => createAccessPolicy(malformedConfig), /role BrokenRole must be an array/);
});
