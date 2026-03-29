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
  - POST `/sessions/shared-password` validates the shared password against the Wrangler secret, issues HS256 session tokens, and annotates them with roles from `auth.sharedPasswordRoles` (after verifying those roles exist in the access policy).  
  - Secrets:  
    - `AUTH_SHARED_PASSWORD_HASH` — base64-encoded SHA-256 digest of the shared password (generate via `node -e "crypto.subtle.digest('SHA-256', new TextEncoder().encode(process.argv[1])).then(b => console.log(Buffer.from(b).toString('base64')))" 'my-password'`).  
    - `AUTH_SESSION_SECRET` — signing secret for JWTs.  
  - Request body: `{"password":"<plain text>", "tenantId":"optional"}`.  
  - Responses: `200` with `{ token, expiresAt, roles, issuer, audience }`, `400` for malformed bodies, `401` for invalid credentials, `503` when secrets/config are missing.  
  - Tests: crypto verification, handler coverage (`tests/auth-worker-handler.test.js`), session token helper (`tests/session-token.test.js`).

- **Step 4.3 – Access JWT Validation Middleware**  
  - Utilities that accept Cloudflare Access JWTs, validate issuer/audience/expiry, and translate Access groups → platform roles.  
  - Tests: mocked Access tokens, mixed role sources (Access + config overrides).

- **Step 4.4 – Worker Route Guard Harness**  
  - Shared middleware integrating module toggles + permission checks before business handlers run.  
  - Tests: Miniflare-driven worker routes proving `403` vs `200` outcomes for different role sets.

- **Step 4.5 – Documentation & STATUS Closeout**  
  - Finalize docs with real Worker wiring instructions, update `STATUS.md`, and ensure harness commands cover auth flows end-to-end.

## Shared Password Session Endpoint

- **URL:** `POST /sessions/shared-password` on the Auth Worker defined in `wrangler.auth.toml`.
- **Purpose:** exchange the shared staff password for a signed session token that embeds the configured roles.
- **Request Body:**
  ```json
  {
    "password": "demo-secret",
    "tenantId": "optional-tenant"
  }
  ```
- **Response (200):**
  ```json
  {
    "token": "<HS256 JWT>",
    "expiresAt": 1774819127,
    "roles": ["Volunteer"],
    "issuer": "volunteer-platform",
    "audience": "volunteer-staff"
  }
  ```
- **Failure States:**  
  - `400` – invalid JSON or missing `password`.  
  - `401` – password mismatch.  
  - `503` – config/secret unavailable (mirrors `/health`).  
- **Implementation Notes:**  
  - Password hashes live in Wrangler secrets (`AUTH_SHARED_PASSWORD_HASH`). The JSON config retains the label and schema defaults but no longer stores sensitive material.  
  - JWTs use HS256 via Web Crypto; see `src/auth/session-token.js`. The helper also enforces `auth.tokenTTLSeconds`.
