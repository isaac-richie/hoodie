"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { isAddress } from "viem";
import { useAccount } from "wagmi";
import { ApiClientError } from "@/lib/api";
import { useAddWatchlistItem, useAlertEvents, useCreateAlert, useEnsureUser, useRemoveWatchlistItem, useWatchlist } from "@/lib/queries";
import { useQuiverStore } from "@/stores/quiver";

const TRIGGERS = [
  { label: "scan complete", value: "scan_complete" },
  { label: "score above threshold", value: "score_above" },
  { label: "high risk band", value: "band_high" },
  { label: "extreme risk band", value: "band_extreme" },
];

function short(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function panel(): React.CSSProperties {
  return { background: "#0D2A19", border: "1px solid #164A2A" };
}

export default function QuiverPage() {
  const { address, isConnected } = useAccount();
  const userId = address?.toLowerCase();
  const [tokenAddress, setTokenAddress] = useState("");
  const [note, setNote] = useState("");
  const [alertTarget, setAlertTarget] = useState("");
  const [triggerType, setTriggerType] = useState("band_extreme");
  const [threshold, setThreshold] = useState(75);
  const ensureUser = useEnsureUser();
  const ensureUserMutate = ensureUser.mutate;
  const watchlist = useWatchlist(userId);
  const addWatch = useAddWatchlistItem(userId);
  const removeWatch = useRemoveWatchlistItem(userId);
  const createAlert = useCreateAlert(userId);
  const events = useAlertEvents(userId);
  const localAdd = useQuiverStore((state) => state.add);
  const localRemove = useQuiverStore((state) => state.remove);

  useEffect(() => {
    if (!userId || ensureUser.isPending) return;
    ensureUserMutate({ id: userId, walletAddress: userId });
  }, [userId, ensureUser.isPending, ensureUserMutate]);

  const selectedAlertTarget = alertTarget || watchlist.data?.items[0]?.tokenAddress || "";

  async function addMark() {
    const normalized = tokenAddress.trim();
    if (!userId || !isAddress(normalized)) return;
    const result = await addWatch.mutateAsync({ tokenAddress: normalized, note: note.trim() || undefined });
    localAdd(result.item.tokenAddress);
    setTokenAddress("");
    setNote("");
  }

  async function removeMark(addressToRemove: string) {
    if (!userId) return;
    await removeWatch.mutateAsync(addressToRemove);
    localRemove(addressToRemove);
  }

  async function armAlert() {
    if (!userId || !isAddress(selectedAlertTarget)) return;
    await createAlert.mutateAsync({
      targetAddress: selectedAlertTarget,
      triggerType,
      threshold: triggerType === "score_above" ? threshold : undefined,
      deliveryChannels: ["in_app"],
    });
  }

  const error = watchlist.error || addWatch.error || removeWatch.error || createAlert.error || events.error;

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 24, fontWeight: 700 }}>The Quiver</span>
          <span style={{ fontSize: 10, color: "#496552", border: "1px solid #164A2A", padding: "2px 8px", borderRadius: 3, letterSpacing: "0.06em" }}>Watchlist</span>
        </div>
        <div style={{ fontSize: 12, color: "#7FA68A", marginTop: 5, lineHeight: "18px" }}>
          Live watchlist backed by Postgres. Add tokens, arm alerts, and keep the next scan close.
        </div>
      </div>

      {!isConnected || !userId ? (
        <div style={{ ...panel(), padding: 18, color: "#FFB020" }}>Connect wallet to load your quiver.</div>
      ) : (
        <div className="quiver-layout" style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 1, alignItems: "start" }}>
          <div style={{ ...panel(), overflow: "hidden" }}>
            <div style={{ background: "#06140B", padding: "8px 14px", borderBottom: "1px solid #164A2A", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>Marks · {watchlist.data?.items.length ?? 0}</span>
              <span style={{ fontSize: 11, color: "#496552" }}>{watchlist.isFetching ? "refreshing..." : "live backend"}</span>
            </div>
            {watchlist.isLoading && <div style={{ padding: 16, color: "#7FA68A" }}>loading watched tokens...</div>}
            {watchlist.data?.items.length === 0 && <div style={{ padding: 16, color: "#496552" }}>No marks yet. Add a token address to start.</div>}
            {watchlist.data?.items.map((item) => (
              <div key={item.id} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 10, alignItems: "center", padding: "12px 16px", borderBottom: "1px solid #164A2A", fontSize: 12 }}>
                <div>
                  <Link href={`/scan/${item.tokenAddress}`} style={{ fontWeight: 700, color: "#E6FBEA" }}>{short(item.tokenAddress)}</Link>
                  <div style={{ color: "#7FA68A", marginTop: 4 }}>{item.note || "No field note yet."}</div>
                </div>
                <button onClick={() => setAlertTarget(item.tokenAddress)} style={{ background: "transparent", border: "1px solid #164A2A", color: "#00C805", padding: "7px 10px", cursor: "pointer" }}>alert</button>
                <button onClick={() => removeMark(item.tokenAddress)} style={{ background: "transparent", border: "1px solid #164A2A", color: "#FF3B30", padding: "7px 10px", cursor: "pointer" }}>remove</button>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <div style={{ ...panel(), padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Add a mark</div>
              <input
                value={tokenAddress}
                onChange={(event) => setTokenAddress(event.target.value)}
                placeholder="0x token address"
                style={{ width: "100%", boxSizing: "border-box", background: "#06140B", border: "1px solid #164A2A", color: "#E6FBEA", fontSize: 12, padding: "10px", marginBottom: 10 }}
              />
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="note"
                rows={3}
                style={{ width: "100%", boxSizing: "border-box", background: "#06140B", border: "1px solid #164A2A", color: "#E6FBEA", fontSize: 12, padding: "10px", marginBottom: 10, resize: "vertical" }}
              />
              <button disabled={!isAddress(tokenAddress) || addWatch.isPending} onClick={addMark} style={{ width: "100%", background: "#00C805", color: "#0A1F12", border: "none", borderRadius: 3, fontSize: 12, fontWeight: 700, padding: 11, cursor: addWatch.isPending ? "wait" : "pointer" }}>
                {addWatch.isPending ? "adding..." : "Add to quiver"}
              </button>
            </div>

            <div style={{ ...panel(), padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Set an alert</div>
              <select value={selectedAlertTarget} onChange={(e) => setAlertTarget(e.target.value)} style={{ width: "100%", background: "#06140B", border: "1px solid #164A2A", color: "#E6FBEA", fontSize: 12, padding: "9px 10px", marginBottom: 12 }}>
                <option value="">Select watched token</option>
                {watchlist.data?.items.map((item) => <option key={item.id} value={item.tokenAddress}>{short(item.tokenAddress)}</option>)}
              </select>
              <select value={triggerType} onChange={(e) => setTriggerType(e.target.value)} style={{ width: "100%", background: "#06140B", border: "1px solid #164A2A", color: "#E6FBEA", fontSize: 12, padding: "9px 10px", marginBottom: 12 }}>
                {TRIGGERS.map((trigger) => <option key={trigger.value} value={trigger.value}>{trigger.label}</option>)}
              </select>
              {triggerType === "score_above" && (
                <input type="number" min={0} max={100} value={threshold} onChange={(event) => setThreshold(Number(event.target.value))} style={{ width: "100%", boxSizing: "border-box", background: "#06140B", border: "1px solid #164A2A", color: "#E6FBEA", fontSize: 12, padding: "9px 10px", marginBottom: 12 }} />
              )}
              <button disabled={!isAddress(selectedAlertTarget) || createAlert.isPending} onClick={armAlert} style={{ width: "100%", background: "#D4A937", color: "#0A1F12", border: "none", borderRadius: 3, fontSize: 12, fontWeight: 700, padding: 11, cursor: createAlert.isPending ? "wait" : "pointer" }}>
                {createAlert.isPending ? "arming..." : "Set alert"}
              </button>
            </div>

            <div style={{ ...panel(), overflow: "hidden" }}>
              <div style={{ background: "#06140B", padding: "8px 14px", borderBottom: "1px solid #164A2A", fontSize: 13, fontWeight: 700 }}>Recent strikes</div>
              {events.data?.events.length === 0 && <div style={{ padding: 14, color: "#496552", fontSize: 12 }}>No alert events yet.</div>}
              {events.data?.events.slice(0, 4).map((event) => (
                <div key={event.id} style={{ padding: "11px 16px", borderBottom: "1px solid #164A2A", fontSize: 11 }}>
                  <div style={{ color: event.status === "delivered" ? "#00C805" : "#FFB020" }}>{event.channel} · {event.status}</div>
                  <div style={{ color: "#7FA68A", marginTop: 4 }}>{short(event.targetAddress)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div style={{ marginTop: 12, border: "1px solid #FF3B30", background: "#1d0807", color: "#FFB020", padding: 14, fontSize: 12 }}>
          {error instanceof ApiClientError ? `${error.code}: ${error.message}` : "Quiver request failed"}
        </div>
      )}
    </div>
  );
}
