"use client";
import { useState, useCallback } from "react";
import GameFrame from "../GameFrame";
import type { PaperArtifact } from "@/lib/types";

// Playable shell: pick a policy; naive policy dies on lava, reward shaping survives.
export default function GridworldRL({ game }: { game: PaperArtifact["game"] }) {
  const [usePowerup, setUsePowerup] = useState(false);
  const [run, setRun] = useState(0);
  const survived = usePowerup; // reward shaping survives; naive dies
  const status = run === 0 ? "idle" : survived ? "won" : "lost";
  const reset = useCallback(() => setRun(0), []);
  const path = usePowerup ? "🤖→→↑→🏁 (avoided lava)" : "🤖→→🔥 (stepped into lava)";
  return (
    <GameFrame goal={game.goal || "Get the agent to the flag alive."}
      baselineLabel={game.baselineLabel} powerupLabel={game.powerupLabel} claim={game.claim}
      usePowerup={usePowerup} onToggle={(v) => { setUsePowerup(v); setRun(0); }}
      score={run === 0 ? "press run" : survived ? "survived" : "died"} status={status as any} onReset={reset}>
      <div className="space-y-3">
        <div className="font-mono text-lg">{run === 0 ? "🤖 . . 🔥 . 🏁" : path}</div>
        <button className="btn-primary py-1.5 px-4 text-sm" onClick={() => setRun(1)}>Run episode</button>
        <p className="text-xs text-gray-500">Shell template — wire richer dynamics from the paper's params. Baseline vs power-up logic is live.</p>
      </div>
    </GameFrame>
  );
}