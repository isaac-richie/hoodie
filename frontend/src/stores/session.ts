"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SessionState {
  apiKey?: string;
  walletAddress?: string;
  walletVerifiedAt?: number;
  userId?: string;
  tier?: string;
  setApiKey: (apiKey: string) => void;
  clearApiKey: () => void;
  setWalletVerified: (walletAddress: string, userId?: string, tier?: string) => void;
  clearWalletSession: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      apiKey: undefined,
      walletAddress: undefined,
      walletVerifiedAt: undefined,
      userId: undefined,
      tier: undefined,
      setApiKey: (apiKey) => set({ apiKey }),
      clearApiKey: () => set({ apiKey: undefined }),
      setWalletVerified: (walletAddress, userId, tier) =>
        set({
          walletAddress: walletAddress.toLowerCase(),
          walletVerifiedAt: Date.now(),
          userId: userId?.toLowerCase() ?? walletAddress.toLowerCase(),
          tier: tier ?? "free",
        }),
      clearWalletSession: () =>
        set({ walletAddress: undefined, walletVerifiedAt: undefined, userId: undefined, tier: undefined }),
    }),
    { name: "hood-session" }
  )
);
