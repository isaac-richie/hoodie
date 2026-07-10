# Hood Terminal — Project Status

Last checked: 2026-07-10

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 16 App Router, Tailwind v4, Privy, wagmi, viem, TanStack Query, Zustand, Framer Motion |
| Backend | Fastify 5, Drizzle ORM, PostgreSQL, Redis, BullMQ, viem |
| Chain | Robinhood Chain mainnet, chain ID `4663` (`0x1237`) |

## Frontend

### Completed

- [x] Marketing site and app shell are built.
- [x] Wallet provider is wired with the Robinhood Chain definition.
- [x] Wallet connect UI uses a branded Hood button on marketing, gate, sidebar, and account pages.
- [x] Wallet proof flow calls backend nonce/verify routes and stores local verification state.
- [x] App routes exist for hideout, quiver, pulse, heist, warrants, deployers, field notes, patterns, account, API keys, crew, and scan detail.
- [x] Mobile sidebar/menu behavior is patched.
- [x] Shared API client and TanStack Query hooks exist for scan detail, pulse, deployers, deployer detail, wallet detail, source verification, RPC stats, watchlist, alerts, and API keys.
- [x] `/scan/[address]` now calls the backend and renders module results.
- [x] `/api-keys`, `/quiver`, `/warrants`, `/pulse`, and `/deployers` now use real backend reads/mutations.
- [x] `/account` reads the backend wallet-session endpoint and shows user/tier/scopes/session expiry.
- [x] `/wallet/[address]` reads the backend wallet rap sheet endpoint and renders honest empty states.
- [x] Shared marketing token table now reads the backend pulse feed instead of fake token arrays.
- [x] Zustand stores exist for local session, scan history, and quiver state.
- [x] API client sends credentials so browser wallet-session cookies work across frontend/backend.
- [x] App-level loading/error boundary exists, and scan detail highlights module-gated and rate-limited responses.
- [x] Playwright smoke-test scaffold exists for core route rendering.
- [x] Optional wallet gate exists through `NEXT_PUBLIC_REQUIRE_WALLET=true`.

### Still Open

- [ ] Replace remaining decorative/static surfaces with real data where product scope requires it, especially dashboards and the animated hero terminal.
- [ ] Wire crew page to real team data once the team model exists.
- [ ] Add richer per-route skeletons and tailored empty states.
- [ ] Add real-time updates through SSE/WebSocket once the backend exposes streaming.
- [ ] Expand Playwright coverage beyond the current smoke scaffold.

## Backend

### Completed

- [x] Fastify API with shared error shape and route validation.
- [x] Zod environment validation.
- [x] Robinhood Chain config confirmed: chain ID `4663`, ETH native token, public RPC fallback, Blockscout explorer.
- [x] Alchemy RPC is configured in local backend env.
- [x] Confirmed WETH, Uniswap V2, and PancakeSwap V2 router/factory addresses are present in env examples and parsed through `contractConfig`.
- [x] Scanner orchestrator, weighted scoring, Redis/RPC cache, token metadata, LP resolver, deployer resolver, and workers exist.
- [x] Core API routes exist: scan, score, token detail, pulse, deployers, deployer detail, wallet detail, source verification, RPC stats.
- [x] Drizzle schema and migrations exist for tokens, deployers, scans, wallets, holder snapshots, LP events, users, API keys, watchlists, alerts, and alert events.
- [x] Users and DB-backed API keys exist; API keys are hashed in Postgres and cached by hash in Redis.
- [x] Watchlist and alert CRUD endpoints exist.
- [x] Alert evaluator runs after persisted scans and queues in-app/webhook delivery jobs.
- [x] Alert delivery worker records delivered/failed alert events with retry handling.
- [x] Wallet nonce/verify endpoints exist for signature-based login.
- [x] Wallet verification now sets a signed HTTP-only browser session cookie.
- [x] Auth middleware accepts signed wallet sessions or hashed API keys.
- [x] Tier-aware scan quotas, scope checks, API-key tier caps, and response-level module gates are patched.
- [x] Authenticated user ownership checks protect user-scoped watchlist, alert, and API-key routes.
- [x] LP lock module checks burned LP plus configured locker balances.
- [x] ArrowPad launchpad lifecycle detection prevents pre-graduation bonding-curve tokens from being scored as ordinary unlocked LP pools.
- [x] NOXA Fun Robinhood factory detection marks launched Uniswap V3 NFT liquidity as launchpad-locked instead of generic unlocked LP.
- [x] RPC log caching now keys by event ABI so launchpad event scans cannot collide.
- [x] Holder, fresh-wallet, bundle, and sniper modules trace funding origins through Alchemy when available.
- [x] Deployer reputation now reads persisted deployer/token history with on-chain fallback.
- [x] Persistence normalizes token/deployer addresses and derives deployer launch counts from unique token rows.

### Scan Module Status

| Module | Status | Notes |
|--------|--------|-------|
| honeypot | Implemented | Buy/sell simulation across configured routers |
| hidden-mint | Implemented | Detects hidden mint selectors |
| mutable-tax | Implemented | Tax mutability selector checks |
| blacklist | Implemented | Blacklist/whitelist selector checks |
| trading-pause | Implemented | Pause selector checks |
| ownership | Implemented | Owner/renounce checks |
| proxy-check | Implemented | Upgradeable proxy slot checks |
| holder-dist | Partial | Distribution plus Alchemy common-funder adjustment works; needs indexer-backed depth |
| fresh-wallets | Partial | Fresh/single-tx plus Alchemy common-funder checks work; needs richer wallet-age heuristics |
| lp-lock | Partial | Burn/configured ERC20 LP locker checks plus ArrowPad curve and NOXA V3 launch-lock handling work; Sentry/deeper expiry ABIs remain open |
| bundle-detect | Partial | Early bundle detection plus Alchemy funding origins; needs richer clustering/indexer depth |
| sniper-detect | Partial | Early buyers, current balances, common funders; needs realized PnL/sell-through |
| deployer-rep | Implemented baseline | Reads persisted history; quality improves as database fills |
| scam-template | Stub | Needs template table, bytecode fingerprints, and matching logic |
| registry | Implemented | Module registration |

### Still Open

- [ ] Confirm generic ERC20/V2 LP locker addresses and locker-specific expiry ABI/function names on Robinhood Chain.
- [ ] Confirm hood.fun/RobinFun launchpad contracts, ABIs, and lifecycle events on Robinhood Chain.
- [ ] Add ABI-specific Sentry launch factory checks and deeper NOXA Uniswap V3 NFT position metadata.
- [ ] Add any non-Uniswap/Pancake DEX routers/factories the product must scan.
- [ ] Add production team authorization rules beyond single wallet-owner access.
- [ ] Connect tier changes to a real billing/admin workflow.
- [ ] Add email/push providers and a dead-letter dashboard/ops flow for alert delivery.
- [ ] Add source-code semantic analysis after Blockscout source retrieval.
- [ ] Add indexer-backed funding graph, persisted holder snapshots, and wallet PnL history.
- [ ] Complete scam-template storage and matching.
- [ ] Verify migrations against a clean local Postgres and document the exact command path.
- [ ] Add broader API/scanner/module integration tests with mocked RPC plus test Postgres/Redis.

## Environment And Build Notes

- Current workspace path contains `#`: `/Users/0xhardhat/Downloads/# Hood Terminal Product Design`.
- That path can break parts of the frontend Next/Vite toolchain. Move to a clean folder before final frontend build verification.
- Clean-path verification passed from `/Users/0xhardhat/Downloads/Hood-Terminal-Product-Design`.
- Frontend production build passes there with a non-fatal MetaMask SDK optional dependency warning about `@react-native-async-storage/async-storage`.
- Wallet provider decision: Privy + wagmi is now installed and wired. Set `NEXT_PUBLIC_PRIVY_APP_ID` in hosting/frontend env to enable wallet/email/passkey login; local builds fall back to a disabled wallet button when it is missing.
- Backend verification currently passes in this folder with `npm run build` and `npm test` covering scoring plus tier-rule tests.
- Production deployment checklist exists in `PRODUCTION_DEPLOYMENT_CHECKLIST.md`.
- Supabase migrations have been applied through the pooler. Hosted backend deployments using the pooler should include `DATABASE_SSL_REJECT_UNAUTHORIZED=false`.
- Local services are defined in root `docker-compose.yml` for PostgreSQL and Redis.

## Running Locally

```bash
# Services
docker compose up -d

# Backend
cd backend
cp .env.example .env
npm install
npm run migrate
npm run dev

# Frontend
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

## Next Developer Priority Order

1. Move/rename the workspace path and verify frontend build/lint/typecheck.
2. Run backend migrations against clean Docker Postgres.
3. Wire crew/team surfaces to real backend team data.
4. Confirm remaining launchpad/locker contracts and add their ABI-specific events/functions.
5. Add team rules, billing-backed tier upgrades, and production API-key lifecycle rules.
6. Move alerts and discovery into production-grade queued/retryable workflows.
7. Add real integration tests around scanner modules, API routes, Redis, Postgres, and expand frontend Playwright coverage.
