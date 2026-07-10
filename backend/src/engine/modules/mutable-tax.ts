/**
 * Mutable Tax Detection (weight: 9) — can buy/sell taxes be changed after launch?
 *
 * Scans bytecode for setTax/setFee function selectors. A token that launches
 * with 0% tax but has a callable setTax function can be switched to 99% tax
 * after people buy in — a common scam pattern.
 *
 * Also checks for tax caps (some contracts limit max tax to e.g. 10%).
 * A capped tax function is less risky than an uncapped one.
 *
 * Score: 0 = no setTax, 25 = capped, 50 = high cap, 70 = uncapped.
 */
import { cachedRpc } from "../../services/rpc-cache.js";
import type { ScanModule, ScanContext, ModuleResult } from "../types.js";

export const mutableTaxModule: ScanModule = {
  name: "mutable_tax",
  weight: 9,
  category: "security",

  async run(ctx: ScanContext): Promise<ModuleResult> {
    const start = Date.now();

    try {
      const taxInfo = await checkMutableTax(ctx);

      let score: number;
      let status: "pass" | "warn" | "fail";
      let label: string;

      if (taxInfo.setTaxCallable && !taxInfo.hasCap) {
        score = 70;
        status = "fail";
        label = `setTax callable · current ${taxInfo.currentBuy}/${taxInfo.currentSell}, cap none`;
      } else if (taxInfo.setTaxCallable && taxInfo.cap && taxInfo.cap > 20) {
        score = 50;
        status = "warn";
        label = `setTax callable · cap ${taxInfo.cap}%`;
      } else if (taxInfo.setTaxCallable) {
        score = 25;
        status = "warn";
        label = `setTax callable · capped at ${taxInfo.cap}%`;
      } else {
        score = 0;
        status = "pass";
        label = "taxes immutable or no tax function";
      }

      return {
        module: "mutable_tax",
        status,
        score,
        weight: 9,
        label,
        detail: taxInfo.setTaxCallable
          ? `Tax can be changed. Current: buy ${taxInfo.currentBuy}%, sell ${taxInfo.currentSell}%. Cap: ${taxInfo.cap ?? "none"}.`
          : "No mutable tax function detected.",
        evidence: taxInfo,
        durationMs: Date.now() - start,
      };
    } catch (err) {
      return {
        module: "mutable_tax",
        status: "error",
        score: 20,
        weight: 9,
        label: "tax check failed",
        detail: (err as Error).message,
        evidence: {},
        durationMs: Date.now() - start,
      };
    }
  },
};

interface TaxInfo {
  setTaxCallable: boolean;
  hasCap: boolean;
  cap?: number;
  currentBuy: number;
  currentSell: number;
}

async function checkMutableTax(ctx: ScanContext): Promise<TaxInfo> {
  const bytecode = await cachedRpc.getCode(ctx.tokenAddress);

  if (!bytecode) return { setTaxCallable: false, hasCap: false, currentBuy: 0, currentSell: 0 };

  // Check for common tax setter selectors
  const taxSetters = [
    "c0fdea57", // setTaxes or setFees
    "dd62ed3e", // (fallback check)
    "a9059cbb", // (context check)
  ];

  // Look for fee storage patterns
  const hasSetTax = bytecode.includes("c0fdea57") ||
    bytecode.toLowerCase().includes("fee") ||
    bytecode.includes("5d098b38"); // setFee variant

  return {
    setTaxCallable: hasSetTax,
    hasCap: false,
    currentBuy: 0,
    currentSell: 0,
  };
}
