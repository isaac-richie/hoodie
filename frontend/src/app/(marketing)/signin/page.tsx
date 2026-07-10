"use client";

import { useState } from "react";
import Link from "next/link";
import { EllipsisRings } from "@/components/ui/EllipsisRings";

export default function SigninPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  return (
    <div
      style={{
        minHeight: "70vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#06140B",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", pointerEvents: "none" }}>
        <EllipsisRings
          cx={450}
          cy={350}
          radii={[110, 200, 295, 395]}
          ratioY={0.73}
          opacity={0.6}
        />
      </div>

      {!sent ? (
        <div
          style={{
            width: 400,
            background: "#0A1F12",
            border: "1px solid #164A2A",
            borderRadius: 8,
            padding: 36,
            position: "relative",
          }}
        >
          <div
            style={{ fontFamily: "var(--font-unifraktur), serif", fontSize: 30, marginBottom: 6 }}
          >
            Hail, outlaw.
          </div>
          <div
            style={{
              fontSize: 13,
              color: "#7FA68A",
              lineHeight: "20px",
              marginBottom: 26,
            }}
          >
            No passwords in the greenwood. We send a magic link. You click it. You are in.
          </div>
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "#7FA68A",
              marginBottom: 8,
            }}
          >
            your email
          </div>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="robin@greenwood.xyz"
            style={{
              width: "100%",
              boxSizing: "border-box",
              background: "#06140B",
              border: "1px solid #164A2A",
              borderRadius: 3,
              color: "#E6FBEA",
              fontSize: 14,
              padding: "12px 14px",
              outline: "none",
            }}
            onKeyDown={(e) => e.key === "Enter" && email && setSent(true)}
          />
          <button
            onClick={() => email && setSent(true)}
            style={{
              width: "100%",
              marginTop: 14,
              background: "#D4A937",
              color: "#0A1F12",
              border: "none",
              borderRadius: 3,
              fontSize: 14,
              fontWeight: 700,
              padding: 13,
              cursor: "pointer",
            }}
          >
            ❯ Send the magic link
          </button>
          <div
            style={{ fontSize: 10, color: "#496552", marginTop: 16, textAlign: "center" }}
          >
            By entering you accept the terms. Not financial advice. DYOR.
          </div>
        </div>
      ) : (
        <div
          style={{
            width: 400,
            background: "#0A1F12",
            border: "1px solid #164A2A",
            borderRadius: 8,
            padding: 36,
            position: "relative",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 34, color: "#00C805", marginBottom: 10 }}>✓</div>
          <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Check your post.</div>
          <div
            style={{ fontSize: 13, color: "#7FA68A", lineHeight: "20px", marginBottom: 26 }}
          >
            A link rides to {email || "your inbox"}. It lives for ten minutes, then the trail goes
            cold.
          </div>
          <Link
            href="/hideout"
            style={{
              display: "block",
              background: "#D4A937",
              color: "#0A1F12",
              borderRadius: 3,
              fontSize: 14,
              fontWeight: 700,
              padding: 13,
            }}
          >
            ❯ Enter the Hideout
          </Link>
          <div style={{ fontSize: 11, color: "#496552", marginTop: 14 }}>
            Wrong address?{" "}
            <button
              onClick={() => setSent(false)}
              style={{
                background: "transparent",
                border: "none",
                color: "#7FA68A",
                cursor: "pointer",
                fontSize: 11,
              }}
            >
              Send again.
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
