/**
 * Core Types for the Scan Engine
 *
 * RiskBand: final risk classification shown to users (0-25 low → 76-100 extreme)
 * Confidence: how much of the scan completed (high = 95%+ modules ran)
 * ModuleResult: what each scan module returns — score, human-readable label, evidence
 * ScanContext: shared context passed to every module (token meta, deployer, LP, etc.)
 * ScanModule: interface every module implements — name, weight, category, run()
 *
 * Adding a new module? Implement ScanModule, register it in modules/registry.ts.
 * The scanner runs all modules in parallel and combines scores by weight.
 */
import type { Address } from "viem";
import type { LaunchpadInfo } from "../services/launchpad-resolver.js";

export type RiskBand = "low" | "some_risk" | "high" | "extreme";
export type Confidence = "high" | "medium" | "low";
export type ModuleStatus = "pass" | "warn" | "fail" | "timeout" | "error";

export interface ModuleResult {
  module: string;
  status: ModuleStatus;
  score: number; // contribution to total score (0-100 weighted)
  weight: number;
  label: string; // human-readable one-liner
  detail: string; // longer explanation
  evidence: object;
  durationMs: number;
}

export interface ScanContext {
  tokenAddress: Address;
  deployerAddress?: Address;
  deployBlock?: number;
  deployTx?: string;
  currentBlock: number;
  lpPool?: Address;
  lpPoolKind?: "dex_v2" | "launchpad_curve" | "launchpad_v3_locked";
  lpDex?: string;
  lpLiquidity?: number;
  launchpad?: LaunchpadInfo;
  totalSupply?: bigint;
  decimals?: number;
  symbol?: string;
  name?: string;
}

export interface ScanResult {
  tokenAddress: Address;
  score: number;
  band: RiskBand;
  confidence: Confidence;
  modulesRan: number;
  modulesTotal: number;
  moduleResults: ModuleResult[];
  summary: string;
  durationMs: number;
  timestamp: number;
}

export interface ScanModule {
  name: string;
  weight: number;
  category: "security" | "holders" | "launch" | "liquidity" | "creator" | "social" | "meta";
  run(ctx: ScanContext): Promise<ModuleResult>;
}
