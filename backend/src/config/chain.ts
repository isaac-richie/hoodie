/**
 * Robinhood Chain — viem chain definition.
 *
 * This is the only place the chain is defined. Every RPC client across
 * the codebase imports this. When the chain ID or explorer URL changes,
 * update it here and everything follows.
 */
import { defineChain } from "viem";
import { env } from "./env.js";

export const robinhoodChain = defineChain({
  id: env.chainId,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [env.rpcUrl] },
    alchemy: { http: [env.rpcUrl], webSocket: [env.rpcWss] },
  },
  blockExplorers: {
    default: { name: "Robinhood Chain Blockscout", url: "https://robinhoodchain.blockscout.com" },
  },
});
