"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

/**
 * Public "shareable" token link. Rather than render a hardcoded fake result,
 * this forwards to the real scanner so a shared /token/0x… link shows the
 * actual on-chain scan for that address.
 */
export default function PublicTokenPage() {
  const params = useParams<{ address: string }>();
  const router = useRouter();
  const address = Array.isArray(params.address) ? params.address[0] : params.address;

  useEffect(() => {
    if (address) router.replace(`/scan/${address}`);
  }, [address, router]);

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "64px 32px", color: "#7FA68A", fontSize: 14 }}>
      Opening the live scan for {address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "this token"}…
    </div>
  );
}
