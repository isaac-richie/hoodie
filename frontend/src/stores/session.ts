"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SessionState {
  walletAddress?: string;
  walletVerifiedAt?: number;
  userId?: string;
  tier?: string;
  setWalletVerified: (walletAddress: string, userId?: string, tier?: string) => void;
  clearWalletSession: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      walletAddress: undefined,
      walletVerifiedAt: undefined,
      userId: undefined,
      tier: undefined,
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
    {
      name: "hood-session",
      // Never persist API secrets. This store only keeps non-secret wallet UI
      // hints; the backend session cookie remains the source of truth.
      partialize: ({ walletAddress, walletVerifiedAt, userId, tier }) => ({
        walletAddress,
        walletVerifiedAt,
        userId,
        tier,
      }),
    }
  )
);
