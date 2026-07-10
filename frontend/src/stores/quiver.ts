"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface QuiverState {
  addresses: string[];
  add: (address: string) => void;
  remove: (address: string) => void;
  has: (address: string) => boolean;
}

export const useQuiverStore = create<QuiverState>()(
  persist(
    (set, get) => ({
      addresses: [],
      add: (address) =>
        set((state) => {
          const normalized = address.toLowerCase();
          if (state.addresses.includes(normalized)) return state;
          return { addresses: [normalized, ...state.addresses].slice(0, 100) };
        }),
      remove: (address) =>
        set((state) => ({
          addresses: state.addresses.filter((item) => item !== address.toLowerCase()),
        })),
      has: (address) => get().addresses.includes(address.toLowerCase()),
    }),
    { name: "hood-quiver" }
  )
);
