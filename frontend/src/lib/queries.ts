"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAddress } from "viem";
import {
  addWatchlistItem,
  createAlert,
  createApiKey,
  deleteAlert,
  getAlertEvents,
  getAlerts,
  getApiKeys,
  getChainStats,
  getDeployer,
  getDeployers,
  getPulse,
  getRpcStats,
  getSession,
  getTokenScan,
  getWalletRap,
  getWatchlist,
  removeWatchlistItem,
  revokeApiKey,
  upsertUser,
} from "@/lib/api";

export function useTokenScan(address: string | undefined) {
  const normalized = address?.trim();
  const queryClient = useQueryClient();
  const key = ["token-scan", normalized?.toLowerCase()];

  const query = useQuery({
    queryKey: key,
    queryFn: () => getTokenScan(normalized as `0x${string}`),
    enabled: Boolean(normalized && isAddress(normalized)),
    retry: 1,
    staleTime: 30_000,
  });

  // A plain refetch would return the backend's cached result and look like a
  // no-op. rescan() forces the engine to bypass its cache and run all modules
  // again, then swaps the fresh result into the query cache.
  const rescan = useMutation({
    mutationFn: () => getTokenScan(normalized as `0x${string}`, true),
    onSuccess: (result) => queryClient.setQueryData(key, result),
  });

  return { ...query, rescan };
}

export function usePulse() {
  return useQuery({
    queryKey: ["pulse"],
    queryFn: getPulse,
    staleTime: 15_000,
    retry: 1,
  });
}

export function useDeployers() {
  return useQuery({
    queryKey: ["deployers"],
    queryFn: getDeployers,
    staleTime: 30_000,
    retry: 1,
  });
}

export function useDeployer(address: string | undefined) {
  const normalized = address?.trim();

  return useQuery({
    queryKey: ["deployer", normalized?.toLowerCase()],
    queryFn: () => getDeployer(normalized as `0x${string}`),
    enabled: Boolean(normalized && isAddress(normalized)),
    staleTime: 30_000,
    retry: 1,
  });
}

export function useWalletRap(address: string | undefined) {
  const normalized = address?.trim();

  return useQuery({
    queryKey: ["wallet-rap", normalized?.toLowerCase()],
    queryFn: () => getWalletRap(normalized as `0x${string}`),
    enabled: Boolean(normalized && isAddress(normalized)),
    staleTime: 30_000,
    retry: 1,
  });
}

export function useRpcStats() {
  return useQuery({
    queryKey: ["rpc-stats"],
    queryFn: getRpcStats,
    staleTime: 10_000,
    retry: 1,
  });
}

export function useChainStats() {
  return useQuery({
    queryKey: ["chain-stats"],
    queryFn: getChainStats,
    staleTime: 10_000,
    retry: 1,
  });
}

export function useSession(enabled = true) {
  return useQuery({
    queryKey: ["session"],
    queryFn: getSession,
    enabled,
    staleTime: 60_000,
    retry: false,
  });
}

export function useApiKeys(userId: string | undefined) {
  return useQuery({
    queryKey: ["api-keys", userId],
    queryFn: () => getApiKeys(userId as string),
    enabled: Boolean(userId),
    staleTime: 15_000,
    retry: 1,
  });
}

export function useCreateApiKey(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { name?: string; tier?: string; scopes?: string[] }) =>
      createApiKey({ userId: userId as string, ...input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys", userId] });
    },
  });
}

export function useRevokeApiKey(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => revokeApiKey(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys", userId] });
    },
  });
}

export function useEnsureUser() {
  return useMutation({
    mutationFn: upsertUser,
  });
}

export function useWatchlist(userId: string | undefined) {
  return useQuery({
    queryKey: ["watchlist", userId],
    queryFn: () => getWatchlist(userId as string),
    enabled: Boolean(userId),
    staleTime: 15_000,
    retry: 1,
  });
}

export function useAddWatchlistItem(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { tokenAddress: string; note?: string }) => addWatchlistItem(userId as string, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watchlist", userId] });
    },
  });
}

export function useRemoveWatchlistItem(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (tokenAddress: string) => removeWatchlistItem(userId as string, tokenAddress),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watchlist", userId] });
    },
  });
}

export function useAlerts(userId: string | undefined) {
  return useQuery({
    queryKey: ["alerts", userId],
    queryFn: () => getAlerts(userId as string),
    enabled: Boolean(userId),
    staleTime: 15_000,
    retry: 1,
  });
}

export function useAlertEvents(userId: string | undefined) {
  return useQuery({
    queryKey: ["alert-events", userId],
    queryFn: () => getAlertEvents(userId as string),
    enabled: Boolean(userId),
    staleTime: 10_000,
    retry: 1,
  });
}

export function useCreateAlert(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      targetAddress: string;
      triggerType: string;
      threshold?: number;
      deliveryChannels?: string[];
      webhookUrl?: string;
      isActive?: boolean;
    }) => createAlert(userId as string, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts", userId] });
    },
  });
}

export function useDeleteAlert(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (alertId: string) => deleteAlert(alertId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts", userId] });
      queryClient.invalidateQueries({ queryKey: ["alert-events", userId] });
    },
  });
}
