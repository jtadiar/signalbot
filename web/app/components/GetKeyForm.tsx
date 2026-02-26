"use client";

import { useState } from "react";

export default function GetKeyForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      setError("Enter a valid email.");
      return;
    }
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (data.key) {
        window.location.href = `/success?key=${encodeURIComponent(data.key)}`;
      } else {
        setError(data.error || "Something went wrong.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input
        type="email"
        placeholder="you@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        className="w-full px-4 py-3.5 rounded-full bg-black border border-white/[0.08] text-white placeholder-white/20 focus:outline-none focus:border-[var(--neon)]/50 focus:shadow-[0_0_20px_rgba(255,107,0,0.1)] transition-all text-center"
      />
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="btn-primary w-full justify-center text-lg"
      >
        {loading ? "Generating..." : "Get Access — Free"}
      </button>
    </form>
  );
}
