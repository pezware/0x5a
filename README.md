# Cloudflare Volunteer Platform

This repo contains the brandless volunteer/event/campaign platform designed for Cloudflare Workers, Pages, D1, Queues, R2, and KV. See `docs/cloudflare-rewrite-blueprint.md` for the full migration plan.

## Documentation

- `docs/cloudflare-rewrite-blueprint.md` – migration plan + architecture.
- `docs/configuration.md` – platform config surface.
- `docs/auth-access.md` – Step 4 helper details, including Auth Worker endpoints `/health` & `/version`.

## Development

```bash
pnpm install
pnpm test
```

### Workers

- API worker: `wrangler dev`
- Auth worker: `wrangler dev -c wrangler.auth.toml`
