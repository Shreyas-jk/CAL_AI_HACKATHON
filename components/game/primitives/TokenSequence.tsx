"use client";
import { useMemo, useState, useCallback } from "react";
import type { TokenSequenceSpec } from "@/lib/gameSpec";

const STYLES = `
@keyframes ts-correct {
  0% { transform: scale(1); }
  50% { transform: scale(1.15); }
  100% { transform: scale(1); }
}
@keyframes ts-wrong-shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
}
@keyframes ts-token-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
`;

interface Props {
  spec: TokenSequenceSpec;
  usePowerup: boolean;
}

export default function TokenSequence({ spec, usePowerup }: Props) {
  const [idx, setIdx] = useState(0);
  const [pick, setPick] = useState<number | null>(null);
  const [animKey, setAnimKey] = useState(0);
  const s = spec.sequences[idx % spec.sequences.length];

  const weights = useMemo(() => {
    if (!usePowerup) return s.tokens.map(() => 1 / s.tokens.length);
    if (s.weights.length === s.tokens.length) return s.weights;
    return s.tokens.map((_, i) => {
      const d = Math.abs(i - s.correctIndex);
      return Math.exp(-d * 0.9);
    });
  }, [usePowerup, s]);

  const max = Math.max(...weights);
  const status = pick == null ? "playing" : pick === s.correctIndex ? "won" : "lost";
  const reset = useCallback(() => {
    setPick(null);
    setIdx((i) => i + 1);
    setAnimKey((k) => k + 1);
  }, []);

  return (
    <>
      <style>{STYLES}</style>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {s.tokens.map((tok, i) => {
            const intensity = weights[i] / max;
            const isCorrect = pick != null && i === s.correctIndex;
            const isPicked = pick === i;
            const isWrong = isPicked && !isCorrect;

            const bgAlpha = 0.08 + intensity * 0.7;
            const borderGlow = isCorrect
              ? "0 0 12px rgba(52, 211, 153, 0.5)"
              : isWrong
              ? "0 0 12px rgba(248, 113, 113, 0.4)"
              : intensity > 0.5 && usePowerup
              ? `0 0 ${8 * intensity}px rgba(124, 92, 255, ${intensity * 0.3})`
              : "none";

            return (
              <button
                key={`${animKey}-${i}`}
                onClick={() => pick == null && setPick(i)}
                className={
                  "px-3 py-2 rounded-lg text-sm font-medium border transition-all duration-200 " +
                  (isCorrect
                    ? "border-good bg-good/20 text-good"
                    : isWrong
                    ? "border-bad bg-bad/15 text-bad"
                    : pick != null && i === s.correctIndex
                    ? "border-good/60 bg-good/10 text-good"
                    : "border-white/10 text-gray-200 hover:border-accent/50")
                }
                style={{
                  background: isCorrect
                    ? undefined
                    : isWrong
                    ? undefined
                    : `rgba(124, 92, 255, ${bgAlpha})`,
                  boxShadow: borderGlow,
                  animation: isCorrect
                    ? "ts-correct 0.4s ease-out"
                    : isWrong
                    ? "ts-wrong-shake 0.3s ease-out"
                    : `ts-token-in 0.3s ease-out ${i * 40}ms both`,
                }}
              >
                {tok}
              </button>
            );
          })}
        </div>

        <p className="text-xs text-gray-500">
          {usePowerup
            ? "Learned attention spotlights the key token — the glow shows where to look."
            : "Uniform attention — no signal about which token matters."}
        </p>

        {pick != null && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-1">
            <p className="text-sm">
              {pick === s.correctIndex ? (
                <span className="text-good font-medium">
                  Correct — &quot;{s.tokens[s.correctIndex]}&quot; is the right token.
                </span>
              ) : (
                <span className="text-bad font-medium">
                  Not quite. The answer was &quot;{s.tokens[s.correctIndex]}&quot;.
                </span>
              )}
            </p>
            {s.explanation && (
              <p className="text-xs text-gray-400">{s.explanation}</p>
            )}
          </div>
        )}

        <div className="flex items-center gap-3 text-xs">
          <button onClick={reset} className="btn-ghost px-3 py-1.5 rounded-lg">
            Next sentence →
          </button>
          <span className="text-gray-600">
            {idx + 1} / {spec.sequences.length}
          </span>
        </div>
      </div>
    </>
  );
}
