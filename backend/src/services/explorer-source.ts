import type { Address } from "viem";
import { env } from "../config/env.js";
import { redis } from "../config/redis.js";

export interface SourceVerification {
  address: Address;
  verified: boolean;
  contractName?: string;
  compilerVersion?: string;
  proxy?: boolean;
  implementation?: string;
  abi?: unknown;
  sourceCode?: string;
}

const CACHE_PREFIX = "source:";

export async function getSourceVerification(address: Address): Promise<SourceVerification> {
  const normalized = address.toLowerCase() as Address;
  const cached = await redis.get(`${CACHE_PREFIX}${normalized}`);
  if (cached) return JSON.parse(cached);

  if (!env.explorerApiUrl) {
    return { address: normalized, verified: false };
  }

  const url = new URL(env.explorerApiUrl.replace(/\/$/, "") + "/api");
  url.searchParams.set("module", "contract");
  url.searchParams.set("action", "getsourcecode");
  url.searchParams.set("address", normalized);
  if (env.explorerApiKey) url.searchParams.set("apikey", env.explorerApiKey);

  const response = await fetch(url);
  const data = (await response.json()) as {
    status?: string;
    result?: {
      SourceCode?: string;
      ABI?: string;
      ContractName?: string;
      CompilerVersion?: string;
      Proxy?: string;
      Implementation?: string;
    }[];
  };

  const result = data.result?.[0];
  const sourceCode = result?.SourceCode || "";
  const verification: SourceVerification = {
    address: normalized,
    verified: Boolean(sourceCode && sourceCode !== "Contract source code not verified"),
    contractName: result?.ContractName || undefined,
    compilerVersion: result?.CompilerVersion || undefined,
    proxy: result?.Proxy === "1",
    implementation: result?.Implementation || undefined,
    abi: parseAbi(result?.ABI),
    sourceCode: sourceCode || undefined,
  };

  await redis.setex(`${CACHE_PREFIX}${normalized}`, 3600, JSON.stringify(verification));
  return verification;
}

function parseAbi(abi: string | undefined): unknown {
  if (!abi || abi === "Contract source code not verified") return undefined;
  try {
    return JSON.parse(abi);
  } catch {
    return undefined;
  }
}
