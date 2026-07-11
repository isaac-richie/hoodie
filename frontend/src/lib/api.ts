export type BackendRiskBand = "low" | "some_risk" | "high" | "extreme";
export type Confidence = "high" | "medium" | "low";
export type ModuleStatus = "pass" | "warn" | "fail" | "timeout" | "error";

export interface ApiErrorBody {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ModuleCategory = "security" | "holders" | "launch" | "liquidity" | "creator" | "social" | "meta";

export interface ModuleResult {
  module: string;
  category?: ModuleCategory;
  status: ModuleStatus;
  score: number;
  weight: number;
  label: string;
  detail: string;
  evidence: Record<string, unknown>;
  durationMs: number;
}

export interface ScanResult {
  tokenAddress: `0x${string}`;
  tokenName?: string;
  tokenSymbol?: string;
  score: number;
  band: BackendRiskBand;
  confidence: Confidence;
  modulesRan: number;
  modulesTotal: number;
  moduleResults: ModuleResult[];
  summary: string;
  durationMs: number;
  timestamp: number;
}

export interface TokenSummary {
  address: string;
  name: string | null;
  symbol: string | null;
  status: string | null;
  deployer: string | null;
  latestScore: number | null;
  latestBand: BackendRiskBand | "rugged" | null;
  totalScans: number | null;
  updatedAt: string | null;
  createdAt: string | null;
}

export interface DeployerSummary {
  address: string;
  totalLaunches: number | null;
  confirmedRugs: number | null;
  survivalRate30d: number | null;
  medianTokenLife: number | null;
  isSerialRug: boolean | null;
  firstSeen: string | null;
  lastLaunch: string | null;
  updatedAt: string | null;
}

export interface WalletRap {
  address: string;
  labels: string[] | null;
  isRepeatOffender: boolean | null;
  confirmedRugs: number | null;
  tokensAppearedIn: number | null;
  realizedPnl30d: number | null;
  winRate30d: number | null;
  firstSeen: string | null;
  updatedAt: string | null;
}

export interface RpcStats {
  calls: number;
  cacheHits: number;
  hitRate: number;
  callsPerSecond: number;
  uptimeSeconds: number;
}

export interface ChainStats {
  configuredChainId: number;
  rpcChainId: number | null;
  rpcReachable: boolean;
  matchesConfigured: boolean;
  dexFactoriesConfigured: number;
  quoteTokensConfigured: number;
  lpLockersConfigured: number;
  launchpadsConfigured: number;
  error?: string;
}

export interface UserRecord {
  id: string;
  walletAddress: string | null;
  email: string | null;
  displayName: string | null;
  tier: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface ApiKeyRecord {
  id: string;
  userId: string;
  name: string | null;
  keyPrefix: string;
  scopes: string[] | null;
  tier: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string | null;
}

export interface CreatedApiKey extends ApiKeyRecord {
  key: string;
}

export interface WatchlistItem {
  id: string;
  userId: string;
  tokenAddress: string;
  note: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface AlertRecord {
  id: string;
  userId: string;
  targetAddress: string;
  triggerType: string;
  threshold: number | null;
  deliveryChannels: string[] | null;
  webhookUrl: string | null;
  isActive: boolean | null;
  lastFiredAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface AlertEventRecord {
  id: string;
  alertId: string;
  userId: string;
  targetAddress: string;
  channel: string;
  status: string;
  payload: Record<string, unknown> | null;
  error: string | null;
  createdAt: string | null;
}

export interface WalletNonceResponse {
  walletAddress: string;
  nonce: string;
  message: string;
  expiresIn: number;
}

export interface WalletVerifyResponse {
  user: UserRecord;
  verified: true;
}

export interface SessionResponse {
  user: UserRecord | null;
  session: {
    userId: string;
    walletAddress?: string;
    tier: string;
    scopes: string[];
    iat: number;
    exp: number;
  };
}

export class ApiClientError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// NEXT_PUBLIC_* is inlined at build time. If NEXT_PUBLIC_API_URL isn't set when
// `next build` runs, every request would silently point at localhost and the whole
// production site would fail with no clue why. Fail the build loudly instead, and
// only fall back to localhost in development.
function resolveApiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "NEXT_PUBLIC_API_URL is not set. It must be defined at build time for production — " +
        "otherwise the deployed site points every request at localhost. Set it before running `next build`."
    );
  }

  return "http://localhost:3001";
}

const API_BASE_URL = resolveApiBaseUrl();

export async function apiGet<T>(path: string): Promise<T> {
  return apiRequest<T>(path);
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const needsCsrfHeader = method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(needsCsrfHeader ? { "X-Hood-CSRF": "1" } : {}),
      ...(init.headers || {}),
    },
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok && response.status !== 206) {
    const apiError = payload as ApiErrorBody | null;
    throw new ApiClientError(
      response.status,
      apiError?.error?.code || "REQUEST_FAILED",
      apiError?.error?.message || "Request failed",
      apiError?.error?.details
    );
  }

  return payload as T;
}

export function apiPost<T>(path: string, body: unknown): Promise<T> {
  return apiRequest<T>(path, { method: "POST", body: JSON.stringify(body) });
}

export function apiPatch<T>(path: string, body: unknown): Promise<T> {
  return apiRequest<T>(path, { method: "PATCH", body: JSON.stringify(body) });
}

export function apiDelete<T>(path: string): Promise<T> {
  return apiRequest<T>(path, { method: "DELETE" });
}

export function getTokenScan(address: string) {
  return apiGet<ScanResult>(`/v1/scan/${address}`);
}

export function getPulse() {
  return apiGet<{ tokens: TokenSummary[] }>("/v1/pulse");
}

export function getDeployers() {
  return apiGet<{ deployers: DeployerSummary[] }>("/v1/deployers");
}

export function getDeployer(address: string) {
  return apiGet<{ address: string; deployer: DeployerSummary | null; launches: TokenSummary[] }>(
    `/v1/deployer/${address}`
  );
}

export function getWalletRap(address: string) {
  return apiGet<{ address: string; wallet: WalletRap | null }>(`/v1/wallet/${address}`);
}

export function getRpcStats() {
  return apiGet<RpcStats>("/v1/stats/rpc");
}

export function getChainStats() {
  return apiGet<ChainStats>("/v1/stats/chain");
}

export function upsertUser(input: { id?: string; walletAddress?: string; displayName?: string; email?: string }) {
  return apiPost<{ user: UserRecord }>("/v1/users", input);
}

export function getApiKeys(userId: string) {
  return apiGet<{ keys: ApiKeyRecord[] }>(`/v1/api-keys?userId=${encodeURIComponent(userId)}`);
}

export function createApiKey(input: { userId: string; name?: string; tier?: string; scopes?: string[] }) {
  return apiPost<CreatedApiKey>("/v1/api-keys", input);
}

export function revokeApiKey(id: string) {
  return apiDelete<{ revoked: true; id: string }>(`/v1/api-keys/${id}`);
}

export function getWatchlist(userId: string) {
  return apiGet<{ items: WatchlistItem[] }>(`/v1/users/${encodeURIComponent(userId)}/watchlist`);
}

export function addWatchlistItem(userId: string, input: { tokenAddress: string; note?: string }) {
  return apiPost<{ item: WatchlistItem }>(`/v1/users/${encodeURIComponent(userId)}/watchlist`, input);
}

export function removeWatchlistItem(userId: string, tokenAddress: string) {
  return apiDelete<{ removed: true }>(
    `/v1/users/${encodeURIComponent(userId)}/watchlist/${encodeURIComponent(tokenAddress)}`
  );
}

export function getAlerts(userId: string) {
  return apiGet<{ alerts: AlertRecord[] }>(`/v1/users/${encodeURIComponent(userId)}/alerts`);
}

export function getAlertEvents(userId: string) {
  return apiGet<{ events: AlertEventRecord[] }>(`/v1/users/${encodeURIComponent(userId)}/alert-events`);
}

export function createAlert(
  userId: string,
  input: {
    targetAddress: string;
    triggerType: string;
    threshold?: number;
    deliveryChannels?: string[];
    webhookUrl?: string;
    isActive?: boolean;
  }
) {
  return apiPost<{ alert: AlertRecord }>(`/v1/users/${encodeURIComponent(userId)}/alerts`, input);
}

export function updateAlert(alertId: string, input: Partial<AlertRecord>) {
  return apiPatch<{ alert: AlertRecord }>(`/v1/alerts/${alertId}`, input);
}

export function deleteAlert(alertId: string) {
  return apiDelete<{ deleted: true }>(`/v1/alerts/${alertId}`);
}

export function getWalletNonce(walletAddress: string) {
  return apiPost<WalletNonceResponse>("/v1/auth/wallet/nonce", { walletAddress });
}

export function verifyWalletSignature(input: { walletAddress: string; signature: string }) {
  return apiPost<WalletVerifyResponse>("/v1/auth/wallet/verify", input);
}

export function getSession() {
  return apiGet<SessionResponse>("/v1/auth/session");
}

export function logoutSession() {
  return apiPost<{ loggedOut: true }>("/v1/auth/logout", {});
}
