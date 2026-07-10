"use client";

import Link from "next/link";
import { useDeployers } from "@/lib/queries";

export default function DeployersPage() {
  const { data, isLoading, error } = useDeployers();
  const deployers = data?.deployers ?? [];

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 24, fontWeight: 700 }}>Deployers</span>
          <span style={{ fontSize: 10, color: "#496552", border: "1px solid #164A2A", padding: "2px 8px", borderRadius: 3, letterSpacing: "0.06em" }}>Rap Sheets</span>
        </div>
        <div style={{ fontSize: 12, color: "#7FA68A", marginTop: 5, lineHeight: "18px" }}>
          Every deployer we have seen. Launches, rugs, survival rate. The rap sheet remembers so you do not have to.
        </div>
      </div>

      <div className="data-table-scroll">
        <div style={{ background: "#0D2A19", border: "1px solid #164A2A", overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr .6fr .6fr .6fr .8fr 1fr", gap: 12, padding: "9px 16px", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "#496552", borderBottom: "1px solid #164A2A" }}>
            <span>deployer</span><span>launches</span><span>rugs</span><span>survival</span><span>flag</span><span>last seen</span>
          </div>

          {isLoading && <TableMessage message="loading deployer rap sheets..." />}
          {error && <TableMessage message="backend deployer feed unavailable" tone="#FFB020" />}
          {!isLoading && !error && deployers.length === 0 && <TableMessage message="no deployers persisted yet. scans will build this table." />}

          {deployers.map((d) => {
            const survival = Math.round((d.survivalRate30d ?? 0) * 100);
            const flag = d.isSerialRug ? "serial rug" : d.confirmedRugs ? "watch" : "clean";
            return (
              <div key={d.address} style={{ display: "grid", gridTemplateColumns: "1.4fr .6fr .6fr .6fr .8fr 1fr", gap: 12, alignItems: "center", padding: "11px 16px", borderBottom: "1px solid #164A2A", fontSize: 12 }}>
                <Link href={`/deployer/${d.address}`} style={{ color: "#00C805", fontWeight: 600 }}>{shortAddress(d.address)}</Link>
                <span>{d.totalLaunches ?? 0}</span>
                <span style={{ color: (d.confirmedRugs ?? 0) > 0 ? "#FF3B30" : "#00C805" }}>{d.confirmedRugs ?? 0}</span>
                <span style={{ color: survival < 30 ? "#FF3B30" : survival < 60 ? "#FFB020" : "#00C805" }}>{survival || "—"}%</span>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 3, background: flag === "serial rug" ? "#8B1E1A" : flag === "watch" ? "#3a2a08" : "#164A2A", color: "#E6FBEA" }}>{flag}</span>
                <span style={{ color: "#7FA68A" }}>{age(d.lastLaunch ?? d.updatedAt)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TableMessage({ message, tone = "#7FA68A" }: { message: string; tone?: string }) {
  return <div style={{ padding: "18px 16px", color: tone, background: "#06140B", fontSize: 12 }}>{message}</div>;
}

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function age(date: string | null): string {
  if (!date) return "—";
  const hours = Math.max(0, Math.floor((Date.now() - Date.parse(date)) / 36e5));
  return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
}
