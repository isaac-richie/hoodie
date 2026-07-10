# Next Developer TODO

Last updated: 2026-07-10

This file lists only the work that remains after the current patch pass. Do not treat older notes about wallet sessions, tier gates, Pulse, Deployers, ArrowPad, or NOXA as open unless they conflict with this file.

## Already Patched

- Backend builds and tests pass.
- Frontend lint and clean-path production build pass.
- Wallet signature verification sets a signed HTTP-only backend session cookie.
- Auth accepts wallet sessions or hashed API keys.
- Tier rules exist for `guest`, `free`, `pro`, and `team`, with scan quotas, scopes, API-key tier caps, and module gates.
- `/scan/[address]`, `/pulse`, `/deployers`, `/quiver`, `/warrants`, `/api-keys`, and the shared token table are backend-backed.
- `/account` now reads the backend wallet session and shows tier/scopes/session expiry.
- `/wallet/[address]` now reads the backend wallet rap sheet endpoint and shows honest empty states.
- App routes have a shared loading/error boundary, and scan detail calls out module-gated and rate-limited responses.
- Playwright smoke-test scaffold exists with four route checks.
- `PRODUCTION_DEPLOYMENT_CHECKLIST.md` covers required secrets, build commands, and deploy blockers.
- Robinhood Chain, WETH, Uniswap V2, PancakeSwap V2, ArrowPad, Sentry, and NOXA Fun defaults are configured.
- ArrowPad bonding-curve lifecycle detection and NOXA V3 launch-lock detection are implemented.

## P0 Before Production

1. Add billing/admin tier management.
   - Current state: tier logic exists, but there is no billing provider, admin UI, webhook, or trusted tier-upgrade path.
   - Backend files: `backend/src/api/product-rules.ts`, `backend/src/db/schema.ts`, `backend/src/api/routes/api-keys.ts`.
   - Frontend files: `frontend/src/app/(marketing)/page.tsx`, `frontend/src/app/(app)/account/page.tsx`, `frontend/src/app/(app)/api-keys/page.tsx`.
   - Acceptance: users cannot self-upgrade; paid tier changes come from a trusted billing/admin source; API keys inherit only allowed tier/scopes.

2. Add team/account model beyond single wallet ownership.
   - Current state: `team` tier exists as a policy label only.
   - Needed: teams table, memberships, roles, ownership transfer/invites, and route guards.
   - Acceptance: resources can belong to a team; member roles control API keys, watchlists, alerts, and billing.

3. Finish production API-key lifecycle.
   - Current state: create/list/revoke works with hashed keys.
   - Needed: rotation, expiry, audit log, per-key scope UI, per-team ownership, last-used visibility polish.
   - Acceptance: a production operator can rotate and audit keys without DB access.

4. Expand frontend smoke/Playwright coverage.
   - Current state: Playwright is installed and a four-route smoke scaffold exists.
   - Needed: add authenticated flows, scan detail with mocked backend, Quiver, Warrants, API Keys, and mobile viewport checks.
   - Acceptance: CI can catch broken navigation/rendering before deploy.

## P1 Scanner And Chain Integrations

1. Confirm and integrate hood.fun and RobinFun contracts.
   - Current state: public pages mention bonding curves and graduation, but verified contract addresses/ABIs are not yet integrated.
   - Needed: factory/launchpad addresses, start blocks, lifecycle events, graduation events, LP lock/burn semantics.
   - Backend files: `backend/src/config/contracts.ts`, `backend/src/services/launchpad-resolver.ts`, `backend/src/services/lp-resolver.ts`.
   - Acceptance: tokens launched through hood.fun/RobinFun are classified correctly before and after graduation.

2. Add Sentry-specific Uniswap V3 lock detection.
   - Current state: Sentry factory is configured, but ABI-specific lifecycle/position checks are not implemented.
   - Known default: Sentry factory `0x9e8f6f8214b01Fd4Cf1d73FB1fb7cf9f811036Cb`, start block `1431636`.
   - Acceptance: Sentry-launched tokens resolve their pool/position and avoid false generic LP-lock failures.

3. Deepen NOXA V3 position metadata.
   - Current state: NOXA factory event detection marks known V3 launch-lock liquidity as locked.
   - Known addresses: factory `0xD9eC2db5f3D1b236843925949fe5bd8a3836FCcB`, locker `0x7F03effbd7ceB22A3f80Dd468f67eF27826acD85`, NFT manager `0x73991a25c818bf1f1128deaab1492d45638de0d3`.
   - Needed: position owner, liquidity, token0/token1, fee tier, collect/withdraw constraints if exposed.
   - Acceptance: evidence includes position-level metadata, not only launch event metadata.

4. Add extra DEXs only if product scope requires them.
   - Current state: Uniswap V2 and PancakeSwap V2 are configured.
   - Candidate Robinhood DEXs from public listings include Uniswap V3/V4, Pancake V3, Sheriff V2/V3, Curve, AEON.
   - Acceptance: each added DEX has verified factory/router/quoter details and tests or safe failure behavior.

5. Complete scam-template detection.
   - Current state: module exists as a stub/baseline.
   - Needed: template table, bytecode/source fingerprints, similarity matching, admin import flow.
   - Backend files: `backend/src/engine/modules/scam-template.ts`, `backend/src/db/schema.ts`.
   - Acceptance: known scam bytecode/source patterns materially affect module evidence and score.

6. Add source-code semantic analysis.
   - Current state: Blockscout source retrieval exists.
   - Needed: parse source for privileged functions, tax setters, blacklist controls, proxy/admin controls, obfuscated owner paths.
   - Acceptance: source analysis creates structured evidence and improves module confidence when source is verified.

7. Build indexer-grade wallet/funding graph.
   - Current state: Alchemy funding-origin tracing exists in several modules.
   - Needed: persisted holder snapshots, wallet PnL, sell-through, deeper sybil clustering, wallet history.
   - Acceptance: sniper/bundle/fresh-wallet modules can use historical wallet behavior instead of only near-launch traces.

## P1 Alerts And Operations

1. Add email/push/Telegram alert providers.
   - Current state: in-app/webhook delivery queue exists.
   - Needed: provider adapters, secrets, retry policies, user channel preferences.
   - Acceptance: alerts can deliver outside the app and failures are observable.

2. Add dead-letter and ops dashboard.
   - Current state: failed alert events are recorded, but there is no ops UI.
   - Needed: failed job listing, retry action, provider error grouping.
   - Acceptance: an operator can inspect and retry failed deliveries without Redis/DB shell access.

3. Add SSE/WebSocket live updates if required.
   - Current state: backend discovery worker exists; frontend uses polling/query hooks.
   - Needed: streaming endpoint, auth-aware subscriptions, frontend live indicators.
   - Acceptance: Pulse/watchlist/alerts update without manual refresh.

## P2 Frontend Product Completion

1. Wire crew page to real team data.
   - Current state: account reflects backend user/tier/session; crew is still mostly placeholder/local state.
   - Acceptance: crew reflects team membership once team model exists.

2. Replace remaining decorative/static surfaces where product scope requires live data.
   - Remaining mock source is mostly `frontend/src/components/scan/HeroTerminal.tsx` using `frontend/src/lib/mock-data.ts` for animated demo copy.
   - Marketing blog/field notes are static content by design unless CMS is added.
   - Acceptance: no app-critical route presents fake token/deployer/wallet data as live.

3. Continue route UX polish.
   - Current state: app-level loading/error UI exists, and scan detail calls out gated/rate-limited results.
   - Needed: richer skeletons per route and more tailored empty states.
   - Acceptance: failed/partial backend responses are clear and recoverable.

4. Deepen wallet rap sheet data.
   - Current state: wallet page reads persisted wallet labels/rugs/PnL fields when available.
   - Needed: populate those fields from the indexer-grade wallet/funding graph.
   - Acceptance: wallet pages show meaningful labels/rugs/PnL for real observed wallets.

## P2 Infrastructure And Verification

1. Add API/scanner integration tests.
   - Current state: unit tests cover scoring and product tier rules.
   - Needed: route tests for auth/session/API-key paths, scanner with mocked RPC, persistence with test Postgres/Redis.
   - Acceptance: CI can validate core API behavior without real chain dependencies.

2. Verify migrations against clean local Postgres.
   - Current state: Supabase migrations were applied; Docker compose exists.
   - Needed: documented clean-room migration run from empty DB.
   - Acceptance: `docker compose up -d && cd backend && npm run migrate` works from scratch.

3. Keep deployment/secret checklist current.
   - Current state: `PRODUCTION_DEPLOYMENT_CHECKLIST.md` exists.
   - Acceptance: any new provider/integration updates the checklist with public vs secret env vars.

## Verification Commands

Use the clean path for frontend builds because the original folder name contains `#`, which can break Next tooling.

```bash
cd /Users/0xhardhat/Downloads/Hood-Terminal-Product-Design/backend
npm run build
npm test

cd /Users/0xhardhat/Downloads/Hood-Terminal-Product-Design/frontend
npm run lint
npm run build
npx playwright test --list
```

Known frontend build warnings are currently from optional Privy/MetaMask dependencies:

- `@react-native-async-storage/async-storage`
- `@stripe/crypto`
- `@farcaster/mini-app-solana`
- dynamic Tempo import warning from `ox`

These warnings are non-fatal in the clean path build.
