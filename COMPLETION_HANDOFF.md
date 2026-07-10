# Hood Terminal Completion Handoff

Last checked: 2026-07-10

This is the handoff map for the next developer. It separates completed backend/product infrastructure from the items that still need real external contracts, frontend wiring, or production hardening.

## Current Snapshot

- Frontend: polished Next.js app shell and marketing site. API client/hooks exist, and `/scan/[address]`, `/pulse`, `/deployers`, `/quiver`, `/warrants`, `/api-keys`, `/account`, and `/wallet/[address]` are backend-backed. Some decorative/dashboard surfaces remain static.
- Backend: Fastify/Drizzle/Postgres/Redis scanner API with env validation, migrations, users, hashed API keys, watchlists, alerts, alert events, chain/DEX config, and core scan modules.
- Chain: Robinhood Chain ID is confirmed as `4663` (`0x1237`). Native currency is ETH. Explorer is Blockscout at `https://robinhoodchain.blockscout.com`.
- DEX config: WETH, Uniswap V2, and PancakeSwap V2 router/factory addresses are configured and were checked for deployed bytecode.
- Remaining external unknowns: hood.fun/RobinFun launch contracts, deeper locker-specific expiry ABIs, and any extra non-Uniswap/Pancake DEXs the product wants to support.

## Backend Now Patched

- Shared backend error helper is used by patched routes.
- Zod env validation exists in `backend/src/config/env.ts`.
- Contract registry exists in `backend/src/config/contracts.ts` for routers, factories, lockers, quote tokens, and launchpads.
- Honeypot checks can use multiple configured routers.
- LP resolver checks configured V2 factories and launchpad-held token balances.
- Launchpad-aware liquidity handling is patched for ArrowPad bonding curves, including created/trading/launched lifecycle events.
- NOXA Fun launch detection is patched from its Robinhood factory `TokenLaunched` event and marks known Uniswap V3 NFT launch-lock liquidity separately from generic ERC20 LP lockers.
- LP lock and honeypot modules avoid treating pre-graduation launchpad curves as ordinary unlocked LP pools.
- LP lock module checks burned LP and configured ERC20/V2 locker balances.
- Explorer source lookup exists through `/v1/source/:address`.
- Alchemy funding-origin tracer exists and is used by holder, fresh-wallet, bundle, and sniper detection.
- Users, DB-backed hashed API keys, watchlists, alerts, and alert events exist in schema, routes, and migrations.
- Alert evaluation runs after scan persistence and queues in-app/webhook delivery jobs.
- Alert delivery worker retries jobs and records delivered/failed alert events.
- Wallet nonce/verify routes exist for signature-based login.
- Wallet verification sets a signed HTTP-only browser session cookie.
- Auth middleware accepts signed wallet sessions or hashed API keys.
- Tier-aware scan quotas, scope checks, API-key tier caps, and response-level module gates are patched.
- User-scoped watchlist, alert, and API-key routes enforce ownership when an authenticated API key or wallet session is present.
- Deployer reputation now reads persisted deployer/token history with a safe on-chain fallback.
- Scan persistence normalizes token/deployer addresses and recalculates deployer launch stats from unique token rows.

## Backend Still Open

- Generic ERC20/V2 LP locker contract addresses on Robinhood Chain, if manual LP launches are in scope.
- Locker-specific ABI/functions for lock owner, locked amount, unlock timestamp, and lock status.
- hood.fun/RobinFun launchpad contract addresses, ABIs, and lifecycle events.
- Sentry Uniswap V3 NFT locker ABI-specific integration.
- NOXA deeper locker metadata, if the product needs expiry/creator-fee/position inspection beyond known launch-lock detection.
- Additional DEX router/factory addresses beyond configured Uniswap V2 and PancakeSwap V2, if product scope requires them.
- Team authorization model and paid-tier product rules.
- Billing/admin-backed tier upgrade workflow.
- Production API-key lifecycle extras: rotation, scopes UI, audit log, expiry, and per-team ownership.
- Email/push alert providers and dead-letter dashboard/ops flow.
- Source-code semantic analysis after source retrieval.
- Indexer-backed funding graph, deeper sybil clustering, persisted holder snapshots, and realized PnL/wallet history.
- Scam-template DB and bytecode/source fingerprint matching.
- Clean Postgres migration verification with Docker.
- Broader API/scanner/module integration tests.

## Frontend Still Open

- Replace remaining decorative/static mock surfaces with real data where product scope requires it.
- `/quiver` is wired to watchlist endpoints.
- `/warrants` is wired to alert and alert-event endpoints.
- `/api-keys` is wired to real create/list/revoke endpoints.
- `/pulse`, `/deployers`, and the shared token table are wired to backend pulse/deployer endpoints.
- `/account` is wired to backend wallet-session data.
- `/wallet/[address]` is wired to backend wallet rap sheet data.
- Branded `HoodWalletButton` is used across marketing, wallet gate, sidebar, and account surfaces.
- Wallet verification calls backend nonce/verify routes, stores local verification state, and receives a signed HTTP-only API session cookie.
- Wire `/crew` to real team data once team model is finalized.
- Add richer per-route skeletons and tailored empty states.
- Refine production wallet gate UX: demo mode, redirect, or connect modal.
- Add live updates after backend SSE/WebSocket is designed.
- Expand Playwright smoke tests beyond the current route-render scaffold.

## Environment Notes

- Backend `.env.example` includes confirmed chain/DEX values plus ArrowPad, Sentry, and NOXA Fun launchpad defaults.
- Backend `.env.example` now includes `SESSION_SECRET`, session cookie settings, and secure-cookie toggle.
- Supabase pooler URLs should set `DATABASE_SSL_REJECT_UNAUTHORIZED=false` in hosting secrets if Node rejects the certificate chain.
- Do not commit real secrets from local `.env`.
- Current workspace path contains `#`, which can break frontend toolchain resolution. Move to a clean path before final frontend verification.
- A clean-path copy exists at `/Users/0xhardhat/Downloads/Hood-Terminal-Product-Design`; frontend lint, typecheck, and production build pass there.
- The clean-path production build still prints a non-fatal MetaMask SDK optional dependency warning for `@react-native-async-storage/async-storage`.
- Wallet provider decision: Privy + wagmi is now installed and wired. Set `NEXT_PUBLIC_PRIVY_APP_ID` in hosting/frontend env to enable wallet/email/passkey login; local builds fall back to a disabled wallet button when it is missing.
- Root `docker-compose.yml` provides Postgres and Redis.
- Production deployment checklist exists in `PRODUCTION_DEPLOYMENT_CHECKLIST.md`.

## Verification Done In This Pass

```bash
cd backend
npm run build
npm test
npm run migrate

cd ../frontend
npm run lint
npm run build
npx playwright test --list
```

Build/tests pass, including scoring and tier-rule tests. Migrations were applied successfully to Supabase through the pooler.

## Suggested Next Build Order

1. Move the project out of the `#` path and verify frontend build/lint/typecheck.
2. Start Docker Postgres/Redis and run backend migrations from scratch.
3. Wire crew/team surfaces to backend team data.
4. Confirm hood.fun/RobinFun contracts and add ABI-specific Sentry plus deeper NOXA V3 position inspection.
5. Add team rules, billing-backed tier upgrades, and production API-key lifecycle extras.
6. Promote alerts/discovery/funding graph to production-grade queued/indexed workflows.
7. Expand tests across API routes, scanner modules, persistence, auth, and frontend data hooks.
