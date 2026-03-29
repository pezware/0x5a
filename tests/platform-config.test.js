import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parsePlatformConfig, loadPlatformConfig, defaults } from '../src/config/platform-config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const exampleConfigPath = path.resolve(__dirname, '../config/platform.example.json');
const exampleConfig = JSON.parse(fs.readFileSync(exampleConfigPath, 'utf8'));

function createMinimalConfig(overrides = {}) {
  return {
    schemaVersion: 1,
    branding: {
      name: 'Demo',
      shortName: 'Demo',
      primaryColor: '#000000',
      secondaryColor: '#FFFFFF'
    },
    modules: {},
    tenants: [],
    integrations: {},
    roles: { Admin: ['*'] },
    ...overrides
  };
}

test('parsePlatformConfig keeps branding details', () => {
  const parsed = parsePlatformConfig(exampleConfig);
  assert.equal(parsed.branding.name, 'Open Volunteer Platform');
  assert.equal(parsed.modules.auction.enableBuyNow, true);
  assert.equal(parsed.tenants[0].id, 'default');
});

test('parsePlatformConfig applies module defaults when missing', () => {
  const config = createMinimalConfig({ branding: exampleConfig.branding });
  const parsed = parsePlatformConfig(config);
  assert.equal(parsed.modules.auction.enabled, false);
  assert.deepEqual(parsed.roles.Admin, ['*']);
});

test('loadPlatformConfig falls back to example file', async () => {
  const parsed = await loadPlatformConfig({ configPath: './config/does-not-exist.json', fallbackPath: defaults.exampleConfigPath });
  assert.equal(parsed.branding.shortName, 'VolunteerOps');
});

test('tenants inherit defaults and override selectively', () => {
  const config = createMinimalConfig({
    branding: exampleConfig.branding,
    tenants: [
      {
        id: 'tenant-a',
        brandingOverrides: { primaryColor: '#222222', darkModeDefault: true }
      }
    ]
  });
  const parsed = parsePlatformConfig(config);
  assert.equal(parsed.tenants[0].brandingOverrides.primaryColor, '#222222');
  assert.equal(parsed.tenants[0].modules.auction.enabled, false);
});

test('rejects invalid schemaVersion values', () => {
  const config = createMinimalConfig({ branding: exampleConfig.branding, schemaVersion: 'abc' });
  assert.throws(() => parsePlatformConfig(config), /schemaVersion must be a positive integer/);
});

test('rejects malformed module overrides', () => {
  const config = createMinimalConfig({
    branding: exampleConfig.branding,
    modules: {
      auction: []
    }
  });
  assert.throws(() => parsePlatformConfig(config), /module 'auction'/);
});

test('rejects malformed integrations', () => {
  const config = createMinimalConfig({
    branding: exampleConfig.branding,
    integrations: 'invalid'
  });
  assert.throws(() => parsePlatformConfig(config), /integrations must be an object/);
});

test('rejects unsupported schemaVersion', () => {
  const config = createMinimalConfig({ branding: exampleConfig.branding, schemaVersion: 99 });
  assert.throws(() => parsePlatformConfig(config), /schemaVersion 99 is not supported/);
});

test('rejects malformed branding overrides', () => {
  const config = createMinimalConfig({
    branding: exampleConfig.branding,
    tenants: [{ id: 'tenant-a', brandingOverrides: 'fake' }]
  });
  assert.throws(() => parsePlatformConfig(config), /brandingOverrides for tenant tenant-a must be an object/);
});
