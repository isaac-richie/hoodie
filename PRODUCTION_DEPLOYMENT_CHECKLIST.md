# Production Deployment Checklist

Last updated: 2026-07-10

Use this before handing Hood Terminal to hosting or another developer.

## Required Backend Secrets

- `RPC_URL`: Robinhood Chain RPC. Alchemy Robinhood RPC is expected in production.
- `RPC_WSS`: optional websocket RPC for lower-latency discovery.
- `DATABASE_URL`: Postgres connection string. Supabase pooler is supported.
- `DATABASE_SSL_REJECT_UNAUTHORIZED=false`: required for some Supabase pooler deployments if Node rejects the cert chain.
- `REDIS_URL`: Redis connection string for cache, queues, auth cache, and rate limits.
- `SESSION_SECRET`: long random secret used to sign wallet-session cookies. Do not reuse the example value.
- `SESSION_COOKIE_NAME`: defaults to `hood_session`.
- `SESSION_TTL_SECONDS`: defaults to 7 days.
- `COOKIE_SECURE=true`: use true for HTTPS/cross-site frontend/backend deployments.
- `EXPLORER_API_URL`: defaults to Blockscout if configured in env examples.
- `EXPLORER_API_KEY`: optional.

## Required Frontend Env

- `NEXT_PUBLIC_API_URL`: public backend URL, no trailing slash preferred.
- `NEXT_PUBLIC_PRIVY_APP_ID`: Privy app id for wallet/email/passkey login.
- `NEXT_PUBLIC_REQUIRE_WALLET=true`: optional hard wallet gate for the app shell.

## Database

1. Start from a clean Postgres when validating migrations locally.
2. Run backend migrations from the backend folder.
3. Confirm `users`, `api_keys`, `watchlist_items`, `alerts`, `alert_events`, `tokens`, `deployers`, `scan_results`, and wallet/holder tables exist.

```bash
docker compose up -d
cd backend
npm run migrate
```

## Build Verification

Use the clean project path for frontend production builds. The original folder name contains `#`, which can confuse parts of the Next toolchain.

```bash
cd /Users/0xhardhat/Downloads/Hood-Terminal-Product-Design/backend
npm run build
npm test

cd /Users/0xhardhat/Downloads/Hood-Terminal-Product-Design/frontend
npm run lint
npm run build
```

Known non-fatal frontend build warnings currently come from optional Privy/MetaMask dependencies:

- `@react-native-async-storage/async-storage`
- `@stripe/crypto`
- `@farcaster/mini-app-solana`
- dynamic Tempo import warning from `ox`

## Auth And Product Rules

- Wallet verification returns a signed HTTP-only session cookie.
- API auth accepts either signed session cookie or `x-api-key`.
- Tiers currently supported: `guest`, `free`, `pro`, `team`.
- Free/demo sessions receive core modules only; Pro/Team receive all modules.
- API-key tier creation is capped to the authenticated user's tier.
- Real billing/admin tier upgrades are not implemented yet.

## Chain Defaults Currently Configured

- Chain ID: `4663`
- WETH: `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73`
- Uniswap V2 router: `0x89e5db8b5aa49aa85ac63f691524311aeb649eba`
- Uniswap V2 factory: `0x8bceaa40b9acdfaedf85adf4ff01f5ad6517937f`
- PancakeSwap V2 router: `0x8cFe327CEc66d1C090Dd72bd0FF11d690C33a2Eb`
- PancakeSwap V2 factory: `0x02a84c1b3BBD7401a5f7fa98a384EBC70bB5749E`
- ArrowPad: `0x5d2391CF88cd48BB6B9Ec12b38BC8119562F9012`
- Sentry factory: `0x9e8f6f8214b01Fd4Cf1d73FB1fb7cf9f811036Cb`
- NOXA Fun factory: `0xD9eC2db5f3D1b236843925949fe5bd8a3836FCcB`

## Do Not Ship Until These Are Decided

- Billing/admin source of truth for paid tiers.
- Team membership and role model.
- API-key rotation/expiry/audit log.
- Alert providers beyond in-app/webhook.
- Whether hood.fun, RobinFun, Sentry, and deeper NOXA metadata are required for v1.
- Production monitoring for Redis queues and failed alert deliveries.
