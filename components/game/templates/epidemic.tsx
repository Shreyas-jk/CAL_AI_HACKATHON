"use client";
import { useState, useCallback } from "react";
import GameFrame from "../GameFrame";
import type { PaperArtifact } from "@/lib/types";

// Playable shell: set intervention strength; keep peak infections under threshold.
export default function Epidemic({ game }: { game: PaperArtifact["game"] }) {
  const [usePowerup, setUsePowerup] = useState(false);
  const [intervention, setIntervention] = useState(0.3);
  const beta = usePowerup ? 0.35 : 0.6; // power-up = paper's targeted strategy
  const peak = Math.max(0.02, beta * (1 - intervention)); // simplified SIR peak
  const threshold = 0.2;
  const win = peak <= threshold;
  const reset = useCallback(() => setIntervention(0.3), []);
  return (
    <GameFrame goal={game.goal || "Keep peak infections under 20%."}
      baselineLabel={game.baselineLabel} powerupLabel={game.powerupLabel} claim={game.claim}
      usePowerup={usePowerup} onToggle={setUsePowerup}
      score={`peak ${Math.round(peak * 100)}% (cap 20%)`} status={win ? "won" : "lost"} onReset={reset}>
      <div className="space-y-3">
        <label className="block text-sm text-gray-300">Intervention strength: {Math.round(intervention * 100)}%
          <input type="range" min={0} max={1} step={0.05} value={intervention}
            onChange={(e) => setIntervention(Number(e.target.value))} className="w-full mt-1" />
        </label>
        <div className="h-3 rounded bg-edge overflow-hidden">
          <div className="h-full" style={{ width: Math.min(100, peak * 100 * 2) + "%", background: win ? "#34d399" : "#f87171" }} />
        </div>
        <p className="text-xs text-gray-500">{usePowerup ? "Targeted strategy (paper) lowers effective transmission." : "Blanket policy (baseline) is less efficient."}</p>
      </div>
    </GameFrame>
  );
}