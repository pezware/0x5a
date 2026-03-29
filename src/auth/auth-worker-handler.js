import {
  collectSecretStatus,
  loadPlatformConfigFromEnv,
  resolveAuthSecrets,
  resolveVersionMetadata
} from './auth-worker-context.js';

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

export async function handleAuthRequest(request, env) {
  const url = new URL(request.url);
  if (url.pathname === '/health') {
    return handleHealth(env);
  }
  if (url.pathname === '/version') {
    return handleVersion(env);
  }
  return new Response('Not Found', { status: 404 });
}
