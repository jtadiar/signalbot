"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";

function SuccessContent() {
  const params = useSearchParams();
  const keyParam = params.get("key");
  const sessionId = params.get("session_id");
  const [licenseKey, setLicenseKey] = useState(keyParam || "");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (sessionId && !licenseKey) {
      setLoading(true);
      fetch("/api/verify-stripe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.key) {
            setLicenseKey(data.key);
          } else {
            setError(data.error || "Could not verify payment.");
          }
        })
        .catch(() => setError("Network error. Please refresh the page."))
        .finally(() => setLoading(false));
    }
  }, [sessionId, licenseKey]);

  function handleCopy() {
    if (licenseKey) {
      navigator.clipboard.writeText(licenseKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  if (loading) {
    return (
      <div className="grid-bg min-h-screen flex items-center justify-center px-6">
        <div className="card max-w-lg w-full !p-10 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 rounded-full border-3 border-white/10 border-t-[var(--neon)] animate-spin" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Verifying payment...</h1>
          <p className="text-[var(--text-muted)]">Confirming your Stripe payment and generating your license key.</p>
        </div>
      </div>
    );
  }

  if (!licenseKey) {
    return (
      <div className="grid-bg min-h-screen flex items-center justify-center px-6">
        <div className="card max-w-lg w-full !p-10 text-center">
          <h1 className="text-2xl font-bold mb-2">{error ? "Payment issue" : "No license key found"}</h1>
          <p className="text-[var(--text-muted)] mb-6">{error || "Go back and complete payment to get a key."}</p>
          <a href="/#pricing" className="btn-primary inline-block">Get a Key</a>
        </div>
      </div>
    );
  }

  return (
    <div className="grid-bg min-h-screen flex items-center justify-center px-6 py-16">
      <div className="card glow-green max-w-2xl w-full !p-10">
        <div className="text-center mb-8">
          <div className="text-4xl mb-4">✓</div>
          <h1 className="text-2xl font-bold mb-2 text-[var(--neon)]">You&apos;re In</h1>
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
              <h3 className="font-semibold mb-1">Install prerequisites</h3>
              <p className="text-sm text-[var(--text-muted)] mb-2">You need two things installed (both free):</p>
              <ul className="text-sm text-[var(--text-muted)] space-y-1 mb-2">
                <li>• <a href="https://nodejs.org" target="_blank" className="text-[var(--cyan)] hover:underline">Node.js</a> — download the LTS version (one-click installer)</li>
                <li>• <a href="https://rustup.rs" target="_blank" className="text-[var(--cyan)] hover:underline">Rust</a> — install by running this in your terminal:</li>
              </ul>
              <div className="bg-[#0d1117] border border-[#30363d] rounded-lg p-4 font-mono text-sm leading-relaxed overflow-x-auto">
                <div className="text-[var(--neon)]">curl --proto &apos;=https&apos; --tlsv1.2 -sSf https://sh.rustup.rs | sh</div>
                <div className="text-[var(--neon)]">source &quot;$HOME/.cargo/env&quot;</div>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-2">Windows users: download the Rust installer from <a href="https://rustup.rs" target="_blank" className="text-[var(--cyan)] hover:underline">rustup.rs</a> instead.</p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full border-2 border-[var(--neon)] flex items-center justify-center text-[var(--neon)] font-bold text-sm shrink-0">2</div>
            <div className="flex-1">
              <h3 className="font-semibold mb-1">Clone &amp; install</h3>
              <p className="text-sm text-[var(--text-muted)] mb-2">Open your terminal and run:</p>
              <div className="bg-[#0d1117] border border-[#30363d] rounded-lg p-4 font-mono text-sm leading-relaxed overflow-x-auto">
                <div className="text-[var(--neon)]">git clone https://github.com/jtadiar/signalbot.git</div>
                <div className="text-[var(--neon)]">cd signalbot</div>
                <div className="text-[var(--neon)]">npm install</div>
                <div className="text-[var(--neon)]">cd bot &amp;&amp; npm install &amp;&amp; cd ..</div>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full border-2 border-[var(--neon)] flex items-center justify-center text-[var(--neon)] font-bold text-sm shrink-0">3</div>
            <div className="flex-1">
              <h3 className="font-semibold mb-1">Launch the desktop app</h3>
              <p className="text-sm text-[var(--text-muted)] mb-2">Build and open the app (first run takes a few minutes to compile):</p>
              <div className="bg-[#0d1117] border border-[#30363d] rounded-lg p-4 font-mono text-sm leading-relaxed overflow-x-auto">
                <div className="text-[var(--neon)]">npx tauri dev</div>
              </div>
            </div>
          </div>

          {/* Step 4 */}
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full border-2 border-[var(--neon)] flex items-center justify-center text-[var(--neon)] font-bold text-sm shrink-0">4</div>
            <div className="flex-1">
              <h3 className="font-semibold mb-1">Activate &amp; configure</h3>
              <p className="text-sm text-[var(--text-muted)]">
                The app will open and ask for your license key — paste the key above. Then follow the setup wizard to enter your wallet, risk parameters, and TP/SL settings. Hit Start and you&apos;re trading.
              </p>
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
