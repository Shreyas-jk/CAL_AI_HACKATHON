"use client";
import type { ReactNode } from "react";

export interface GameFrameProps {
  goal: string;
  baselineLabel: string;
  powerupLabel: string;
  claim: string;
  usePowerup: boolean;
  onToggle: (v: boolean) => void;
  score: string;
  status: "idle" | "playing" | "won" | "lost";
  onReset: () => void;
  children: ReactNode;
}

// Renders INSIDE a .cabinet (dark CRT screen), so chrome uses light text. The
// shared .card/.tag/.btn classes are re-skinned to dark by the .cabinet scope.
export default function GameFrame(p: GameFrameProps) {
  const statusColor =
    p.status === "won" ? "text-mint" : p.status === "lost" ? "text-coral" : "text-white/55";
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="label text-xs text-white/80">
          🎯 Goal — <span className="normal-case tracking-normal font-normal text-white/65">{p.goal}</span>
        </p>
        <div className="flex items-center gap-2 text-sm">
          <span className={"label text-xs font-bold " + statusColor}>{p.status}</span>
          <span className="tag">{p.score}</span>
          <button className="btn-ghost py-1 px-3 text-xs" onClick={p.onReset}>Reset</button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={() => p.onToggle(false)}
          className={"btn py-1.5 px-3 text-xs " + (!p.usePowerup ? "!bg-coral !text-[#15161f]" : "")}>
          {p.baselineLabel}
        </button>
        <span className="label text-[0.6rem] text-white/40">vs</span>
        <button onClick={() => p.onToggle(true)}
          className={"btn py-1.5 px-3 text-xs " + (p.usePowerup ? "!bg-mint !text-[#15161f]" : "")}>
          ⚡ {p.powerupLabel}
        </button>
      </div>

      <div className="rounded-lg bg-black/25 border border-white/10 p-4">{p.children}</div>

      {p.claim && (
        <p className="text-xs text-white/60 border-l-2 border-coral pl-3">{p.claim}</p>
      )}
    </div>
  );
}
