"use client";

import { useEffect, useRef, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useQueryClient } from "@tanstack/react-query";
import { useAccount, useSignMessage, useSwitchChain } from "wagmi";
import { ApiClientError, getWalletNonce, logoutSession, verifyWalletSignature } from "@/lib/api";
import { useSession } from "@/lib/queries";
import { robinhoodChain } from "@/lib/wagmi";
import { useSessionStore } from "@/stores/session";

type ButtonSize = "compact" | "full";
type MenuPlacement = "bottom" | "top" | "sidebar";

interface HoodWalletButtonProps {
  size?: ButtonSize;
  menuPlacement?: MenuPlacement;
  showVerify?: boolean;
  onConnectedAction?: () => void;
}

function short(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function HoodWalletButton({ size = "compact", menuPlacement = "bottom", showVerify = true, onConnectedAction }: HoodWalletButtonProps) {
  if (!process.env.NEXT_PUBLIC_PRIVY_APP_ID) {
    const isFull = size === "full";
    return (
      <div style={{ display: "grid", gap: 7, width: isFull ? "100%" : "auto" }}>
        <button className="cta-outline" disabled style={buttonStyle({ isFull, color: "#FFB020" })}>
          <WalletIcon />
          Privy App ID missing
        </button>
        <div style={{ color: "#7FA68A", fontSize: 11 }}>Set NEXT_PUBLIC_PRIVY_APP_ID in frontend env.</div>
      </div>
    );
  }

  return (
    <PrivyWalletButtonInner
      size={size}
      menuPlacement={menuPlacement}
      showVerify={showVerify}
      onConnectedAction={onConnectedAction}
    />
  );
}

function PrivyWalletButtonInner({ size = "compact", menuPlacement = "bottom", showVerify = true, onConnectedAction }: HoodWalletButtonProps) {
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { ready, authenticated, user, login, logout, linkWallet } = usePrivy();
  const { address, chainId, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { switchChain, isPending: isSwitchingChain } = useSwitchChain();
  const setWalletVerified = useSessionStore((state) => state.setWalletVerified);
  const clearWalletSession = useSessionStore((state) => state.clearWalletSession);
  const queryClient = useQueryClient();
  const isFull = size === "full";
  const displayAddress = address || user?.wallet?.address;
  const isWrongNetwork = Boolean(isConnected && chainId && chainId !== robinhoodChain.id);
  const session = useSession(Boolean(displayAddress));
  const sessionWallet = session.data?.session.walletAddress?.toLowerCase();
  const isVerified = Boolean(displayAddress && sessionWallet === displayAddress.toLowerCase());
  const verifiedAt = session.data?.session.iat ? session.data.session.iat * 1000 : undefined;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  useEffect(() => {
    if (session.isError) clearWalletSession();
  }, [clearWalletSession, session.isError]);

  async function verifyWallet(address: string) {
    setError(null);
    setIsVerifying(true);
    try {
      const nonce = await getWalletNonce(address);
      const signature = await signMessageAsync({ message: nonce.message });
      const verified = await verifyWalletSignature({ walletAddress: address, signature });
      setWalletVerified(address, verified.user.id, verified.user.tier ?? "free");
      await queryClient.invalidateQueries({ queryKey: ["session"] });
      onConnectedAction?.();
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : "wallet signature failed";
      setError(message);
    } finally {
      setIsVerifying(false);
    }
  }

  function copyAddress() {
    navigator.clipboard.writeText(displayAddress!);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function disconnect() {
    setMenuOpen(false);
    logoutSession()
      .finally(() => logout())
      .finally(() => {
        clearWalletSession();
        queryClient.invalidateQueries({ queryKey: ["session"] });
      });
  }

  if (!ready) {
    return (
      <button className="cta-outline" disabled style={buttonStyle({ isFull, color: "#7FA68A" })}>
        <StatusDot color="#7FA68A" />
        Loading wallet
      </button>
    );
  }

  if (!authenticated) {
    return (
      <button
        onClick={() => login({ loginMethods: ["wallet", "email", "passkey"] })}
        className="cta-outline"
        style={buttonStyle({ isFull, color: "var(--text)" })}
      >
        <WalletIcon />
        Connect
      </button>
    );
  }

  if (!displayAddress) {
    return (
      <button
        onClick={() => linkWallet({ walletChainType: "ethereum-only" })}
        className="cta-outline"
        style={buttonStyle({ isFull, color: "#D4A937" })}
      >
        <WalletIcon />
        Add wallet
      </button>
    );
  }

  if (isWrongNetwork) {
    return (
      <button
        onClick={() => switchChain({ chainId: robinhoodChain.id })}
        disabled={isSwitchingChain}
        className="cta-outline"
        style={buttonStyle({ isFull, color: "#FFB020" })}
      >
        <StatusDot color="#FFB020" />
        {isSwitchingChain ? "Switching..." : "Switch to Robinhood"}
      </button>
    );
  }

  return (
    <div ref={menuRef} style={{ position: "relative", display: "grid", gap: 7, width: isFull ? "100%" : "auto" }}>
      <button
        onClick={() => setMenuOpen((v) => !v)}
        className="cta-outline"
        style={buttonStyle({ isFull, color: isVerified ? "var(--green)" : "#E6FBEA" })}
      >
        <StatusDot color={isVerified ? "var(--green)" : "#D4A937"} />
        <span>{short(displayAddress)}</span>
        {isVerified && <span style={{ color: "#7FA68A", fontSize: 10 }}>verified</span>}
        <ChevronIcon open={menuOpen} />
      </button>

      {menuOpen && (
        <div
          style={{
            position: "absolute",
            ...(menuPlacement === "sidebar"
              ? {
                  position: "fixed",
                  left: 12,
                  bottom: 76,
                  width: "min(260px, calc(100vw - 24px))",
                  maxHeight: "calc(100vh - 96px)",
                  overflowY: "auto",
                }
              : menuPlacement === "top"
                ? { bottom: "calc(100% + 6px)" }
                : { top: "calc(100% + 6px)" }),
            ...(menuPlacement === "sidebar" ? {} : { right: 0 }),
            minWidth: 200,
            maxWidth: 300,
            background: "#06140B",
            border: "1px solid #164A2A",
            borderRadius: 6,
            padding: "6px 0",
            zIndex: 1000,
            boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
          }}
        >
          <div style={{ padding: "8px 14px", fontSize: 11, color: "#496552", borderBottom: "1px solid #164A2A", overflowWrap: "anywhere" }}>
            {displayAddress}
          </div>
          <button onClick={copyAddress} style={menuItemStyle}>
            <CopyIcon />
            {copied ? "Copied!" : "Copy address"}
          </button>
          {showVerify && !isVerified && (
            <button
              onClick={() => { setMenuOpen(false); verifyWallet(displayAddress); }}
              disabled={isVerifying}
              style={menuItemStyle}
            >
              <ShieldIcon />
              {isVerifying ? "Signing..." : "Verify wallet"}
            </button>
          )}
          {showVerify && isVerified && verifiedAt && (
            <div style={{ padding: "6px 14px", fontSize: 10, color: "#7FA68A", borderBottom: "1px solid #164A2A" }}>
              Verified {new Date(verifiedAt).toLocaleDateString()}
            </div>
          )}
          <button onClick={disconnect} style={{ ...menuItemStyle, color: "#FF3B30" }}>
            <DisconnectIcon />
            Disconnect
          </button>
        </div>
      )}

      {error && <div style={{ color: "#FFB020", fontSize: 11, lineHeight: "15px" }}>{error}</div>}
    </div>
  );
}

function buttonStyle({ isFull, color }: { isFull: boolean; color: string }): React.CSSProperties {
  return {
    width: isFull ? "100%" : "auto",
    fontSize: isFull ? 14 : 13,
    color,
    background: "transparent",
    padding: isFull ? "11px 14px" : "8px 14px",
    borderRadius: 4,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  };
}

function StatusDot({ color }: { color: string }) {
  return (
    <span
      style={{
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: color,
        boxShadow: `0 0 8px ${color}`,
        flexShrink: 0,
      }}
    />
  );
}

const menuItemStyle: React.CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 14px",
  background: "transparent",
  border: "none",
  color: "#E6FBEA",
  fontSize: 12,
  cursor: "pointer",
  textAlign: "left",
};

function WalletIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "rotate(0)" }}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function DisconnectIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
