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

## Next Steps

1. Wire the Auth Worker to validate shared-password submissions using the config-driven issuer/audience metadata.
2. Attach `createAccessPolicy` to Worker middleware so every route checks feature/module state plus role permissions before executing.
3. Extend the helper with module toggle awareness once `modules.*` dictate UI mount points (planned later in Step 4).
