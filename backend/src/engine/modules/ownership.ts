/**
 * Ownership Check (weight: 8) — is ownership renounced?
 *
 * Calls the owner() function selector (0x8da5cb5b) via eth_call.
 * If the owner is the zero address, ownership has been renounced — the contract
 * is immutable and no admin functions can be called. If the owner is the deployer,
 * it's riskier because the same wallet that created the token still controls it.
 *
 * Score: 0 = renounced, 25 = owned by non-deployer, 40 = owned by deployer.
 */
import { cachedRpc } from "../../services/rpc-cache.js";
import type { ScanModule, ScanContext, ModuleResult } from "../types.js";
import { getAddress } from "viem";

const OWNER_SELECTORS = [
  "0x8da5cb5b", // owner()
  "0x715018a6", // renounceOwnership()
] as const;

export const ownershipModule: ScanModule = {
  name: "ownership",
  weight: 8,
  category: "security",

  async run(ctx: ScanContext): Promise<ModuleResult> {
    const start = Date.now();

    try {
      const ownership = await checkOwnership(ctx);

      let score: number;
      let status: "pass" | "warn" | "fail";
      let label: string;

      if (ownership.renounced) {
        score = 0;
        status = "pass";
        label = "ownership renounced";
      } else if (ownership.owner === ctx.deployerAddress) {
        score = 40;
        status = "warn";
        label = "not renounced · owner is deployer";
      } else if (ownership.owner) {
        score = 25;
        status = "warn";
        label = `not renounced · owner ${ownership.owner.slice(0, 6)}…${ownership.owner.slice(-4)}`;
      } else {
        score = 10;
        status = "pass";
        label = "no owner function found";
      }

      return {
        module: "ownership",
        status,
        score,
        weight: 8,
        label,
        detail: ownership.renounced
          ? "Owner has been set to zero address."
          : `Current owner: ${ownership.owner ?? "none"}`,
        evidence: ownership,
        durationMs: Date.now() - start,
      };
    } catch (err) {
      return {
        module: "ownership",
        status: "error",
        score: 30,
        weight: 8,
        label: "ownership check failed",
        detail: (err as Error).message,
        evidence: {},
        durationMs: Date.now() - start,
      };
    }
  },
};

interface OwnershipInfo {
  owner: string | null;
  renounced: boolean;
}

async function checkOwnership(ctx: ScanContext): Promise<OwnershipInfo> {
  try {
    const ownerResult = await cachedRpc.call({
      to: ctx.tokenAddress,
      data: OWNER_SELECTORS[0], // owner()
    });

    if (!ownerResult.data || ownerResult.data === "0x") {
      return { owner: null, renounced: false };
    }

    // Decode address from the returned data
    const ownerHex = "0x" + ownerResult.data.slice(26);
    const isZero =
      ownerHex === "0x0000000000000000000000000000000000000000";

    return {
      owner: isZero ? null : getAddress(ownerHex),
      renounced: isZero,
    };
  } catch {
    return { owner: null, renounced: false };
  }
}
