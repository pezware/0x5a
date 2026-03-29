# Auth & Access Runtime

Step 4 introduces the Workers-based authentication surface. This document tracks the runtime helpers that are implemented before the Workers endpoints go live.

## Role-Based Access Policy

- Platform roles come from `config/platform*.json`. Each role maps to an array of permission strings; the `Admin` role can keep `"*"` to denote superuser access.
- `src/auth/access-policy.js` exports `createAccessPolicy(config)`, which normalizes the role matrix and exposes:
  - `getRolePermissions(roleName)` — returns an array for that specific role or throws when the role is unknown.
  - `getPermissionsForRoles(roleNames)` — returns a `Set` of aggregated permissions, quietly ignoring unknown roles so Access claims can include legacy values without tripping errors.
  - `hasPermission(roleNames, permission)` — returns `true` when any provided role grants the permission or carries the wildcard.
  - `assertPermission(roleNames, permission)` — throws an error with contextual details so callers can fail fast inside Workers or UI loaders.
- Usage pattern inside Workers:

```js
import { loadPlatformConfig } from '../../src/config/platform-config.js';
import { createAccessPolicy } from '../../src/auth/access-policy.js';

const config = await loadPlatformConfig();
const accessPolicy = createAccessPolicy(config);

function requirePermission(userRoles, permission) {
  accessPolicy.assertPermission(userRoles, permission);
  // continue handling the request
}
```

- Permissions are expressed as strings (`checkout.read`, `campaigns.write`, etc.) so Workers/UI routes can remain agnostic to domain-specific constants. `getPermissionsForRoles` always yields a `Set`, which you can convert to arrays if deterministic ordering is required.
- Subsequent Step 4 work will plug this helper into the Auth Worker to evaluate Access JWT claims + shared-password sessions. Keeping the helper in `src/` plus unit tests allows the Workers bundle and UI layers to share identical logic.

## Step 4 Breakdown

- **Step 4.1 – Worker Auth Inputs & Secrets**  
  - Load platform config + Workers secrets inside the Auth Worker.  
  - Expose `/health` + `/version` endpoints so config drift is detectable early.  
  - Bindings:  
    - `CONFIG_KV` (existing) stores `platform-config`.  
    - `PLATFORM_CONFIG_KV_KEY` env var selects the KV key (default `platform-config`).  
    - Wrangler secrets `AUTH_SHARED_PASSWORD_HASH` and `AUTH_SESSION_SECRET` must be present; `/health` reports whether they’re loaded.  
    - Optional vars `AUTH_VERSION` / `AUTH_COMMIT` feed the `/version` response.  
  - Deployment: use `wrangler.auth.toml` (Auth worker entrypoint) while retaining `wrangler.toml` for the API worker.
  - Tests: config loader stubs, secret-binding guards (`tests/auth-worker-context.test.js`).

- **Step 4.2 – Shared Password Session Issuer**  
  - POST endpoint that validates the shared password hash, issues signed session tokens, and annotates them with role claims derived from `createAccessPolicy`.  
  - Tests: crypto verification, TTL enforcement, error handling for lockouts.

- **Step 4.3 – Access JWT Validation Middleware**  
  - Utilities that accept Cloudflare Access JWTs, validate issuer/audience/expiry, and translate Access groups → platform roles.  
  - Tests: mocked Access tokens, mixed role sources (Access + config overrides).

- **Step 4.4 – Worker Route Guard Harness**  
  - Shared middleware integrating module toggles + permission checks before business handlers run.  
  - Tests: Miniflare-driven worker routes proving `403` vs `200` outcomes for different role sets.

- **Step 4.5 – Documentation & STATUS Closeout**  
  - Finalize docs with real Worker wiring instructions, update `STATUS.md`, and ensure harness commands cover auth flows end-to-end.
