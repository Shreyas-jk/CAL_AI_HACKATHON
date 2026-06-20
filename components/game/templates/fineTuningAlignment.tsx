"use client";
import { useMemo, useState, useCallback } from "react";
import GameFrame from "../GameFrame";
import type { PaperArtifact } from "@/lib/types";

const BASE_SENTENCE = "The assistant gives a clear, accurate, and honest answer.";
const EAGER_SUFFIXES = ["", " Definitely.", " Trust me on this!", " 100% guaranteed!!!"];
const REWARD_BAIT = [
  "AMAZING ANSWER!!!", "RATE ME FIVE STARS", "BEST RESPONSE EVER",
  "PERFECT PERFECT PERFECT", "USER WILL DEFINITELY APPROVE",
];

function sampleOutput(drift: number, minMeaningful: number, breakHigh: number): string {
  if (drift < minMeaningful) return BASE_SENTENCE;
  if (drift <= breakHigh) {
    const eagerness = Math.round(((drift - minMeaningful) / Math.max(1, breakHigh - minMeaningful)) * (EAGER_SUFFIXES.length - 1));
    return BASE_SENTENCE + EAGER_SUFFIXES[Math.min(eagerness, EAGER_SUFFIXES.length - 1)];
  }
  const overshoot = Math.min(1, (drift - breakHigh) / Math.max(1, 100 - breakHigh));
  const repeats = 1 + Math.round(overshoot * 4);
  const seed = Math.floor(drift);
  return Array.from({ length: repeats })
    .map((_, i) => REWARD_BAIT[(seed + i) % REWARD_BAIT.length])
    .join(" ");
}

function reward(drift: number, breakHigh: number): number {
  return 100 * (1 - Math.exp(-drift / Math.max(1, breakHigh * 0.5)));
}

function coherence(drift: number, breakHigh: number): number {
  if (drift <= breakHigh) return 100 - (drift / breakHigh) * 10;
  return Math.max(0, 90 - (drift - breakHigh) * 3);
}

export default function FineTuningAlignment({ game }: { game: PaperArtifact["game"] }) {
  const breakHigh = Number(game.params.breakHigh ?? 70);
  const minMeaningful = Number(game.params.minMeaningful ?? 15);
  const optimalDrift = Number(game.params.optimalDrift ?? Math.round((breakHigh + minMeaningful) / 2));
  const paramLabel = String(game.params.paramLabel ?? "Policy drift allowed");
  const unit = String(game.params.unit ?? "%");

  const [usePowerup, setUsePowerup] = useState(false);
  const [drift, setDrift] = useState(0);

  const effectiveDrift = usePowerup ? drift : 0;
  const r = reward(effectiveDrift, breakHigh);
  const c = coherence(effectiveDrift, breakHigh);
  const combined = Math.round(r * (c / 100));
  const output = useMemo(
    () => sampleOutput(effectiveDrift, minMeaningful, breakHigh),
    [effectiveDrift, minMeaningful, breakHigh]
  );

  const status: "idle" | "playing" | "won" | "lost" = !usePowerup
    ? "idle"
    : effectiveDrift > breakHigh
    ? "lost"
    : Math.abs(effectiveDrift - optimalDrift) <= 10 && c > 60
    ? "won"
    : "playing";

  const reset = useCallback(() => {
    setDrift(0);
    setUsePowerup(false);
  }, []);

  return (
    <GameFrame
      goal={game.goal || "Find the drift level that maximizes reward without breaking coherence."}
      baselineLabel={game.baselineLabel || "Base model (frozen)"}
      powerupLabel={game.powerupLabel || "Your tuned policy"}
      claim={game.claim}
      usePowerup={usePowerup}
      onToggle={(v) => { setUsePowerup(v); if (!v) setDrift(0); }}
      score={`${combined}/100`}
      status={status}
      onReset={reset}
    >
      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
            <span>{paramLabel}</span>
            <span className="text-gray-300">{effectiveDrift}{unit}</span>
          </div>
          <div className="relative">
            <input
              type="range" min={0} max={100} step={1}
              value={effectiveDrift}
              disabled={!usePowerup}
              onChange={(e) => setDrift(Number(e.target.value))}
              className="w-full disabled:opacity-40"
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-px h-3 bg-accent2"
              style={{ left: `${optimalDrift}%` }}
              title={`Paper's reported optimum: ${optimalDrift}${unit}`}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <div className="flex justify-between mb-1"><span className="text-gray-400">Reward</span><span>{Math.round(r)}</span></div>
            <div className="h-1.5 rounded bg-edge overflow-hidden">
              <div className="h-full bg-accent2" style={{ width: `${r}%` }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between mb-1"><span className="text-gray-400">Coherence</span><span>{Math.round(c)}</span></div>
            <div className="h-1.5 rounded bg-edge overflow-hidden">
              <div className={"h-full " + (c > 60 ? "bg-good" : "bg-bad")} style={{ width: `${c}%` }} />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-edge bg-ink/40 p-3">
          <p className="text-xs text-gray-500 mb-1">Sample output</p>
          <p className={"text-sm " + (effectiveDrift > breakHigh ? "text-bad font-semibold" : "text-gray-200")}>
            {output}
          </p>
        </div>

        <p className="text-xs text-gray-500">
          {!usePowerup
            ? "Frozen at base behavior — switch to the tuned policy to unlock the slider."
            : effectiveDrift < minMeaningful
            ? "Too low to matter yet — barely distinguishable from the base model."
            : effectiveDrift > breakHigh
            ? "Reward-hacked: optimized purely for the signal, no longer a coherent answer."
            : "Reward is climbing — watch coherence as you push further."}
        </p>
      </div>
    </GameFrame>
  );
}