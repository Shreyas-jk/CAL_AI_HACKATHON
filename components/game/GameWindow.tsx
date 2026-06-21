"use client";

import type { ReactNode } from "react";

export default function GameWindow({ children }: { children: ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-edge bg-[#080914] shadow-2xl shadow-black/40">
      <div className="flex h-9 items-center justify-between border-b border-edge bg-black/40 px-3 text-xs text-gray-400">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-bad/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-good/80" />
          <span className="ml-2 font-mono uppercase tracking-wide text-accent2">Vision Detective</span>
        </div>
        <span className="font-mono">VLM evidence lab</span>
      </div>
      <div className="relative h-[560px] min-h-[520px] md:h-[720px]">{children}</div>
    </div>
  );
}
