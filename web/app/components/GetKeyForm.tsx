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
        className="w-full px-4 py-3 rounded-lg bg-[#0d1117] border border-[#30363d] text-white placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--neon)] transition text-center"
      />
      {error && <p className="text-[var(--red)] text-sm">{error}</p>}
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
