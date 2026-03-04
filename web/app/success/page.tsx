"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";

const GITHUB_REPO = "c13studio/signalbot";
const DMG_URL = "/downloads/HL.Signalbot_1.0.4_universal.dmg";
const EXE_URL = "/downloads/HL.Signalbot_1.0.4_x64-setup.exe";

function SuccessContent() {
  const params = useSearchParams();
  const keyParam = params.get("key");
  const sessionId = params.get("session_id");
  const [licenseKey, setLicenseKey] = useState(keyParam || "");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showManual, setShowManual] = useState(false);

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

        <h2 className="text-xl font-bold mb-2">Download Signalbot</h2>
        <p className="text-sm text-[var(--text-muted)] mb-6">Choose your platform, install, and paste your license key to activate.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <a
            href={DMG_URL}
            className="flex items-center justify-center gap-3 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-[var(--neon)]/40 rounded-xl p-5 transition-all group"
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/60 group-hover:text-[var(--neon)] transition-colors">
              <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z" />
              <path d="M15.5 8.5c.5-1.5-.2-3-.2-3s-1.5.5-2.3 1.8c-.7-1.3-2.3-1.8-2.3-1.8s-.7 1.5-.2 3C9 9 8 10.5 8 12c0 2.5 1.8 4.5 4 4.5s4-2 4-4.5c0-1.5-1-3-2-3.5z" />
            </svg>
            <div className="text-left">
              <div className="font-semibold text-white group-hover:text-[var(--neon)] transition-colors">macOS</div>
              <div className="text-xs text-white/30">Universal (Intel + Apple Silicon)</div>
            </div>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-auto text-white/20 group-hover:text-[var(--neon)] transition-colors">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </a>

          <a
            href={EXE_URL}
            className="flex items-center justify-center gap-3 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-[var(--neon)]/40 rounded-xl p-5 transition-all group"
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/60 group-hover:text-[var(--neon)] transition-colors">
              <rect x="3" y="3" width="8" height="8" /><rect x="13" y="3" width="8" height="8" /><rect x="3" y="13" width="8" height="8" /><rect x="13" y="13" width="8" height="8" />
            </svg>
            <div className="text-left">
              <div className="font-semibold text-white group-hover:text-[var(--neon)] transition-colors">Windows</div>
              <div className="text-xs text-white/30">64-bit Installer</div>
            </div>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-auto text-white/20 group-hover:text-[var(--neon)] transition-colors">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </a>
        </div>

        <div className="border border-white/[0.06] rounded-xl overflow-hidden">
          <button
            onClick={() => setShowManual(!showManual)}
            className="w-full flex items-center justify-between px-5 py-4 text-sm text-white/40 hover:text-white/60 transition-colors"
          >
            <span>Manual install (advanced)</span>
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className={`transition-transform ${showManual ? "rotate-180" : ""}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {showManual && (
            <div className="px-5 pb-5 space-y-5 border-t border-white/[0.06]">
              <div className="pt-4">
                <p className="text-xs text-white/30 mb-3">Requires <a href="https://nodejs.org" target="_blank" className="text-[var(--cyan)] hover:underline">Node.js</a> and <a href="https://rustup.rs" target="_blank" className="text-[var(--cyan)] hover:underline">Rust</a>.</p>
                <div className="bg-[#0d1117] border border-[#30363d] rounded-lg p-4 font-mono text-sm leading-relaxed overflow-x-auto space-y-0.5">
                  <div className="text-white/20"># Install Rust (macOS/Linux)</div>
                  <div className="text-[var(--neon)]">curl --proto &apos;=https&apos; --tlsv1.2 -sSf https://sh.rustup.rs | sh</div>
                  <div className="text-[var(--neon)]">source &quot;$HOME/.cargo/env&quot;</div>
                  <div className="mt-2" />
                  <div className="text-white/20"># Clone, install &amp; run</div>
                  <div className="text-[var(--neon)]">git clone https://github.com/{GITHUB_REPO}.git</div>
                  <div className="text-[var(--neon)]">cd signalbot && npm install</div>
                  <div className="text-[var(--neon)]">cd bot && npm install && cd ..</div>
                  <div className="text-[var(--neon)]">npx tauri dev</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Telegram invite */}
        <div className="mt-8 p-5 rounded-2xl border border-[#2AABEE]/20 bg-[#2AABEE]/[0.04] flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-[#2AABEE]/15 flex items-center justify-center shrink-0">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#2AABEE">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.03-1.97 1.25-5.57 3.68-.53.36-1.01.54-1.43.53-.47-.01-1.38-.27-2.05-.49-.83-.27-1.49-.42-1.43-.88.03-.24.37-.49 1.02-.74 3.99-1.74 6.65-2.88 7.98-3.44 3.8-1.58 4.59-1.86 5.1-1.87.11 0 .37.03.54.17.14.12.18.28.2.45-.01.06.01.24 0 .37z" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-white mb-0.5">Join our private Telegram</p>
            <p className="text-xs text-white/35">Get updates, support, and connect with other traders.</p>
          </div>
          <a
            href="https://t.me/+Y9MLcLOMAdxiYzQ0"
            target="_blank"
            className="shrink-0 px-5 py-2.5 rounded-full bg-[#2AABEE] text-white font-semibold text-sm hover:brightness-110 transition-all"
          >
            Join
          </a>
        </div>

        <a
          href="/setup"
          className="block w-full text-center mt-6 py-4 px-6 rounded-full bg-[var(--neon)] text-black font-bold text-lg hover:brightness-110 transition-all"
        >
          Setup Steps
        </a>

        <div className="mt-6 text-center">
          <a href="/" className="text-sm text-white/30 hover:text-white/50 transition-colors">
            Back to Home
          </a>
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
