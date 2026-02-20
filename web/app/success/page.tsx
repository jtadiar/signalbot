"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";

function SuccessContent() {
  const params = useSearchParams();
  const sessionId = params.get("session_id");
  const [licenseKey, setLicenseKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      setError("No session found.");
      setLoading(false);
      return;
    }

    fetch("/api/success", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.key) setLicenseKey(data.key);
        else setError(data.error || "Could not retrieve license key.");
      })
      .catch(() => setError("Failed to retrieve license key."))
      .finally(() => setLoading(false));
  }, [sessionId]);

  function handleCopy() {
    if (licenseKey) {
      navigator.clipboard.writeText(licenseKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="grid-bg min-h-screen flex items-center justify-center px-6 py-16">
      <div className="card glow-green max-w-2xl w-full !p-10">
        {loading ? (
          <div className="text-center">
            <div className="text-4xl mb-4">⏳</div>
            <h1 className="text-2xl font-bold mb-2">Processing...</h1>
            <p className="text-[var(--text-muted)]">Generating your license key.</p>
          </div>
        ) : error ? (
          <div className="text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
            <p className="text-[var(--text-muted)]">{error}</p>
            <a href="/" className="btn-primary mt-6 inline-block">Try Again</a>
          </div>
        ) : (
          <>
            <div className="text-center mb-8">
              <div className="text-4xl mb-4">✓</div>
              <h1 className="text-2xl font-bold mb-2 text-[var(--neon)]">Payment Successful</h1>
              <p className="text-[var(--text-muted)]">Your Signalbot license key:</p>
            </div>

            <div
              onClick={handleCopy}
              className="bg-[#0d1117] border border-[#30363d] rounded-lg p-4 font-mono text-xl tracking-wider cursor-pointer hover:border-[var(--neon)] transition mb-2 text-center"
            >
              {licenseKey}
            </div>
            <p className="text-xs text-[var(--text-muted)] mb-10 text-center">
              {copied ? "Copied!" : "Click to copy — save this key somewhere safe"}
            </p>

            <h2 className="text-xl font-bold mb-6">Installation Steps</h2>

            <div className="space-y-6">
              {/* Step 1 */}
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full border-2 border-[var(--neon)] flex items-center justify-center text-[var(--neon)] font-bold text-sm shrink-0">1</div>
                <div>
                  <h3 className="font-semibold mb-1">Install Node.js</h3>
                  <p className="text-sm text-[var(--text-muted)] mb-2">
                    Download and install the LTS version from{" "}
                    <a href="https://nodejs.org" target="_blank" className="text-[var(--cyan)] hover:underline">nodejs.org</a>
                    {" "}(free, one-click installer).
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full border-2 border-[var(--neon)] flex items-center justify-center text-[var(--neon)] font-bold text-sm shrink-0">2</div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">Clone & install the bot</h3>
                  <p className="text-sm text-[var(--text-muted)] mb-2">Open your terminal and run:</p>
                  <div className="bg-[#0d1117] border border-[#30363d] rounded-lg p-4 font-mono text-sm leading-relaxed overflow-x-auto">
                    <div className="text-[var(--neon)]">git clone https://github.com/jtadiar/signalbot.git</div>
                    <div className="text-[var(--neon)]">cd signalbot/bot</div>
                    <div className="text-[var(--neon)]">npm install</div>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full border-2 border-[var(--neon)] flex items-center justify-center text-[var(--neon)] font-bold text-sm shrink-0">3</div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">Run the setup wizard</h3>
                  <p className="text-sm text-[var(--text-muted)] mb-2">Configure your wallet, risk parameters, TP/SL, and Telegram:</p>
                  <div className="bg-[#0d1117] border border-[#30363d] rounded-lg p-4 font-mono text-sm leading-relaxed overflow-x-auto">
                    <div className="text-[var(--neon)]">node cli.mjs setup</div>
                  </div>
                </div>
              </div>

              {/* Step 4 */}
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full border-2 border-[var(--neon)] flex items-center justify-center text-[var(--neon)] font-bold text-sm shrink-0">4</div>
                <div>
                  <h3 className="font-semibold mb-1">Enter your license key & start trading</h3>
                  <p className="text-sm text-[var(--text-muted)]">
                    When the bot asks for a license key, paste the key above. Then start the bot:
                  </p>
                  <div className="bg-[#0d1117] border border-[#30363d] rounded-lg p-4 font-mono text-sm leading-relaxed overflow-x-auto mt-2">
                    <div className="text-[var(--neon)]">node cli.mjs</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-10 pt-6 border-t border-[var(--border)] text-center">
              <a href="/" className="btn-secondary">
                Back to Home
              </a>
              <p className="text-xs text-[var(--text-muted)] mt-4">
                Need help? See the{" "}
                <a href="https://github.com/jtadiar/signalbot/blob/main/bot/CONFIGURATION.md" target="_blank" className="text-[var(--cyan)] hover:underline">
                  CONFIGURATION.md
                </a>{" "}
                guide for full documentation.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<div className="grid-bg min-h-screen flex items-center justify-center"><p>Loading...</p></div>}>
      <SuccessContent />
    </Suspense>
  );
}
