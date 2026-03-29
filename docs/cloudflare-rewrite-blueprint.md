# Cloudflare Rewrite Blueprint

## 1. Legacy Platform Snapshot

### 1.1 Product Scope (derived from `README.md`, `types.ts`, `functions/src/*`)
- **Auction & Checkout:** Live bidding, status-aware bids (`bids`, `items`, `payments`), guest lifecycle (check-in → checkout → paid), volunteer-facing auction views, cash/pledge management, multi-role volunteer roster.
- **Contacts & Campaigns:** Dedicated `contacts`, `groups`, `campaigns`, `brands`, and `emailTemplates` collections, CSV import modes, group math (permanent, temporary, dynamic, selection), Resend API integration, unsubscribe + recovery workflows, send-progress dashboards, resend/retry semantics.
- **Volunteer Access & Auth:** Shared password managed via Firebase Remote Config, bootstrap password for admin creation, optional phone OTP, Firebase phone auth fallback, OTP Cloud Functions (`functions/src/auth`).
- **Enrollment System:** Public enrollment slug per event (`docs/ENROLLMENT_SYSTEM_DESIGN.md`), reCAPTCHA + rate limiting, approval queues, auto table assignment, conversion into guests, branding knobs per event.
- **Donor Tracking & Exports:** Donations separate from auction payments, analytics dashboards, CSV exports, admin tooling.
- **Media & Storage:** Firebase Storage image uploads (5 MB cap, enforced MIME), scripts for bulk uploads, remote image metadata.
- **Tooling & Ops:** Harness policy (`harness.json`), smoke tests (`npm run test:run`, `npx tsc --noEmit`, `npm run build`), seeding/import scripts, risk-tier merge policy, environment-specific theming (dark staging / light production) enforced in `index.tsx`.

### 1.2 Data & Workflows (from `types.ts`, `functions/src`, docs)
| Domain | Key Entities | Notes |
| --- | --- | --- |
| Guests & Volunteers | `Guest`, `Volunteer`, `GuestStatus`, `VolunteerStatus`, table assignments, roles, diet, phone/email, groups, unsubscribe prefs | Items, bids, payments reference guests & volunteers by ID; volunteers gate UI access.
| Auction Catalog | `Item`, `ItemStatus`, `ItemFormat`, donor metadata, value, min bid, buy-now, media URL | Item edits audited via `itemEdits`.
| Financials | `Bid`, `Payment`, `Donation`, enumerated payment methods, void history | Checkout logic merges bids and pledges into receipts.
| Contacts & Segments | `Contact`, `Group`, `Campaign`, `Brand`, `emailTemplates` | Campaign send/rollback tracked per recipient; syncs with Resend; unsubscribes mirrored.
| Enrollment | `EventConfig` (per docs), enrollments queue, review + bulk actions | Workflows convert approved entries into guests.

### 1.3 Operational Constraints
- **Multi-environment** staging vs production with different Firebase projects and enforced theme cues.
- **Security Rules:** Firestore & Storage rules, OTP callable functions requiring public HTTP invoker binding.
- **Automation:** Seeding/import scripts drive first-run bootstrap; harness gating ensures smoke tests per risk tier.
- **Integrations:** Resend email API, Google Cloud Functions (Node 18+), Remote Config, Firebase Auth/Firestore/Storage.

### 1.4 Workflow Swimlanes (Legacy)
1. **Enrollment → Guest Lifecycle**
   - Public enrollment slug posts into `enrollments` via Cloud Function with reCAPTCHA + rate limiting.
   - Admins review entries, bulk approve/reject, then run conversion scripts that create `guests`, assign tables, and flag ambassadors.
   - Approved guests sync into `groups` (e.g., current-event) to unlock campaigns and check-in screens.
2. **Auction Flow**
   - Volunteers (shared password/OTP) authenticate, pull `items`, `bids`, `payments`.
   - Bids stream into `bids` collection; checkout UI aggregates open balances and records `payments` + `donations`; `itemEdits` log overrides.
   - Status dashboards read aggregated metrics (highest bid, unpaid totals) for MC + finance teams.
3. **Contacts & Campaigns**
   - `contacts` and `guests` feed `groups` (permanent/temporary/dynamic) which drive campaign targeting.
   - Campaign creation invokes Resend via Cloud Functions, storing send jobs in `campaigns` + `brands`.
   - Webhooks update unsubscribe + bounce fields across contacts and guests; recovery workflows queue retries.
4. **Volunteer & Ops**
   - `volunteers` hold role assignments driving UI permissions.
   - Scripts (`scripts/add-volunteer-phones`, `scripts/seed`) keep data in sync between Firestore and CSV fixtures.
5. **Media Pipeline**
   - UI uploads images to Firebase Storage, referencing signed URLs inside `items`.
   - Rules enforce 5 MB limit and JPEG/PNG MIME validation.

## 2. Brandless Configurable Product Spec

### 2.1 Configuration Surfaces
- **`config/platform.json` + `config/platform.example.json`:**
  - `branding`: `{ name, shortName, primaryColor, secondaryColor, logo, darkModeDefault }` replacing hard-coded strings (e.g., Remote Config default sender names).
  - `schemaVersion`: positive integer that increments with breaking changes; the loader rejects configs with invalid versions.
  - `modules`: feature toggles (`auction`, `volunteer`, `events`, `campaigns`, `donations`, `contacts`). Each module exposes granular capabilities (e.g., `auction.enableBuyNow`, `campaigns.enableResendSync`).
  - `tenants`: optional array supporting multiple org instances with overrides for branding, locales, currency, time zone, authentication policy (password-only, OTP, SSO).
  - `integrations`: `email` (Resend API key/region, sender pool), `payments` (manual, Stripe/checkout proxy), `storage` (bucket, CDN), `analytics` (dashboards/observability metadata).
  - `auth`: issuer/audience strings for Workers-issued tokens, shared password label/hash, and TTL defaults so Access + Workers stay aligned without hardcoding secrets.
  - `roles`: declarative matrix mapping UI routes/actions to roles (Editor, Cashier, Table Host, Campaign Manager) to keep access policies brand-agnostic.
  - The repository ships an example config plus a parser/normalizer (`src/config/platform-config.js`) and a brand runtime helper (`src/brand/branding-runtime.js`) used by tests and, eventually, the UI. See `docs/configuration.md` for the full workflow.

### 2.2 Plugin-style Extensibility
- **Module Loader:** Each module exports a `registerModule(config, services)` hook that receives Cloudflare bindings (Workers KV, D1, Durable Objects, R2) plus integration clients. UI shells (React routes) read `modules` config to mount features dynamically.
- **Schema Versioning:** `schemaVersion` field in config + D1 migrations ensures open-source forks can evolve without collisions.
- **Brand Packs:** Provide sample configs (start from `config/platform.example.json`) for events, volunteer drives, or campaign-only deployments to showcase reusability without referencing the legacy name.

### 2.3 Compliance & Secrets
- Secrets (Resend keys, bootstrap passwords) stored in Workers Secrets; config file only carries non-sensitive toggles.
- Provide `.env.example` for local dev referencing `wrangler.toml` bindings (no legacy identifiers).

## 3. Target Cloudflare Architecture

### 3.1 Compute & Routing
- **Cloudflare Pages** hosts the React/Vite frontend; Pages Functions proxy authenticated calls to Workers APIs.
- **Workers (with Wrangler monorepo):**
  - `api` Worker handles JSON APIs (contacts, bids, enrollment, campaign orchestration).
  - `auth` Worker issues OTP/password tokens, integrates with Access service tokens.
  - Durable Objects per coordination unit (auction room, enrollment slug, campaign send) to serialize state (e.g., bid placement, rate limiting) while keeping global deployment.
  - Worker Cron for scheduled syncs (Resend status pulls, recurring exports, enrollment auto-reminders).

### 3.2 Data Plane
- **Cloudflare D1:** Primary relational store. Tables for `guests`, `volunteers`, `items`, `bids`, `payments`, `donations`, `contacts`, `groups`, `campaigns`, `enrollments`, `events`, `audit_log`. Use views for analytics dashboards. Leverage (and regularly verify) D1 Time Travel’s point-in-time recovery for safe migrations.
- **Durable Objects:** Maintain hot state caches (currently active bids, real-time dashboards) and enforce per-guest or per-item locks.
- **Workers KV / Config Store:** Host brandless `platform.json`, Remote Config equivalents (shared passwords, feature flags).
- **R2:** Store media (item images, attachments) with signed URLs. Super Slurper + Sippy handle migration from Firebase Storage buckets.
- **Queues:** Replace Pub/Sub + callable retries. Dedicated queues for `emailSend`, `contactSync`, `enrollmentReview`, `etlJobs` ensure retries/backoff without blocking HTTP paths.
- **Hyperdrive (Optional bridge):** Wrap any remaining SQL backends until D1 migration completes. For Firestore data, schedule export → Cloud Storage → ETL into D1 (see §5).

### 3.3 Security & Access
- **Cloudflare Access + Zero Trust:** Protect admin hostnames, enforce device posture, MFA, and service tokens for Workers calling privileged routes. Map Access groups to platform roles through JWT claims.
- **Secret Management:** Wrangler secrets for API keys; Access service tokens for callable endpoints; Workers environment binding for hashed shared password.
- **Rate Limiting & Abuse Controls:** Durable Objects maintain per-IP/email counters for enrollment + OTP. Worker Firewall rules block suspicious origins.

### 3.4 Observability & Operations
- **Workers Traces & Logs:** Enable `observability -> traces` in `wrangler.toml`, forward to Cloudflare Logs or third-party via Logpush.
- **Metrics Dashboards:** Use Cloudflare Analytics + custom Supabase/PostHog dashboards fed from Queues to monitor bids/min, error rates, email throughput.
- **CI/CD:** GitHub Actions pipeline building Pages + Workers, running Vitest + playwright smoke, pushing to Preview + Production. Harness gating extends to new stack (see §7).

### 3.5 Developer Experience
- Local dev via `wrangler dev --test-scheduled`, seeded D1 database using existing CSV scripts adapted to SQLite.
- Storybook-like UI harness using Vite preview to validate module toggles visually.

## 4. Incremental Rewrite Plan (Tiny Steps w/ Harness)
When practical, each step should pair (a) a docs update, (b) harness verification (`npm run harness:smoke` or a justified subset), and (c) a Cloudflare Preview deploy while the Firebase stack stays primary. Docs-only or scaffold-only steps can document why a deploy is unnecessary but must still update `STATUS.md`.

1. **Baseline Documentation Package**
   - Create this blueprint + config samples; document forbidden legacy naming.
   - Harness: `npm run harness:policy-gate` to ensure docs recognized, add doc drift pairing between new spec and config.

2. **Introduce Brandless Config Artifacts**
   - Add `config/platform.example.json`, loader utility, and React context that replaces hard-coded branding in `App.tsx`.
   - Harness: Extend unit tests covering config parsing; add snapshot tests verifying UI theming switches with config.

3. **Set Up Cloudflare Monorepo Skeleton**
   - Add `wrangler.toml`, `workers/api/index.ts`, `workers/auth/index.ts`, `pages-functions/` scaffold. Configure Pages build to reuse existing Vite output.
   - Harness: Update smoke tests to include `wrangler deploy --dry-run` and TypeScript checks for Workers.

4. **Config-backed Authentication & Access Control**
   - Port OTP/password flows into Workers, backed by KV/Secrets; integrate Cloudflare Access JWT validation middleware.
   - Harness: Add integration tests mocking Access headers; run `npm run harness:risk-tier` on auth paths.

5. **D1 Schema + Migration Scripts**
   - Define Prisma-like SQL migrations or raw `.sql` files describing tables/indices; implement seeding from existing CSV sources.
   - Harness: Add `npm run test:run -- --dir tests/d1` executing D1-backed repositories; `wrangler d1 execute --local` as part of smoke.

6. **Durable Object Bid Engine**
   - Build DO for `AuctionRoom` controlling bid placement, concurrency, live dashboards. Wrap HTTP/WS endpoints for UI.
   - Harness: Unit tests using Miniflare DO environment; add load-test script (k6 or Workers profiling) gated before merges touching `handlers/**`.

7. **R2 Media Pipeline**
   - Adapt `utils/imageUpload.ts` to sign R2 uploads, add Queue-driven image processing (thumbnailing via Workers Images).
   - Harness: Contract tests ensuring uploads respect size/MIME constraints; e2e script verifying signed URL expiry.

8. **Campaign + Email Workflows**
   - Port contact sync + send flows to Workers + Queues; store send metadata in D1; expose Resend credentials via secrets.
   - Harness: Mock Resend API tests; scheduled Worker test verifying status sync; ensure privacy tests for unsubscribe updates.

9. **Enrollment & Public Forms**
   - Use Pages Functions for `/enroll/:slug`, DO for rate limiting, D1 for persistence. Provide script to convert approvals into guests.
   - Harness: Playwright smoke hitting enrollment form, verifying rejection/approval flows under config toggles.

10. **Admin UI + Analytics Refresh**
   - Move dashboards to use D1 views fetched via Workers; add streaming updates via Durable Objects.
   - Harness: Visual regression or story tests for key views; TypeScript contract tests against Worker responses.

11. **Data Migration & Dual-Run Cutover**
   - Execute Firestore export → GCS → transform to SQLite → import into D1; run comparison scripts ensuring row counts + checksums match. Keep Firebase read paths for diffing until parity reached.
   - Harness: Add CLI script `npm run harness:dual-read` comparing Worker vs Firebase responses for sampled IDs.

12. **Production Cut + Open Source Release**
   - Flip DNS to Cloudflare Pages, retire Firebase hosting after burn-in. Publish OSS repo with MIT/Apache license, contributor guide, sample configs.
   - Harness: Final smoke on Pages Preview + Production, plus Access policy verification script.

## 5. Data & Migration Strategy
- **Export Pipeline:** Use `gcloud firestore export` into Cloud Storage, download via Super Slurper into R2, convert to SQLite (BigQuery or custom script), then `wrangler d1 execute` for imports. Maintain mapping tables to convert Firestore auto IDs to ULIDs.
- **Dual Writes:** During migration steps 6–11, insert a Worker proxy that writes both to Firestore (legacy) and D1 (new) until confidence achieved; guard with feature flag in KV.
- **Verification Harness:** Obey harness philosophy by adding automated comparison jobs (sampled docs, aggregate sums). Store verification results in `docs/migration-reports/` for audit.
- **Backfill Media:** Use R2 Super Slurper to copy storage objects; update item image URLs via script referencing D1 item IDs.

## 6. Open Source & Compliance Checklist
- Remove legacy branding strings from source, docs, seeds, metadata. Reference config-driven names only.
- Ship `docs/CONTRIBUTING.md`, `docs/SECURITY.md`, and architecture diagrams describing Cloudflare bindings.
- Provide sanitized seed data (synthetic guests/items) plus fixture CSVs so contributors can run `npm run seed` without sensitive info.
- Document secret management (Wrangler secrets, Access policies) and include threat models for shared-password vs Access-only deployments.
- License under MIT or Apache-2.0; include THIRD_PARTY notices for Resend SDK and Firebase remnants if reused.

## 7. Harness & Testing Modernization
- **Extend `harness.json`:** Add Cloudflare-specific high-risk paths (`workers/**`, `wrangler.toml`, `config/platform*.json`). Ensure docs drift couples this blueprint with config + schema files.
- **CI Steps:**
  1. `npm run test:run` (React/Vitest).
  2. `npm run build` (Vite + Pages Functions).
  3. `wrangler deploy --dry-run` for Workers, `wrangler d1 migrations apply --local` for schema.
  4. `npm run harness:smoke` extended to run Miniflare DO tests + config validation.
- **Observability Harness:** Create synthetic transactions hitting Workers endpoints every 5 minutes (using Cloudflare Scheduled Workers) to ensure uptime dashboards remain green before final cutover.
- **Documentation Discipline:** Every structural change updates `docs/cloudflare-rewrite-blueprint.md` and module-specific docs so OSS consumers are never behind.

## 8. Multi-Worker Topology & Linus-Friendly Workflow

### 8.1 Worker Responsibilities
- **WebUI Edge Worker**
  - Terminates all browser/API traffic, injects Access policies, serves Pages Functions, and fans out to downstream workers based on route prefix (`/api`, `/campaign`, `/donation`, `/events`, `/volunteers`).
  - Caches config + tenant branding in Workers KV; enforces locale/theme before hydrating React.
- **Campaign Worker**
  - Owns `campaigns`, `groups`, `contacts`, `brands`, `emailTemplates` tables plus send queues.
  - Handles Resend API calls, webhook ingestion, unsubscribe sync, segment math, and scheduled resend jobs.
- **Donation Worker**
  - Manages `payments`, `donations`, pledge tracking, reconciliation exports, and receipt generation.
  - Uses Durable Objects to serialize checkout sessions (prevent double charges) and emits ledger events to Queues.
- **Event Worker**
  - Covers enrollment landing pages, `events`/`enrollments` tables, capacity checks, rate limiting, and auto table assignment.
  - Publishes approved attendees to Queues consumed by Volunteer Worker and Campaign Worker.
- **Volunteer Worker**
  - Governs `volunteers`, role matrices, shared password/OTP/Access integration, and session issuance.
  - Mediates auction-critical data (`guests`, `items`, `bids`) through Durable Objects per item or table.
- **Shared Services**
  - `auth` namespace issuing JWTs/service tokens, `config` namespace validating platform config, and `obs` namespace streaming logs/traces to centralized sinks.

### 8.2 Workflow Clearing with Entities
1. **Enrollment-to-Guest Bridge**
   - Event Worker validates submission → writes to D1 `enrollments`.
   - Approval triggers Queue message consumed by Volunteer Worker → creates `guests`, updates `groups`, notifies Campaign Worker.
2. **Auction Bid Path**
   - WebUI Worker routes `/api/bids` to Volunteer Worker.
   - Volunteer Worker asks `AuctionRoom` Durable Object to validate bid sequence, persists bid row in D1, enqueues donation/balance recalcs.
   - Donation Worker consumes ledger events to update receipts and emits status updates back through Durable Object for live dashboards.
3. **Campaign Send Loop**
   - Campaign Worker reads `groups`/`contacts`, composes send list, enqueues batched email jobs to Queues.
   - Worker Cron pulls delivery/bounce stats, writes back to `contacts` + `guests`, and signals Volunteer Worker if communication affects on-site workflows (e.g., VIP arrival).
4. **Volunteer Access**
   - WebUI uses Access JWT + Volunteer Worker-issued session token scoped to modules toggled in config.
   - Any UI route hits a `module` middleware that checks config + role matrix before binding data fetchers (keeps brandless yet safe).

### 8.3 Why This Isn’t “Too High Level”
- Each worker maps to an existing functional domain (campaign, donation, event, volunteer) already enforced in Firestore collections; we mirror that separation instead of inventing microservices.
- Responsibilities stay tiny by shipping in Linus-style increments: start with one Worker + Durable Object per domain, keep git diffs small, and only add new bindings when a test exists.
- Shared utilities (auth, config, observability) reduce coupling so workers can be iterated independently without regressing harness guarantees.

### 8.4 Linus Approach Checklist
1. Sketch data-contract tests before touching Workers code.
2. Build the smallest Worker per domain with feature-flagged routes; keep legacy Firebase endpoints proxied until parity tests pass.
3. Enforce automated harness gates (unit + wrangler dry run) before merging each Worker addition.
4. Keep docs (this blueprint + module guides) updated every time a Worker gains or hands off responsibility.

---
This document intentionally omits the legacy product name so it can be shared publicly as part of the brand-neutral rewrite effort.
