import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SIGNALBOT — Automated Hyperliquid Trading",
  description: "Desktop trading bot for Hyperliquid perpetuals. EMA/ATR signals, native TP/SL, trailing stops, risk guardrails. Your keys never leave your device.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
