"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { ApiClientError } from "@/lib/api";
import { useApiKeys, useCreateApiKey, useEnsureUser, useRevokeApiKey } from "@/lib/queries";

function short(value: string) {
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function panelStyle(): React.CSSProperties {
  return { border: "1px solid #164A2A", background: "#06140B", padding: 20 };
}

export default function ApiKeysPage() {
  const { address, isConnected } = useAccount();
  const userId = address?.toLowerCase();
  const [name, setName] = useState("Default key");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const ensureUser = useEnsureUser();
  const ensureUserMutate = ensureUser.mutate;
  const keys = useApiKeys(userId);
  const createKey = useCreateApiKey(userId);
  const revokeKey = useRevokeApiKey(userId);
  const error = keys.error || createKey.error || revokeKey.error;

  useEffect(() => {
    if (!userId || ensureUser.isPending) return;
    ensureUserMutate({ id: userId, walletAddress: userId });
  }, [userId, ensureUser.isPending, ensureUserMutate]);

  async function handleCreate() {
    if (!userId) return;
    const result = await createKey.mutateAsync({
      name: name.trim() || "Default key",
      scopes: ["scan:read", "watchlist:write", "alerts:write"],
    });
    setCreatedKey(result.key);
    setName("Default key");
  }

  return (
    <section style={{ maxWidth: 1040, margin: "0 auto", padding: "28px 16px", display: "grid", gap: 1 }}>
      <div style={{ border: "1px solid #164A2A", background: "#06140B", padding: 24 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "#7FA68A", marginBottom: 10 }}>
          api keys
        </div>
        <h1 style={{ fontSize: 28, margin: "0 0 10px", color: "#E6FBEA" }}>Programmatic access</h1>
        <p style={{ margin: 0, color: "#7FA68A", lineHeight: "24px" }}>
          Create, list, and revoke real DB-backed keys. New secrets are shown once and are never stored in browser localStorage.
        </p>
      </div>

      {!isConnected || !userId ? (
        <div style={panelStyle()}>
          <div style={{ color: "#FFB020", fontWeight: 700 }}>Connect wallet to manage keys.</div>
          <div style={{ color: "#7FA68A", fontSize: 12, marginTop: 8 }}>Your wallet address becomes the account id for this handoff build.</div>
        </div>
      ) : (
        <>
          <div style={panelStyle()}>
            <div style={{ color: "#7FA68A", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 10 }}>
              account
            </div>
            <div style={{ color: "#E6FBEA", fontWeight: 700 }}>{short(userId)}</div>
            <div style={{ color: "#496552", fontSize: 12, marginTop: 6 }}>user id: {userId}</div>
          </div>

          <div style={panelStyle()}>
            <label style={{ display: "block", color: "#7FA68A", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 10 }}>
              create key
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Key name"
                style={{ flex: 1, minWidth: 220, background: "#0A1F12", border: "1px solid #164A2A", color: "#E6FBEA", padding: "11px 12px", outline: "none" }}
              />
              <button
                disabled={createKey.isPending}
                onClick={handleCreate}
                style={{ background: "#D4A937", border: "none", color: "#0A1F12", fontWeight: 700, padding: "0 16px", cursor: createKey.isPending ? "wait" : "pointer" }}
              >
                {createKey.isPending ? "creating..." : "create key"}
              </button>
            </div>
            {createdKey && (
              <div style={{ marginTop: 14, border: "1px solid #D4A937", background: "#151307", padding: 12 }}>
                <div style={{ color: "#D4A937", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8 }}>copy this secret now</div>
                <code style={{ color: "#E6FBEA", overflowWrap: "anywhere" }}>{createdKey}</code>
              </div>
            )}
            <div style={{ marginTop: 14, color: "#496552", fontSize: 12 }}>
              API secrets are one-time only. Copy the new key before leaving this page.
            </div>
          </div>

          <div style={{ ...panelStyle(), padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "10px 14px", borderBottom: "1px solid #164A2A", color: "#E6FBEA", fontWeight: 700 }}>
              Active keys · {keys.data?.keys.length ?? 0}
            </div>
            {keys.isLoading && <div style={{ padding: 16, color: "#7FA68A" }}>loading keys...</div>}
            {keys.data?.keys.length === 0 && <div style={{ padding: 16, color: "#496552" }}>No active API keys yet.</div>}
            {keys.data?.keys.map((key) => (
              <div key={key.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, padding: "12px 16px", borderBottom: "1px solid #164A2A", alignItems: "center" }}>
                <div>
                  <div style={{ color: "#E6FBEA", fontWeight: 700 }}>{key.name || "Unnamed key"}</div>
                  <div style={{ color: "#7FA68A", fontSize: 12, marginTop: 4 }}>
                    {key.keyPrefix}... · {key.tier || "free"} · {(key.scopes || []).join(", ") || "no scopes"}
                  </div>
                </div>
                <button
                  disabled={revokeKey.isPending}
                  onClick={() => revokeKey.mutate(key.id)}
                  style={{ background: "transparent", border: "1px solid #164A2A", color: "#FF3B30", padding: "8px 12px", cursor: revokeKey.isPending ? "wait" : "pointer" }}
                >
                  revoke
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {error && (
        <div style={{ border: "1px solid #FF3B30", background: "#1d0807", color: "#FFB020", padding: 14, fontSize: 12 }}>
          {error instanceof ApiClientError ? `${error.code}: ${error.message}` : "API key request failed"}
        </div>
      )}
    </section>
  );
}
