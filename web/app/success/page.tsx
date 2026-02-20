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
      setError("No session ID found.");
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
    <div className="grid-bg min-h-screen flex items-center justify-center px-6">
      <div className="card glow-green max-w-lg w-full !p-10 text-center">
        {loading ? (
          <>
            <div className="text-4xl mb-4">⏳</div>
            <h1 className="text-2xl font-bold mb-2">Processing payment...</h1>
            <p className="text-[var(--text-muted)]">Generating your license key.</p>
          </>
        ) : error ? (
          <>
            <div className="text-4xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
            <p className="text-[var(--text-muted)]">{error}</p>
            <a href="/#pricing" className="btn-primary mt-6 inline-block">Try Again</a>
          </>
        ) : (
          <>
            <div className="text-4xl mb-4">✓</div>
            <h1 className="text-2xl font-bold mb-2 text-[var(--neon)]">Payment Successful</h1>
            <p className="text-[var(--text-muted)] mb-6">Your Signalbot license key:</p>

            <div
              onClick={handleCopy}
              className="bg-[#0d1117] border border-[#30363d] rounded-lg p-4 font-mono text-xl tracking-wider cursor-pointer hover:border-[var(--neon)] transition mb-2"
            >
              {licenseKey}
            </div>
            <p className="text-xs text-[var(--text-muted)] mb-8">
              {copied ? "Copied!" : "Click to copy"}
            </p>

            <div className="text-left space-y-4 mb-8">
              <h3 className="font-semibold">Next steps:</h3>
              <ol className="space-y-2 text-sm text-[var(--text-muted)]">
                <li>1. Copy your license key above</li>
                <li>2. Download and install the app (or clone the repo)</li>
                <li>3. Paste the key when prompted on first launch</li>
                <li>4. Complete the setup wizard and start trading</li>
              </ol>
            </div>

            <div className="flex flex-col gap-3">
              <a href="https://github.com/jtadiar/signalbot" className="btn-primary w-full justify-center">
                Download from GitHub
              </a>
              <a href="/" className="btn-secondary w-full justify-center">
                Back to Home
              </a>
            </div>

            <p className="text-xs text-[var(--text-muted)] mt-6">
              Save this key somewhere safe. It&apos;s also been sent to your email.
            </p>
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
