"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ScanHistoryItem {
  address: string;
  score: number;
  band: string;
  scannedAt: number;
}

interface ScanHistoryState {
  items: ScanHistoryItem[];
  record: (item: ScanHistoryItem) => void;
  clear: () => void;
}

export const useScanHistoryStore = create<ScanHistoryState>()(
  persist(
    (set) => ({
      items: [],
      record: (item) =>
        set((state) => {
          const normalized = item.address.toLowerCase();
          const withoutExisting = state.items.filter((entry) => entry.address !== normalized);
          return {
            items: [{ ...item, address: normalized }, ...withoutExisting].slice(0, 50),
          };
        }),
      clear: () => set({ items: [] }),
    }),
    { name: "hood-scan-history" }
  )
);
