/**
 * Trading Pause Detection (weight: 6) — can trading be frozen globally?
 *
 * Scans bytecode for pause/unpause/enableTrading selectors. Unlike blacklist
 * (which targets individual wallets), a pause function freezes ALL transfers.
 * Common in legitimate tokens during migration, but also used in rugs to
 * prevent selling after a pump.
 *
 * Score: 0 = no pause function, 30 = pause function found.
 */
import { cachedRpc } from "../../services/rpc-cache.js";
import type { ScanModule, ScanContext, ModuleResult } from "../types.js";

export const tradingPauseModule: ScanModule = {
  name: "trading_pause",
  weight: 6,
  category: "security",

  async run(ctx: ScanContext): Promise<ModuleResult> {
    const start = Date.now();

    const bytecode = await cachedRpc.getCode(ctx.tokenAddress);
    if (!bytecode) {
      return {
        module: "trading_pause",
        status: "error",
        score: 20,
        weight: 6,
        label: "bytecode unavailable",
        detail: "",
        evidence: {},
        durationMs: Date.now() - start,
      };
    }

    // Check for pause selectors
    const pauseSelectors = [
      "8456cb59", // pause()
      "3f4ba83a", // unpause()
      "5c975abb", // paused()
      "16c38b3c", // enableTrading()
    ];

    const hasPause = pauseSelectors.some((sel) => bytecode.includes(sel));

    return {
      module: "trading_pause",
      status: hasPause ? "warn" : "pass",
      score: hasPause ? 30 : 0,
      weight: 6,
      label: hasPause ? "trading pause function found" : "none found",
      detail: hasPause
        ? "Contract can pause trading. Owner may freeze all sells."
        : "No trading pause pattern detected.",
      evidence: { hasPause },
      durationMs: Date.now() - start,
    };
  },
};
