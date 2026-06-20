"use client";
import { useMemo, useState, useCallback } from "react";
import GameFrame from "../GameFrame";
import type { PaperArtifact } from "@/lib/types";

const SENTENCES = [
  { tokens: ["The","trophy","did","not","fit","in","the","brown","suitcase","because","it","was","too","big"], answer: 8 },
  { tokens: ["The","cat","sat","on","the","mat","because","it","was","warm","and","soft"], answer: 5 },
  { tokens: ["She","poured","water","into","the","glass","until","it","was","full"], answer: 5 },
];

export default function Attention({ game }: { game: PaperArtifact["game"] }) {
  const [usePowerup, setUsePowerup] = useState(false);
  const [idx, setIdx] = useState(0);
  const [pick, setPick] = useState<number | null>(null);
  const s = SENTENCES[idx % SENTENCES.length];

  // weights: uniform vs "learned" (peaked on the answer token)
  const weights = useMemo(() => {
    if (!usePowerup) return s.tokens.map(() => 1 / s.tokens.length);
    return s.tokens.map((_, i) => {
      const d = Math.abs(i - s.answer);
      return Math.exp(-d * 0.9);
    });
  }, [usePowerup, s]);
  const max = Math.max(...weights);

  const status = pick == null ? "playing" : pick === s.answer ? "won" : "lost";
  const reset = useCallback(() => { setPick(null); setIdx((i) => i + 1); }, []);

  return (
    <GameFrame
      goal={game.goal || "Click the token the model should attend to."}
      baselineLabel={game.baselineLabel}
      powerupLabel={game.powerupLabel}
      claim={game.claim}
      usePowerup={usePowerup}
      onToggle={(v) => { setUsePowerup(v); setPick(null); }}
      score={status === "won" ? "correct!" : status === "lost" ? "missed" : "pick one"}
      status={status as any}
      onReset={reset}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {s.tokens.map((tok, i) => {
            const intensity = weights[i] / max;
            const correct = pick != null && i === s.answer;
            return (
              <button key={i} onClick={() => pick == null && setPick(i)}
                style={{ background: `rgba(124,92,255,${0.12 + intensity * 0.8})` }}
                className={"px-2.5 py-1.5 rounded-md text-sm border " +
                  (correct ? "border-good" : pick === i ? "border-bad" : "border-edge")}>
                {tok}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-gray-500">
          Shading = attention weight. {usePowerup
            ? "Learned attention spotlights the referent token."
            : "Uniform attention smears equally — good luck guessing."}
        </p>
        {pick != null && (
          <p className="text-sm">
            {pick === s.answer
              ? <span className="text-good">Correct — "{s.tokens[s.answer]}" is what "it" refers to.</span>
              : <span className="text-bad">Not quite. The referent was "{s.tokens[s.answer]}".</span>}
          </p>
        )}
      </div>
    </GameFrame>
  );
}