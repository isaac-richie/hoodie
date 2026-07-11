/**
 * Source Verification (weight: 5) — is the contract source public on explorer?
 *
 * Verified source is not a safety guarantee, but unverified bytecode makes manual
 * review harder and increases reliance on heuristic bytecode checks.
 */
import { getSourceVerification } from "../../services/explorer-source.js";
import { env } from "../../config/env.js";
import type { ScanModule, ScanContext, ModuleResult } from "../types.js";
import { friendlyError } from "../../utils/friendly-error.js";

export const sourceVerificationModule: ScanModule = {
  name: "source_verification",
  weight: 5,
  category: "meta",

  async run(ctx: ScanContext): Promise<ModuleResult> {
    const start = Date.now();

    try {
      if (!env.explorerApiUrl) {
        return {
          module: "source_verification",
          status: "warn",
          score: 15,
          weight: 5,
          label: "source verification unavailable",
          detail: "No explorer API URL is configured, so source verification could not be checked.",
          evidence: { explorerConfigured: false },
          durationMs: Date.now() - start,
        };
      }

      const source = await getSourceVerification(ctx.tokenAddress);

      if (!source.verified) {
        return {
          module: "source_verification",
          status: "warn",
          score: 25,
          weight: 5,
          label: "source code not verified",
          detail: "The explorer did not return verified source code. Bytecode heuristics still ran, but manual review is harder.",
          evidence: {
            explorerConfigured: true,
            verified: false,
            address: source.address,
          },
          durationMs: Date.now() - start,
        };
      }

      const isProxy = Boolean(source.proxy);
      return {
        module: "source_verification",
        status: isProxy ? "warn" : "pass",
        score: isProxy ? 15 : 0,
        weight: 5,
        label: isProxy ? "source verified proxy contract" : "source verified on explorer",
        detail: isProxy
          ? "The contract source is verified, but it is marked as a proxy. Review the implementation contract too."
          : "The explorer returned verified source code for this contract.",
        evidence: {
          explorerConfigured: true,
          verified: true,
          contractName: source.contractName,
          compilerVersion: source.compilerVersion,
          proxy: source.proxy,
          implementation: source.implementation,
          abiAvailable: Boolean(source.abi),
        },
        durationMs: Date.now() - start,
      };
    } catch (err) {
      return {
        module: "source_verification",
        status: "error",
        score: 10,
        weight: 5,
        label: "source verification check unavailable",
        detail: friendlyError(err, "source verification"),
        evidence: {},
        durationMs: Date.now() - start,
      };
    }
  },
};
