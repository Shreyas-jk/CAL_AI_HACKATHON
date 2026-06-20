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

export default function GameFrame(p: GameFrameProps) {
  const statusColor = p.status === "won" ? "text-good" : p.status === "lost" ? "text-bad" : "text-accent2";
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-300">🎯 {p.goal}</p>
        <div className="flex items-center gap-3 text-sm">
          <span className={statusColor + " font-semibold uppercase tracking-wide"}>{p.status}</span>
          <span className="tag">{p.score}</span>
          <button className="btn-ghost py-1 px-3 text-sm" onClick={p.onReset}>Reset</button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={() => p.onToggle(false)}
          className={"btn py-1.5 px-3 text-sm " + (!p.usePowerup ? "bg-bad/80 text-white" : "border border-edge text-gray-400")}>
          {p.baselineLabel}
        </button>
        <span className="text-gray-600 text-xs">vs</span>
        <button onClick={() => p.onToggle(true)}
          className={"btn py-1.5 px-3 text-sm " + (p.usePowerup ? "bg-good/80 text-white" : "border border-edge text-gray-400")}>
          ⚡ {p.powerupLabel}
        </button>
      </div>

      <div className="rounded-xl border border-edge bg-ink/60 p-4">{p.children}</div>

      {p.claim && (
        <p className="text-xs text-gray-400 border-l-2 border-accent pl-3">{p.claim}</p>
      )}
    </div>
  );
}