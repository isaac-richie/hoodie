import type { Metadata } from "next";
import { Web3Provider } from "@/components/providers/Web3Provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hood Terminal — Robinhood Chain token risk intelligence",
  description:
    "Scan any Robinhood Chain token. 14 modules. One verdict. Every piece of evidence on the table.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full"
      style={{
        fontFamily:
          '"JetBrains Mono", "IBM Plex Mono", "SFMono-Regular", ui-monospace, monospace',
      }}
    >
      <body className="min-h-full">
        <Web3Provider>{children}</Web3Provider>
      </body>
    </html>
  );
}
