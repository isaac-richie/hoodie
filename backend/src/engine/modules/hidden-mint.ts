/**
 * Hidden Mint Detection (weight: 11) — can the owner mint unlimited tokens?
 *
 * Scans contract bytecode for mint function selectors (mint, mintTo variants).
 * If a mint function exists AND the bytecode contains the owner() selector,
 * we flag it as owner-callable mint — they can inflate supply and dump.
 *
 * This is a heuristic based on selector presence in bytecode, not full
 * decompilation. A mint function behind a timelock or governance would still
 * get flagged — false positives are acceptable for a risk scanner.
 *
 * Score: 0 = no mint, 50 = mint exists (access unclear), 75 = owner-callable.
 */
import { cachedRpc } from "../../services/rpc-cache.js";
import type { ScanModule, ScanContext, ModuleResult } from "../types.js";

export const hiddenMintModule: ScanModule = {
  name: "hidden_mint",
  weight: 11,
  category: "security",

  async run(ctx: ScanContext): Promise<ModuleResult> {
    const start = Date.now();

    try {
      const mintInfo = await checkMintFunction(ctx);

      let score: number;
      let status: "pass" | "warn" | "fail";
      let label: string;

      if (mintInfo.mintReachable && mintInfo.mintByOwner) {
        score = 75;
        status = "fail";
        label = "mint function reachable by owner";
      } else if (mintInfo.mintReachable) {
        score = 50;
        status = "warn";
        label = "mint function exists but access unclear";
      } else {
        score = 0;
        status = "pass";
        label = "no mint function or mint disabled";
      }

      return {
        module: "hidden_mint",
        status,
        score,
        weight: 11,
        label,
        detail: mintInfo.mintReachable
          ? `Mint function found. Callable by: ${mintInfo.caller ?? "unknown"}.`
          : "No accessible mint function detected in bytecode.",
        evidence: mintInfo,
        durationMs: Date.now() - start,
      };
    } catch (err) {
      return {
        module: "hidden_mint",
        status: "error",
        score: 30,
        weight: 11,
        label: "mint check failed",
        detail: (err as Error).message,
        evidence: {},
        durationMs: Date.now() - start,
      };
    }
  },
};

interface MintInfo {
  mintReachable: boolean;
  mintByOwner: boolean;
  caller?: string;
}

async function checkMintFunction(ctx: ScanContext): Promise<MintInfo> {
  // Get contract bytecode and check for mint-related selectors
  const bytecode = await cachedRpc.getCode(ctx.tokenAddress);

  if (!bytecode) return { mintReachable: false, mintByOwner: false };

  // Common mint selectors
  const mintSelectors = [
    "40c10f19", // mint(address,uint256)
    "a0712d68", // mint(uint256)
    "4e6ec247", // mint(address,uint256) variant
    "d1058e59", // mintTo(address)
  ];

  const hasMint = mintSelectors.some((sel) => bytecode.includes(sel));

  if (!hasMint) return { mintReachable: false, mintByOwner: false };

  // Check if mint is behind onlyOwner by looking for owner() check pattern
  // This is a heuristic — full analysis would require decompilation
  const hasOwnerCheck = bytecode.includes("8da5cb5b"); // owner() selector in bytecode

  return {
    mintReachable: true,
    mintByOwner: hasOwnerCheck,
    caller: hasOwnerCheck ? "owner" : "unknown",
  };
}
