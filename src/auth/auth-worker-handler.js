import {
  collectSecretStatus,
  loadPlatformConfigFromEnv,
  resolveAuthSecrets,
  resolveVersionMetadata
} from './auth-worker-context.js';
import { createAccessPolicy } from './access-policy.js';
import { verifySharedPassword } from './password-utils.js';
import { createSessionToken } from './session-token.js';

function jsonResponse(payload, init = {}) {
  return new Response(JSON.stringify(payload, null, 2), {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init.headers ?? {})
    }
  });
}

async function handleHealth(env) {
  let configPayload;
  try {
    configPayload = await loadPlatformConfigFromEnv(env);
  } catch (error) {
    return jsonResponse(
      {
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
        secrets: collectSecretStatus(env)
      },
      { status: 503 }
    );
  }
  let secretError = null;
  try {
    resolveAuthSecrets(env);
  } catch (error) {
    secretError = error instanceof Error ? error : new Error(String(error));
  }
  const secrets = collectSecretStatus(env);
  return jsonResponse(
    {
      status: secretError ? 'degraded' : 'ok',
      configKey: configPayload.key,
      schemaVersion: configPayload.config.schemaVersion,
      auth: {
        issuer: configPayload.config.auth.issuer,
        audience: configPayload.config.auth.audience
      },
      secrets: {
        ...secrets,
        error: secretError?.message ?? null
      }
    },
    secretError ? { status: 503 } : undefined
  );
}

function handleVersion(env) {
  const meta = resolveVersionMetadata(env);
  return jsonResponse({
    version: meta.version,
    commit: meta.commit,
    configKey: meta.configKey
  });
}

async function handleSharedPasswordSession(request, env) {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405, headers: { Allow: 'POST' } });
  }
  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const password = payload?.password;
  if (typeof password !== 'string' || password.length === 0) {
    return jsonResponse({ error: 'password is required' }, { status: 400 });
  }
  let configPayload;
  try {
    configPayload = await loadPlatformConfigFromEnv(env);
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : String(error) }, { status: 503 });
  }
  let secrets;
  try {
    secrets = resolveAuthSecrets(env);
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : String(error) }, { status: 503 });
  }
  const config = configPayload.config;
  const passwordValid = await verifySharedPassword(password, secrets.sharedPasswordHash);
  if (!passwordValid) {
    return jsonResponse({ error: 'Invalid credentials' }, { status: 401 });
  }
  const configuredRoles = config.auth.sharedPasswordRoles ?? ['Volunteer'];
  const accessPolicy = createAccessPolicy(config);
  const roles = configuredRoles.filter((role) => {
    try {
      accessPolicy.getRolePermissions(role);
      return true;
    } catch {
      return false;
    }
  });
  if (roles.length === 0) {
    return jsonResponse({ error: 'No valid roles configured for shared password access' }, { status: 503 });
  }
  let tenantId = null;
  const rawTenantId = payload?.tenantId ?? null;
  if (rawTenantId !== null && rawTenantId !== undefined) {
    if (typeof rawTenantId !== 'string' || rawTenantId.trim().length === 0) {
      return jsonResponse({ error: 'tenantId must be a non-empty string' }, { status: 400 });
    }
    const knownTenantIds = (config.tenants ?? []).map((tenant) => tenant.id);
    if (!knownTenantIds.includes(rawTenantId)) {
      return jsonResponse({ error: 'Unknown tenantId' }, { status: 400 });
    }
    tenantId = rawTenantId;
  }
  const session = await createSessionToken(
    { roles, tenantId },
    {
      secret: secrets.sessionSecret,
      issuer: config.auth.issuer,
      audience: config.auth.audience,
      ttlSeconds: config.auth.tokenTTLSeconds
    }
  );
  return jsonResponse({
    token: session.token,
    expiresAt: session.expiresAt,
    roles,
    issuer: config.auth.issuer,
    audience: config.auth.audience
  });
}

export async function handleAuthRequest(request, env) {
  const url = new URL(request.url);
  if (url.pathname === '/health') {
    return handleHealth(env);
  }
  if (url.pathname === '/version') {
    return handleVersion(env);
  }
  if (url.pathname === '/sessions/shared-password') {
    return handleSharedPasswordSession(request, env);
  }
  return new Response('Not Found', { status: 404 });
}
