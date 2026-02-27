"use client";

import { useState } from "react";

function TipCard({ icon, title, desc, link }: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  link?: { href: string; label: string };
}) {
  return (
    <div className="p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] min-h-[200px] flex flex-col">
      <div className="w-10 h-10 rounded-xl bg-[var(--neon)]/10 flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="font-semibold text-sm mb-2">{title}</h3>
      <p className="text-white/35 text-xs leading-relaxed flex-1">{desc}</p>
      {link && (
        <a
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 mt-4 text-xs font-semibold text-[var(--neon)] hover:underline"
        >
          {link.label}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 17l9.2-9.2M17 17V7H7" />
          </svg>
        </a>
      )}
    </div>
  );
}

function UpdateTipCard() {
  const [flipped, setFlipped] = useState(false);

  const front = (
    <div className="p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] min-h-[200px] flex flex-col">
      <div className="w-10 h-10 rounded-xl bg-[var(--neon)]/10 flex items-center justify-center mb-4">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff6b00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
          <path d="M21 3v5h-5" />
        </svg>
      </div>
      <h3 className="font-semibold text-sm mb-2">Check for updates regularly</h3>
      <p className="text-white/35 text-xs leading-relaxed flex-1">
        We push improvements and fixes frequently. Keep your bot up to date.
      </p>
      <button
        onClick={() => setFlipped(true)}
        className="inline-flex items-center gap-1.5 mt-4 text-xs font-semibold text-[var(--neon)] hover:underline self-start"
      >
        How to update
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
    </div>
  );

  const back = (
    <div className="p-6 rounded-2xl border border-[var(--neon)]/20 bg-white/[0.02] min-h-[200px] flex flex-col">
      <div className="text-xs text-white/50 font-medium mb-3">Open Terminal and run:</div>
      <div className="bg-black rounded-xl border border-white/[0.06] p-3 font-mono text-xs leading-relaxed mb-3">
        <div className="text-[var(--neon)]">cd signalbot</div>
        <div className="text-[var(--neon)]">git stash && git pull</div>
      </div>
      <p className="text-white/35 text-xs leading-relaxed flex-1">
        Then restart the bot from the app (Stop → Start).
      </p>
      <button
        onClick={() => setFlipped(false)}
        className="inline-flex items-center gap-1.5 mt-4 text-xs font-semibold text-[var(--neon)] hover:underline self-start"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        Back
      </button>
    </div>
  );

  return flipped ? back : front;
}

export default function TopTips() {
  return (
    <section className="pb-20 px-6 border-t border-white/[0.04] pt-10">
      <div className="max-w-3xl mx-auto">
        <h2 className="heading-accent text-2xl md:text-3xl mb-10 text-center">
          Top <span className="text-[var(--neon)]">Tips</span>
        </h2>

        <div className="grid md:grid-cols-3 gap-4">
          <TipCard
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff6b00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a7 7 0 0 0-7 7c0 3 2 5.5 4 7.5V19h6v-2.5c2-2 4-4.5 4-7.5a7 7 0 0 0-7-7z" />
                <path d="M9 19v1a3 3 0 0 0 6 0v-1" />
              </svg>
            }
            title="Keep your computer awake"
            desc="Deactivate sleep mode in your system settings. The bot runs locally — if your machine sleeps, it stops scanning and managing trades."
          />
          <TipCard
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff6b00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.198 2.433a2.242 2.242 0 0 0-1.022.215l-8.609 3.33c-2.068.8-4.133 1.598-5.724 2.21a6 6 0 0 0-4.065 3.903 4.7 4.7 0 0 0 .46 3.834A3.3 3.3 0 0 0 4.462 17.5l2.39.626c.652 2.187 1.309 2.984 2.063 3.662a3.5 3.5 0 0 0 2.46.884c.736-.027 1.097-.2 1.543-.553.39-.312.8-.752 1.34-1.478l.636 2.16a3.3 3.3 0 0 0 1.575 2.224 4.7 4.7 0 0 0 3.834.459c1.764-.545 3.103-1.675 3.903-4.065l5.54-14.333a2.24 2.24 0 0 0-1.548-2.653M9 12l6 6" />
              </svg>
            }
            title="Join our Telegram"
            desc="Stay up to date with the latest updates, tips, and announcements."
            link={{ href: "https://t.me/placeholder", label: "Join Telegram" }}
          />
          <UpdateTipCard />
        </div>
      </div>
    </section>
  );
}
