"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function BetaForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (data.key) {
        router.push(`/success?key=${encodeURIComponent(data.key)}`);
      } else {
        setError(data.error || "Something went wrong.");
      }
    } catch {
      setError("Request failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input
        type="email"
        required
        placeholder="your@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full px-4 py-3 rounded-lg bg-[#0d1117] border border-[#30363d] text-white placeholder-[#484f58] focus:border-[var(--neon)] focus:outline-none transition text-center"
      />
      <button
        type="submit"
        disabled={loading}
        className="btn-primary w-full text-lg disabled:opacity-50"
      >
        {loading ? "Generating key..." : "Get Free Beta Access"}
      </button>
      {error && <p className="text-[var(--red)] text-sm">{error}</p>}
    </form>
  );
}
