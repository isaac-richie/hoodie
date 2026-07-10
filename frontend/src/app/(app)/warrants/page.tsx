"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { isAddress } from "viem";
import { useAccount } from "wagmi";
import { ApiClientError } from "@/lib/api";
import { useAlertEvents, useAlerts, useCreateAlert, useDeleteAlert, useEnsureUser } from "@/lib/queries";

function short(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function eventColor(status: string) {
  if (status === "delivered") return "#00C805";
  if (status === "failed") return "#FF3B30";
  return "#FFB020";
}

export default function WarrantsPage() {
  const { address, isConnected } = useAccount();
  const userId = address?.toLowerCase();
  const [targetAddress, setTargetAddress] = useState("");
  const [triggerType, setTriggerType] = useState("band_extreme");
  const [threshold, setThreshold] = useState(75);
  const ensureUser = useEnsureUser();
  const ensureUserMutate = ensureUser.mutate;
  const alerts = useAlerts(userId);
  const events = useAlertEvents(userId);
  const createAlert = useCreateAlert(userId);
  const deleteAlert = useDeleteAlert(userId);
  const error = alerts.error || events.error || createAlert.error || deleteAlert.error;

  useEffect(() => {
    if (!userId || ensureUser.isPending) return;
    ensureUserMutate({ id: userId, walletAddress: userId });
  }, [userId, ensureUser.isPending, ensureUserMutate]);

  async function armAlert() {
    if (!userId || !isAddress(targetAddress)) return;
    await createAlert.mutateAsync({
      targetAddress,
      triggerType,
      threshold: triggerType === "score_above" || triggerType === "score_below" ? threshold : undefined,
      deliveryChannels: ["in_app"],
    });
    setTargetAddress("");
  }

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 24, fontWeight: 700 }}>Warrants</span>
          <span style={{ fontSize: 10, color: "#496552", border: "1px solid #164A2A", padding: "2px 8px", borderRadius: 3, letterSpacing: "0.06em" }}>Alerts</span>
        </div>
        <div style={{ fontSize: 12, color: "#7FA68A", marginTop: 5, lineHeight: "18px" }}>
          Real alert rules and delivery events from the backend. Armed alerts fire after scans are persisted.
        </div>
      </div>

      {!isConnected || !userId ? (
        <div style={{ background: "#0D2A19", border: "1px solid #164A2A", padding: 18, color: "#FFB020" }}>Connect wallet to manage warrants.</div>
      ) : (
        <div className="warrants-layout" style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 1, alignItems: "start" }}>
          <div style={{ background: "#0D2A19", border: "1px solid #164A2A", overflow: "hidden" }}>
            <div style={{ background: "#06140B", padding: "8px 14px", borderBottom: "1px solid #164A2A", fontSize: 13, fontWeight: 700 }}>
              Alerts that fired · {events.data?.events.length ?? 0}
            </div>
            {events.isLoading && <div style={{ padding: 16, color: "#7FA68A" }}>loading alert history...</div>}
            {events.data?.events.length === 0 && <div style={{ padding: 16, color: "#496552" }}>No alert events yet. Run scans against armed targets to generate strikes.</div>}
            {events.data?.events.map((event) => (
              <div key={event.id} style={{ padding: "11px 16px", borderBottom: "1px solid #164A2A", fontSize: 12 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                  <span style={{ color: eventColor(event.status) }}>➶ {event.status}</span>
                  <Link href={`/scan/${event.targetAddress}`} style={{ fontWeight: 700, color: "#E6FBEA" }}>{short(event.targetAddress)}</Link>
                  <span style={{ fontSize: 9, color: "#496552", border: "1px solid #164A2A", padding: "1px 6px", borderRadius: 3 }}>{event.channel}</span>
                  <span style={{ marginLeft: "auto", color: "#496552", fontSize: 10 }}>{event.createdAt ? new Date(event.createdAt).toLocaleString() : ""}</span>
                </div>
                <div style={{ color: "#7FA68A", lineHeight: "17px" }}>
                  {event.error || `Alert ${event.alertId.slice(0, 8)} fired for ${short(event.targetAddress)}.`}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gap: 1 }}>
            <div style={{ background: "#0D2A19", border: "1px solid #164A2A", overflow: "hidden" }}>
              <div style={{ background: "#06140B", padding: "8px 14px", borderBottom: "1px solid #164A2A", fontSize: 13, fontWeight: 700 }}>
                Armed alerts · {alerts.data?.alerts.length ?? 0}
              </div>
              {alerts.isLoading && <div style={{ padding: 16, color: "#7FA68A" }}>loading armed alerts...</div>}
              {alerts.data?.alerts.length === 0 && <div style={{ padding: 16, color: "#496552" }}>No armed alerts yet.</div>}
              {alerts.data?.alerts.map((alert) => (
                <div key={alert.id} style={{ padding: "11px 16px", borderBottom: "1px solid #164A2A", fontSize: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 4 }}>
                    <Link href={`/scan/${alert.targetAddress}`} style={{ fontWeight: 700, color: "#E6FBEA" }}>{short(alert.targetAddress)}</Link>
                    <button
                      disabled={deleteAlert.isPending}
                      onClick={() => deleteAlert.mutate(alert.id)}
                      style={{ background: "transparent", border: "1px solid #164A2A", color: "#FF3B30", fontSize: 10, padding: "2px 8px", borderRadius: 3, cursor: deleteAlert.isPending ? "wait" : "pointer" }}
                    >
                      disarm
                    </button>
                  </div>
                  <div style={{ color: "#7FA68A", fontSize: 11 }}>
                    trigger: {alert.triggerType}{alert.threshold !== null ? ` · threshold ${alert.threshold}` : ""} · {(alert.deliveryChannels || ["in_app"]).join(" + ")}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ background: "#0D2A19", border: "1px solid #164A2A", padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Set new alert</div>
              <input
                value={targetAddress}
                onChange={(event) => setTargetAddress(event.target.value)}
                placeholder="0x token address"
                style={{ width: "100%", boxSizing: "border-box", background: "#06140B", border: "1px solid #164A2A", color: "#E6FBEA", fontSize: 12, padding: "10px", marginBottom: 10 }}
              />
              <select value={triggerType} onChange={(event) => setTriggerType(event.target.value)} style={{ width: "100%", background: "#06140B", border: "1px solid #164A2A", color: "#E6FBEA", fontSize: 12, padding: "9px 10px", marginBottom: 10 }}>
                <option value="scan_complete">scan complete</option>
                <option value="score_above">score above</option>
                <option value="score_below">score below</option>
                <option value="band_high">band high</option>
                <option value="band_extreme">band extreme</option>
              </select>
              {(triggerType === "score_above" || triggerType === "score_below") && (
                <input type="number" min={0} max={100} value={threshold} onChange={(event) => setThreshold(Number(event.target.value))} style={{ width: "100%", boxSizing: "border-box", background: "#06140B", border: "1px solid #164A2A", color: "#E6FBEA", fontSize: 12, padding: "9px 10px", marginBottom: 10 }} />
              )}
              <button disabled={!isAddress(targetAddress) || createAlert.isPending} onClick={armAlert} style={{ width: "100%", background: "#00C805", color: "#0A1F12", border: "none", fontSize: 12, fontWeight: 700, padding: 10, cursor: createAlert.isPending ? "wait" : "pointer" }}>
                {createAlert.isPending ? "arming..." : "Arm warrant"}
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div style={{ marginTop: 12, border: "1px solid #FF3B30", background: "#1d0807", color: "#FFB020", padding: 14, fontSize: 12 }}>
          {error instanceof ApiClientError ? `${error.code}: ${error.message}` : "Warrant request failed"}
        </div>
      )}
    </div>
  );
}
