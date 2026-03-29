import test from 'node:test';
import assert from 'node:assert/strict';

import {
  loadPlatformConfigFromEnv,
  collectSecretStatus,
  resolveVersionMetadata,
  resolveAuthSecrets,
  DEFAULT_PLATFORM_CONFIG_KV_KEY
} from '../src/auth/auth-worker-context.js';

const exampleConfig = {
  schemaVersion: 1,
  branding: {
    name: 'Demo',
    shortName: 'Demo',
    primaryColor: '#000',
    secondaryColor: '#fff'
  },
  modules: {},
  tenants: [],
  integrations: {},
  roles: { Admin: ['*'], Volunteer: ['guests.read'] },
  auth: {
    issuer: 'issuer',
    audience: 'aud',
    sharedPasswordLabel: 'label',
    sharedPasswordHash: 'hash',
    tokenTTLSeconds: 3600
  }
};

function createKv(initial = {}) {
  return {
    storage: { ...initial },
    async get(key) {
      return this.storage[key] ?? null;
    },
    async put(key, value) {
      this.storage[key] = value;
    }
  };
}

test('loadPlatformConfigFromEnv reads JSON from CONFIG_KV', async () => {
  const env = {
    CONFIG_KV: createKv({ [DEFAULT_PLATFORM_CONFIG_KV_KEY]: exampleConfig })
  };
  const { config, key } = await loadPlatformConfigFromEnv(env);
  assert.equal(key, DEFAULT_PLATFORM_CONFIG_KV_KEY);
  assert.equal(config.auth.issuer, 'issuer');
});

test('loadPlatformConfigFromEnv throws when missing CONFIG_KV binding', async () => {
  await assert.rejects(() => loadPlatformConfigFromEnv({}), /CONFIG_KV binding is required/);
});

test('loadPlatformConfigFromEnv throws when key missing', async () => {
  const env = { CONFIG_KV: createKv({}) };
  await assert.rejects(() => loadPlatformConfigFromEnv(env), /Platform config missing/);
});

test('loadPlatformConfigFromEnv surfaces parse errors', async () => {
  const env = { CONFIG_KV: createKv({ [DEFAULT_PLATFORM_CONFIG_KV_KEY]: { schemaVersion: 1 } }) };
  await assert.rejects(() => loadPlatformConfigFromEnv(env), /branding is missing/);
});

test('collectSecretStatus reports presence of secrets', () => {
  const status = collectSecretStatus({ AUTH_SHARED_PASSWORD_HASH: 'hash', AUTH_SESSION_SECRET: '' });
  assert.equal(status.hasSharedPasswordHash, true);
  assert.equal(status.hasSessionSecret, false);
});

test('resolveAuthSecrets throws when secrets missing', () => {
  assert.throws(() => resolveAuthSecrets({ AUTH_SESSION_SECRET: 'abc' }), /AUTH_SHARED_PASSWORD_HASH/);
  assert.throws(() => resolveAuthSecrets({ AUTH_SHARED_PASSWORD_HASH: 'hash' }), /AUTH_SESSION_SECRET/);
  const secrets = resolveAuthSecrets({ AUTH_SHARED_PASSWORD_HASH: 'hash', AUTH_SESSION_SECRET: 'session' });
  assert.equal(secrets.sharedPasswordHash, 'hash');
  assert.equal(secrets.sessionSecret, 'session');
});

test('resolveVersionMetadata falls back to defaults', () => {
  const meta = resolveVersionMetadata({});
  assert.equal(meta.version, 'dev');
  assert.equal(meta.configKey, DEFAULT_PLATFORM_CONFIG_KV_KEY);
});
