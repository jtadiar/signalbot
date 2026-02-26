"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const statuses = [
  "Scanning for new trade",
  "Placing new trade",
  "Taking profit",
  "Closing trade",
];

const TYPE_SPEED = 45;
const DELETE_SPEED = 25;
const PAUSE_AFTER_TYPE = 2200;
const PAUSE_AFTER_DELETE = 300;

export default function StatusPill() {
  const [displayed, setDisplayed] = useState("");
  const idx = useRef(0);
  const timeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  const typeText = useCallback((text: string, charIdx: number) => {
    if (charIdx <= text.length) {
      setDisplayed(text.slice(0, charIdx));
      timeout.current = setTimeout(
        () => typeText(text, charIdx + 1),
        charIdx === text.length ? PAUSE_AFTER_TYPE : TYPE_SPEED
      );
      if (charIdx === text.length) {
        timeout.current = setTimeout(() => deleteText(text, text.length), PAUSE_AFTER_TYPE);
      }
    }
  }, []);

  const deleteText = useCallback((text: string, charIdx: number) => {
    if (charIdx >= 0) {
      setDisplayed(text.slice(0, charIdx));
      timeout.current = setTimeout(
        () => deleteText(text, charIdx - 1),
        charIdx === 0 ? PAUSE_AFTER_DELETE : DELETE_SPEED
      );
      if (charIdx === 0) {
        timeout.current = setTimeout(() => {
          idx.current = (idx.current + 1) % statuses.length;
          typeText(statuses[idx.current], 0);
        }, PAUSE_AFTER_DELETE);
      }
    }
  }, [typeText]);

  useEffect(() => {
    typeText(statuses[0], 0);
    return () => clearTimeout(timeout.current);
  }, [typeText]);

  return (
    <div
      className="inline-flex items-center justify-center gap-2.5 px-5 py-2.5 rounded-full border border-white/[0.08] bg-white/[0.03] mb-10"
      style={{ width: 280 }}
    >
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        <span className="animate-ping absolute inset-0 rounded-full bg-green-400 opacity-60" />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]" />
      </span>
      <span className="text-sm text-white/50 whitespace-nowrap">
        {displayed}
        <span className="inline-block w-[2px] h-[14px] bg-white/40 align-middle ml-[1px] animate-pulse" />
      </span>
    </div>
  );
}
