import { handleAuthRequest } from '../../src/auth/auth-worker-handler.js';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return handleAuthRequest(request, env);
  }
};

type Env = {
  CONFIG_KV: KVNamespace;
  AUTH_SHARED_PASSWORD_HASH?: string;
  AUTH_SESSION_SECRET?: string;
  AUTH_VERSION?: string;
  AUTH_COMMIT?: string;
  PLATFORM_CONFIG_KV_KEY?: string;
};
