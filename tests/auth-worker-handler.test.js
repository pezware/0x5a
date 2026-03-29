import test from 'node:test';
import assert from 'node:assert/strict';

import { handleAuthRequest } from '../src/auth/auth-worker-handler.js';
import { DEFAULT_PLATFORM_CONFIG_KV_KEY } from '../src/auth/auth-worker-context.js';

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
    audience: 'audience',
    sharedPasswordLabel: 'auth-secret',
    sharedPasswordHash: 'hash',
    sharedPasswordRoles: ['Volunteer'],
    tokenTTLSeconds: 3600
  }
};

const sharedPasswordHash = 'zVd/4lYev/I1BdsLsAYwDHzey9RrwOA8RJr6+sosJb8=';

function createEnv(overrides = {}) {
  return {
    CONFIG_KV: {
      async get(key) {
        if (key === DEFAULT_PLATFORM_CONFIG_KV_KEY) {
          return exampleConfig;
        }
        return null;
      }
    },
    AUTH_SHARED_PASSWORD_HASH: sharedPasswordHash,
    AUTH_SESSION_SECRET: 'session',
    AUTH_VERSION: 'test',
    PLATFORM_CONFIG_KV_KEY: DEFAULT_PLATFORM_CONFIG_KV_KEY,
    ...overrides
  };
}

function createJsonRequest(path, init) {
  return new Request(`https://example.com${path}`, {
    headers: { 'content-type': 'application/json' },
    ...init
  });
}

async function json(response) {
  const text = await response.text();
  return JSON.parse(text);
}

test('handleAuthRequest returns health payload when config + secrets available', async () => {
  const response = await handleAuthRequest(new Request('https://example.com/health'), createEnv());
  assert.equal(response.status, 200);
  const body = await json(response);
  assert.equal(body.status, 'ok');
  assert.equal(body.configKey, DEFAULT_PLATFORM_CONFIG_KV_KEY);
});

test('handleAuthRequest reports degraded health when secrets missing', async () => {
  const env = createEnv({ AUTH_SESSION_SECRET: '' });
  const response = await handleAuthRequest(new Request('https://example.com/health'), env);
  assert.equal(response.status, 503);
  const body = await json(response);
  assert.equal(body.status, 'degraded');
  assert.match(body.secrets.error, /AUTH_SESSION_SECRET/);
});

test('handleAuthRequest reports config errors', async () => {
  const env = createEnv({
    CONFIG_KV: {
      async get() {
        return null;
      }
    }
  });
  const response = await handleAuthRequest(new Request('https://example.com/health'), env);
  assert.equal(response.status, 503);
  const body = await json(response);
  assert.equal(body.status, 'error');
  assert.match(body.error, /Platform config missing/);
});

test('handleAuthRequest exposes version metadata', async () => {
  const response = await handleAuthRequest(new Request('https://example.com/version'), createEnv());
  assert.equal(response.status, 200);
  const body = await json(response);
  assert.equal(body.version, 'test');
});

test('handleAuthRequest returns 404 for unknown routes', async () => {
  const response = await handleAuthRequest(new Request('https://example.com/unknown'), createEnv());
  assert.equal(response.status, 404);
});

test('handleAuthRequest issues shared password session tokens', async () => {
  const response = await handleAuthRequest(
    createJsonRequest('/sessions/shared-password', { method: 'POST', body: JSON.stringify({ password: 'demo-secret' }) }),
    createEnv()
  );
  const body = await json(response);
  assert.equal(response.status, 200, `response status ${response.status}: ${JSON.stringify(body)}`);
  assert.ok(body.token);
  assert.equal(body.roles.includes('Volunteer'), true);
});

test('handleAuthRequest rejects invalid shared password', async () => {
  const response = await handleAuthRequest(
    createJsonRequest('/sessions/shared-password', { method: 'POST', body: JSON.stringify({ password: 'wrong' }) }),
    createEnv()
  );
  assert.equal(response.status, 401);
});

test('handleAuthRequest validates request body', async () => {
  const response = await handleAuthRequest(
    createJsonRequest('/sessions/shared-password', { method: 'POST', body: JSON.stringify({}) }),
    createEnv()
  );
  assert.equal(response.status, 400);
});

test('handleAuthRequest reports secret/config issues for shared password endpoint', async () => {
  const response = await handleAuthRequest(
    createJsonRequest('/sessions/shared-password', { method: 'POST', body: JSON.stringify({ password: 'demo-secret' }) }),
    createEnv({ AUTH_SESSION_SECRET: '' })
  );
  assert.equal(response.status, 503);
});
