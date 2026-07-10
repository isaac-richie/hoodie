"use client";

import { PrivyProvider, type PrivyClientConfig } from "@privy-io/react-auth";
import { WagmiProvider as PrivyWagmiProvider } from "@privy-io/wagmi";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { robinhoodChain, wagmiConfig } from "@/lib/wagmi";

const queryClient = new QueryClient();
const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

const privyConfig: PrivyClientConfig = {
  loginMethods: ["wallet", "email", "passkey"],
  supportedChains: [robinhoodChain],
  defaultChain: robinhoodChain,
  appearance: {
    theme: "dark",
    accentColor: "#00C805",
    landingHeader: "Enter Hood Terminal",
    loginMessage: "Connect or create a wallet to arm your terminal.",
    showWalletLoginFirst: true,
    walletChainType: "ethereum-only",
  },
  embeddedWallets: {
    ethereum: {
      createOnLogin: "users-without-wallets",
    },
  },
};

export function Web3Provider({ children }: { children: React.ReactNode }) {
  if (!privyAppId) {
    return (
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </WagmiProvider>
    );
  }

  return (
    <PrivyProvider appId={privyAppId} config={privyConfig}>
      <QueryClientProvider client={queryClient}>
        <PrivyWagmiProvider config={wagmiConfig}>{children}</PrivyWagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
