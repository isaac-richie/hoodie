/**
 * Blacklist Detection (weight: 7) — can the owner block specific wallets from selling?
 *
 * Scans bytecode for blacklist/whitelist function selectors. If present, the
 * owner can target individual wallets and prevent them from transferring tokens.
 * Often used to block DEX bots, but also abused to trap buyers.
 *
 * Score: 0 = no blacklist, 35 = blacklist function found.
 */
import { cachedRpc } from "../../services/rpc-cache.js";
import type { ScanModule, ScanContext, ModuleResult } from "../types.js";

export const blacklistModule: ScanModule = {
  name: "blacklist",
  weight: 7,
  category: "security",

  async run(ctx: ScanContext): Promise<ModuleResult> {
    const start = Date.now();

    const bytecode = await cachedRpc.getCode(ctx.tokenAddress);
    if (!bytecode) {
      return {
        module: "blacklist",
        status: "error",
        score: 30,
        weight: 7,
        label: "could not read bytecode",
        detail: "Contract bytecode unavailable.",
        evidence: {},
        durationMs: Date.now() - start,
      };
    }

    // Check for blacklist/whitelist function selectors
    const blacklistSelectors = [
      "44337ea1", // blacklist(address)
      "537df3b6", // isBlacklisted(address)
      "e4997dc5", // removeBlacklist(address)
      "f9f92be4", // blacklistAddress(address)
    ];

    const hasBlacklist = blacklistSelectors.some((sel) => bytecode.includes(sel));

    return {
      module: "blacklist",
      status: hasBlacklist ? "warn" : "pass",
      score: hasBlacklist ? 35 : 0,
      weight: 7,
      label: hasBlacklist ? "blacklist function found" : "none found",
      detail: hasBlacklist
        ? "Contract contains blacklist functionality. Holders can be blocked from selling."
        : "No blacklist pattern detected in bytecode.",
      evidence: { hasBlacklist },
      durationMs: Date.now() - start,
    };
  },
};
