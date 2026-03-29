# STATUS.md

Tiny-step tracker for the Cloudflare rewrite. Update this file every time you finish a checklist item: include the completion date, key tests, and reviewer notes. Follow the loop documented in `AGENT.md` / `CLAUDE.md` (review architecture → tiny change → tests → sub-agent review → status update).

## Checklist

- [x] **Step 1 – Baseline Documentation Package**  
  - Scope: produce `docs/cloudflare-rewrite-blueprint.md`, remove legacy naming, outline migration plan.  
  - Tests: docs lint/manual review (no code).  
  - Reviewer: Mencius (sub-agent, 2026-03-29) — flagged follow-up edits; resolved in same session.  
  - Completed: 2026-03-29.

- [x] **Step 2 – Introduce Brandless Config Artifacts**  
  - Scope: add `config/platform.example.json`, config loader (`src/config/platform-config.js`), brand runtime helper, docs, and tests.  
  - Tests: `node --test` covering parser + theme runtime (2026-03-29).  
  - Reviewer: Maxwell (sub-agent) — confirmed validation/docs alignment on 2026-03-29.  
  - Completed: 2026-03-29.

- [x] **Step 3 – Cloudflare Monorepo Skeleton**  
  - Scope: land Workers/Pages skeleton plus finalize the example config’s `auth` block + parser/tests so the skeleton has a complete runtime contract.  
  - Tests: `pnpm test` (node --test suites) on 2026-03-29.  
  - Reviewer: Epicurus (sub-agent) — LGTM after verifying parser/tests/docs alignment.  
  - Completed: 2026-03-29.
- [ ] **Step 4 – Config-backed Authentication & Access Control**  
  - 2026-03-29: Added `src/auth/access-policy.js`, docs (`docs/auth-access.md`), and unit tests so Workers/UI layers can evaluate config-defined roles. Tests: `pnpm test`. Reviewer: Lagrange (sub-agent) — LGTM for helper/tests/docs alignment.
  - 2026-03-29: Step 4.1 — auth worker now loads platform config from KV, verifies Wrangler secrets, exposes `/health` + `/version`, and ships a dedicated `wrangler.auth.toml`. Tests: `pnpm test` (handler + context suites). Reviewer: Bacon (sub-agent) — LGTM after wiring/coverage checks.
- [ ] **Step 5 – D1 Schema + Migration Scripts**  
- [ ] **Step 6 – Durable Object Bid Engine**  
- [ ] **Step 7 – R2 Media Pipeline**  
- [ ] **Step 8 – Campaign + Email Workflows**  
- [ ] **Step 9 – Enrollment & Public Forms**  
- [ ] **Step 10 – Admin UI + Analytics Refresh**  
- [ ] **Step 11 – Data Migration & Dual-Run Cutover**  
- [ ] **Step 12 – Production Cut + Open Source Release**

Add sub-bullets beneath each item as work progresses (dates, test logs, review summaries, follow-up tasks).
