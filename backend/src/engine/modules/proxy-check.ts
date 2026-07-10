/**
 * Proxy Detection (weight: 10) — is this an upgradeable proxy contract?
 *
 * Checks the EIP-1967 implementation storage slot. If it contains a non-zero
 * address, the contract is a proxy — meaning the actual logic can be swapped
 * out at any time by the proxy admin. This makes ALL other checks unreliable
 * because the bytecode can change.
 *
 * EIP-1967 slot: keccak256("eip1967.proxy.implementation") - 1
 * = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc
 *
 * Score: 0 = not a proxy (immutable code), 65 = upgradeable proxy.
 */
import { cachedRpc } from "../../services/rpc-cache.js";
import type { ScanModule, ScanContext, ModuleResult } from "../types.js";

const EIP1967_IMPL_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

export const proxyCheckModule: ScanModule = {
  name: "proxy_check",
  weight: 10,
  category: "security",

  async run(ctx: ScanContext): Promise<ModuleResult> {
    const start = Date.now();

    try {
      const proxyInfo = await checkProxy(ctx);

      let score: number;
      let status: "pass" | "warn" | "fail";
      let label: string;

      if (proxyInfo.isProxy) {
        score = 65;
        status = "fail";
        label = "upgradeable proxy live · contract can change at any time";
      } else {
        score = 0;
        status = "pass";
        label = "not a proxy · code is immutable";
      }

      return {
        module: "proxy_check",
        status,
        score,
        weight: 10,
        label,
        detail: proxyInfo.isProxy
          ? `EIP-1967 proxy detected. Implementation: ${proxyInfo.implementation}.`
          : "No proxy pattern detected.",
        evidence: proxyInfo,
        durationMs: Date.now() - start,
      };
    } catch (err) {
      return {
        module: "proxy_check",
        status: "error",
        score: 20,
        weight: 10,
        label: "proxy check failed",
        detail: (err as Error).message,
        evidence: {},
        durationMs: Date.now() - start,
      };
    }
  },
};

interface ProxyInfo {
  isProxy: boolean;
  implementation?: string;
}

async function checkProxy(ctx: ScanContext): Promise<ProxyInfo> {
  // Check EIP-1967 implementation slot
  const implSlot = await cachedRpc.getStorageAt(
    ctx.tokenAddress,
    EIP1967_IMPL_SLOT as `0x${string}`,
    true // immutable — proxy slot doesn't change
  );

  if (implSlot && implSlot !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
    const implementation = "0x" + implSlot.slice(26);
    return { isProxy: true, implementation };
  }

  return { isProxy: false };
}
