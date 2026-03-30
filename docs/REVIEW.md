# Code Review Log

## How to Run This Review

From the Claude Code CLI, run:

```bash
claude -p "Review the codebase for security, correctness, and code quality. \
Focus on src/auth/, src/config/, src/brand/, workers/, and tests/. \
Report findings grouped by severity (critical, important, coverage gaps) \
with file paths, line references, rationale, and suggested fixes. \
Append results to docs/REVIEW.md under a new dated section with the current HEAD SHA."
```

Or interactively inside a Claude Code session:

```
claude, could you help to review code in this repo?
```

---

## Review: 2026-03-29

- **Reviewed commit:** `9fbe3d9e10b94f429d2739d898dc97f7609eeadd`
- **Branch:** `step-04-access-middleware`
- **Scope:** `src/auth/`, `src/config/`, `src/brand/`, `workers/`, `tests/`
- **Reviewer:** Claude Code (sub-agent: code-reviewer)

### Critical

#### 1. SHA-256 is not a password hashing function — brute-force attacks are trivial

| | |
|---|---|
| **File** | `src/auth/password-utils.js` |
| **Lines** | 3–20 |
| **Severity** | Critical |

**Finding:** SHA-256 is a general-purpose cryptographic hash, not a key-derivation function. An attacker who obtains `AUTH_SHARED_PASSWORD_HASH` can brute-force it at billions of attempts/second on GPU hardware. There is no salt, no iteration cost, and no memory hardness.

**Rationale:** OWASP and NIST both recommend slow, salted KDFs for password storage. In the Cloudflare Workers runtime `bcrypt` is unavailable (native C dependency), but `crypto.subtle.deriveBits` supports PBKDF2 natively with zero external dependencies. NIST SP 800-132 recommends PBKDF2-SHA256 with >= 600,000 iterations.

**Suggested fix:** Replace `hashSharedPassword` with PBKDF2:

```js
const PBKDF2_ITERATIONS = 600_000;
const SALT = encodeUtf8('volunteer-platform-v1'); // better: random salt stored alongside hash

export async function hashSharedPassword(password) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw', encodeUtf8(password ?? ''), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: SALT, iterations: PBKDF2_ITERATIONS },
    keyMaterial, 256
  );
  return base64EncodeBytes(new Uint8Array(bits));
}
```

---

#### 2. `constantTimeEquals` leaks length via early return — timing side channel

| | |
|---|---|
| **File** | `src/auth/password-utils.js` |
| **Lines** | 5–14 |
| **Severity** | Critical |

**Finding:** The `if (a.length !== b.length) return false` exits immediately, leaking length information through response-time measurement. For fixed-output SHA-256 (always 44 base64 chars) the practical risk is low today, but the function is not actually constant-time and will silently break if reused with variable-length inputs or if the hash format changes.

**Rationale:** Constant-time comparison must process the same number of bytes regardless of input. The early exit is a textbook timing oracle.

**Suggested fix:**

```js
function constantTimeEquals(a, b) {
  const len = Math.max(a.length, b.length);
  let result = a.length ^ b.length; // non-zero if lengths differ
  for (let i = 0; i < len; i++) {
    result |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return result === 0;
}
```

---

#### 3. Unauthenticated `/health` endpoint leaks internal configuration details

| | |
|---|---|
| **File** | `src/auth/auth-worker-handler.js` |
| **Lines** | 21–58 |
| **Severity** | Critical |

**Finding:** The `/health` response includes `configKey`, `schemaVersion`, `auth.issuer`, `auth.audience`, and `secrets.error` with no authentication. The combination helps an attacker craft valid-looking JWTs (exact `iss`/`aud` values revealed), and `secrets.error` can expose environment variable names (e.g., `AUTH_SESSION_SECRET missing`).

**Rationale:** Health endpoints should distinguish between a "liveness" probe (public, returns 200/503 with no body) and a "readiness" probe (authenticated, returns detailed diagnostics). Exposing JWT issuer/audience values removes a layer of defense-in-depth.

**Suggested fix:** Return only HTTP status for unauthenticated callers. Gate the detailed payload behind Cloudflare Access or an internal auth header. Replace raw exception strings in `secrets.error` with a generic `"secrets misconfigured"` message.

---

#### 4. `tenantId` from request body is embedded in JWT without validation

| | |
|---|---|
| **File** | `src/auth/auth-worker-handler.js` |
| **Lines** | 114 |
| **Severity** | Critical |

**Finding:** The `tenantId` field from the POST body is placed directly into signed JWT claims with no type check and no validation against known tenants in the platform config. An attacker who knows the shared password can mint tokens for arbitrary tenant IDs, which downstream services will trust.

**Rationale:** Any claim embedded in a signed token becomes a trusted assertion. User-supplied values must be validated against the source of truth (here, `config.tenants`) before signing.

**Suggested fix:**

```js
const rawTenantId = payload?.tenantId ?? null;
if (rawTenantId !== null) {
  const knownIds = config.tenants.map(t => t.id);
  if (typeof rawTenantId !== 'string' || !knownIds.includes(rawTenantId)) {
    return jsonResponse({ error: 'Invalid tenantId' }, { status: 400 });
  }
}
```

---

### Important

#### 5. `platform-config.js` top-level `node:fs` import will crash Workers at bundle time

| | |
|---|---|
| **File** | `src/config/platform-config.js` |
| **Lines** | 1–4 |
| **Severity** | Important |

**Finding:** The module imports `node:fs/promises` and `node:path` at the top level. Even though the auth worker only calls `parsePlatformConfig` (which never touches `fs`), Wrangler will attempt to resolve these imports when bundling the worker and fail — `node:fs` is not available in the Workers runtime without `nodejs_compat`, and even then `fs.readFile` is unsupported.

**Rationale:** Tree-shaking does not reliably eliminate top-level imports with side effects. The safe pattern is to isolate I/O-dependent code into a separate module.

**Suggested fix:** Split into two files:
- `parse-platform-config.js` — pure validation/normalization, no I/O imports.
- `load-platform-config.node.js` — imports `fs`/`path`, wraps the loader.

The auth worker imports only the pure parser.

---

#### 6. Queue worker placeholder re-enqueues every message — infinite loop

| | |
|---|---|
| **File** | `workers/queues/index.ts` |
| **Lines** | 5–6 |
| **Severity** | Important |

**Finding:** The "no-op placeholder" calls `env.TASK_QUEUE.send(message.body)` before `message.ack()`, creating an infinite re-enqueue loop. Under load this causes unbounded queue growth and Cloudflare billing charges.

**Rationale:** A no-op consumer should acknowledge without producing. Re-enqueuing is the opposite of a no-op.

**Suggested fix:** Remove the `send` call — just `message.ack()`.

---

#### 7. 405 response missing required `Allow` header

| | |
|---|---|
| **File** | `src/auth/auth-worker-handler.js` |
| **Lines** | 70–72 |
| **Severity** | Important |

**Finding:** The 405 Method Not Allowed response does not include an `Allow` header listing permitted methods.

**Rationale:** RFC 9110 Section 15.5.6 requires this header. It is used by clients and API gateways for capability negotiation and is relevant for CORS preflight handling if the auth worker is called cross-origin.

**Suggested fix:**

```js
return jsonResponse({ error: 'Method not allowed' }, {
  status: 405,
  headers: { Allow: 'POST' }
});
```

---

#### 8. No guard on `ttlSeconds` in `createSessionToken`

| | |
|---|---|
| **File** | `src/auth/session-token.js` |
| **Lines** | 11–33 |
| **Severity** | Important |

**Finding:** If `ttlSeconds` is `0`, `undefined`, or negative, `expiresAt` will be `<= issuedAt`, producing an immediately-expired token. `parsePlatformConfig` validates `tokenTTLSeconds > 0` upstream, but `createSessionToken` is a standalone utility with no self-defense.

**Rationale:** Defense in depth — lower-level utilities should validate their own preconditions rather than relying on callers to enforce invariants.

**Suggested fix:**

```js
if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
  throw new Error('ttlSeconds must be a positive finite number');
}
```

---

### Test Coverage Gaps

#### 9. No test for `constantTimeEquals` with different-length inputs

| | |
|---|---|
| **File** | `tests/password-utils.test.js` |

**Gap:** No test exercising a candidate hash that is a prefix of the expected hash (or vice versa). The early-length-check behavior is correct but undocumented by tests — a refactor could introduce a regression silently.

---

#### 10. No test for `tenantId` in the shared-password request

| | |
|---|---|
| **File** | `tests/auth-worker-handler.test.js` |

**Gap:** No test confirming whether an unknown `tenantId` is accepted or rejected, and no test verifying the claim appears in the returned JWT. This is directly related to finding #4.

---

#### 11. No test decoding the JWT to verify `exp` matches `iat + ttl`

| | |
|---|---|
| **File** | `tests/session-token.test.js` |

**Gap:** The test checks the returned `expiresAt` number but does not decode the JWT payload to verify the `exp` field in the token body matches. A bug that signs the wrong expiry while returning the correct metadata would not be caught.

---

### Summary Table

| # | Severity | File | Issue | Status |
|---|----------|------|-------|--------|
| 1 | Critical | `password-utils.js` | SHA-256 instead of a KDF — brute-forceable | Open |
| 2 | Critical | `password-utils.js` | `constantTimeEquals` leaks length via early return | Open |
| 3 | Critical | `auth-worker-handler.js` | `/health` leaks issuer/audience/secret names | Open |
| 4 | Critical | `auth-worker-handler.js` | `tenantId` not validated before JWT embedding | Open |
| 5 | Important | `platform-config.js` | Top-level `node:fs` import breaks Workers bundle | Open |
| 6 | Important | `workers/queues/index.ts` | Placeholder re-enqueues every message (infinite loop) | Open |
| 7 | Important | `auth-worker-handler.js` | 405 response missing `Allow` header | Open |
| 8 | Important | `session-token.js` | No guard against zero/negative `ttlSeconds` | Open |
| 9 | Coverage | `tests/password-utils.test.js` | Missing different-length input test | Open |
| 10 | Coverage | `tests/auth-worker-handler.test.js` | Missing tenantId validation test | Open |
| 11 | Coverage | `tests/session-token.test.js` | Missing JWT payload decode test | Open |

### Step 4.3 Action Plan (logged 2026-03-29)

1. **Step 4.3.1 – JWT middleware hardening**  
   - Validate `tenantId` and role references against `config` before minting JWTs.  
   - Add `Allow: POST` header + richer error taxonomy (`400` config errors vs `500`).  
   - Expand handler/token tests to decode JWT payloads and cover missing-secret/method-guard cases.
2. **Step 4.3.2 – Shared password hashing upgrade**  
   - Swap SHA-256 for PBKDF2 via `crypto.subtle`, update `constantTimeEquals`, and document hashing policy.  
   - Extend `password-utils` tests with variable-length comparisons and regression vectors.
3. **Step 4.3.3 – Health endpoint + observability lockdown**  
   - Separate liveness vs diagnostics, redact issuer/audience/secrets, and script a harness check.  
   - Capture operational expectations in `docs/auth-access.md` and link the probe script.
