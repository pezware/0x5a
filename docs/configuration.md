# Platform Configuration Guide

The rewrite treats configuration as code. The repository ships a canonical example at `config/platform.example.json`. Copy it to `config/platform.json`, keep `schemaVersion` as a positive integer that matches the runtime you deploy (currently only `1` is supported), and edit the fields below for each environment.

## Required Sections

| Section | Purpose |
| --- | --- |
| `schemaVersion` | Bump when config structure changes so the loader can validate migrations. |
| `branding` | Default name, short name, colors, logo URL, and `darkModeDefault`. |
| `modules` | Enable/disable domains (auction, volunteer, campaigns, donations, events, contacts) and their fine-grained settings. |
| `tenants` | Optional overrides per tenant (locale, time zone, module tweaks, branding overrides). |
| `integrations` | Non-secret metadata for email, payments, storage, and analytics integrations. Secrets live in environment bindings. |
| `auth` | Shared-password/token defaults: issuer/audience strings, password label, hashed secret, and token TTL. |
| `roles` | Map role names to permission strings; the UI and Workers will enforce these permissions. |

## Loader + Runtime Helpers

- `src/config/platform-config.js` provides `loadPlatformConfig()` and `parsePlatformConfig()` functions that normalize and validate the JSON file. The loader automatically falls back to the example file if a real config is missing, which keeps local development frictionless.
- `src/brand/branding-runtime.js` exposes `createBrandingRuntime()` for UI layers. It merges tenant overrides and exposes helpers for computing class names or color tokens without needing a UI framework yet.
- The new `auth` block captures brandless defaults for issuer/audience strings, which shared password label to retrieve from Workers Secrets, and how long staff tokens should remain valid. Only hashed values go in the JSON; plaintext secrets stay in Wrangler secrets or Cloudflare Access policies.

## Testing

`node --test` executes the suites in `tests/` to ensure:
- Example config parses without warnings.
- Defaults apply when modules or tenants omit fields.
- Branding runtime switches themes when tenants change.
- Invalid schema versions, module overrides, or integration blocks fail fast.

CI (once wired) should run `node --test` on every change touching `config/`, `src/config`, or `src/brand` to maintain confidence in the configuration layer.
