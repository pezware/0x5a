import { parsePlatformConfig } from '../config/platform-config.js';

export const DEFAULT_PLATFORM_CONFIG_KV_KEY = 'platform-config';

function ensureKvBinding(env) {
  if (!env || typeof env.CONFIG_KV?.get !== 'function') {
    throw new Error('CONFIG_KV binding is required for the Auth Worker');
  }
}

export async function loadPlatformConfigFromEnv(env, { kvKey } = {}) {
  ensureKvBinding(env);
  const key = kvKey ?? env.PLATFORM_CONFIG_KV_KEY ?? DEFAULT_PLATFORM_CONFIG_KV_KEY;
  const payload = await env.CONFIG_KV.get(key, 'json');
  if (!payload) {
    throw new Error(`Platform config missing in CONFIG_KV at key '${key}'`);
  }
  const config = parsePlatformConfig(payload);
  return { config, key };
}

export function collectSecretStatus(env) {
  const sharedPasswordHash = env?.AUTH_SHARED_PASSWORD_HASH ?? '';
  const sessionSecret = env?.AUTH_SESSION_SECRET ?? '';
  return {
    hasSharedPasswordHash: Boolean(sharedPasswordHash),
    hasSessionSecret: Boolean(sessionSecret)
  };
}

export function resolveVersionMetadata(env) {
  return {
    version: env?.AUTH_VERSION ?? 'dev',
    commit: env?.AUTH_COMMIT ?? '',
    configKey: env?.PLATFORM_CONFIG_KV_KEY ?? DEFAULT_PLATFORM_CONFIG_KV_KEY
  };
}

export function resolveAuthSecrets(env) {
  const sharedPasswordHash = env?.AUTH_SHARED_PASSWORD_HASH ?? '';
  const sessionSecret = env?.AUTH_SESSION_SECRET ?? '';
  if (!sharedPasswordHash) {
    throw new Error('AUTH_SHARED_PASSWORD_HASH secret missing');
  }
  if (!sessionSecret) {
    throw new Error('AUTH_SESSION_SECRET secret missing');
  }
  return { sharedPasswordHash, sessionSecret };
}
