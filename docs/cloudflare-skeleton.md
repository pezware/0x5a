# Cloudflare Skeleton Overview

Step 3 adds the initial Workers/Pages skeleton so contributors can deploy placeholders while the Firebase stack still runs production.

## Layout

```
/
├── wrangler.toml              # Shared bindings (D1, KV, R2, Queues, cron, vars)
├── workers/
│   ├── api/index.ts          # API Worker placeholder
│   ├── auth/index.ts         # Auth Worker placeholder
│   └── queues/index.ts       # Queue consumer placeholder
├── pages-functions/index.ts  # Pages Functions entry point
└── src/types/globals.d.ts    # Ambient Worker Env typings for editors
```

## Preview vs Production
- `wrangler.toml` defines `env.preview` and `env.production` sections to keep environment variables and bindings explicit.
- Observability is enabled by default so traces/logs flow once Miniflare/wrangler deploys run.

## Next Steps
- Flesh out the Workers implementations per `docs/cloudflare-rewrite-blueprint.md` steps 4–8.
- Replace placeholders with real routing, durable objects, and queue processing as features migrate from Firebase.
