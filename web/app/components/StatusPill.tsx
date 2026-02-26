"use client";

import { useState, useEffect } from "react";

const statuses = [
  "Scanning for new trade",
  "Placing new trade",
  "Taking profit",
  "Closing trade",
];

export default function StatusPill() {
  const [index, setIndex] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setIndex((i) => (i + 1) % statuses.length);
        setFading(false);
      }, 400);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full border border-white/[0.08] bg-white/[0.03] mb-10">
      <span
        className="relative flex h-2.5 w-2.5"
      >
        <span className="animate-ping absolute inset-0 rounded-full bg-green-400 opacity-60" />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]" />
      </span>
      <span
        className="text-sm text-white/50 transition-opacity duration-400"
        style={{ opacity: fading ? 0 : 1 }}
      >
        {statuses[index]}
      </span>
    </div>
  );
}
