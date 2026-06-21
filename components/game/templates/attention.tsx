"use client";
import { useMemo, useState, useCallback } from "react";
import GameFrame from "../GameFrame";
import type { PaperArtifact } from "@/lib/types";

const DEFAULT_SENTENCES = [
  { tokens: ["The","trophy","did","not","fit","in","the","brown","suitcase","because","it","was","too","big"], answer: 8, explanation: "'it' refers to 'suitcase' — the suitcase was too big (or small) for the trophy." },
  { tokens: ["The","cat","sat","on","the","mat","because","it","was","warm","and","soft"], answer: 5, explanation: "'it' refers to 'the mat' — the mat was warm and soft." },
  { tokens: ["She","poured","water","into","the","glass","until","it","was","full"], answer: 5, explanation: "'it' refers to 'the glass' — the glass was full." },
];

function parseSentences(content?: Record<string, unknown>) {
  if (!content?.sentences || !Array.isArray(content.sentences)) return DEFAULT_SENTENCES;
  const arr = content.sentences as Array<{ tokens?: string[]; answer?: number; explanation?: string }>;
  const valid = arr.filter(
    (s) => Array.isArray(s.tokens) && typeof s.answer === "number" && s.answer >= 0 && s.answer < s.tokens.length,
  );
  return valid.length >= 2
    ? valid.map((s) => ({ tokens: s.tokens!, answer: s.answer!, explanation: s.explanation || "" }))
    : DEFAULT_SENTENCES;
}

export default function Attention({ game }: { game: PaperArtifact["game"] }) {
  const sentences = useMemo(() => parseSentences(game.content), [game.content]);
  const [usePowerup, setUsePowerup] = useState(false);
  const [idx, setIdx] = useState(0);
  const [pick, setPick] = useState<number | null>(null);
  const s = sentences[idx % sentences.length];

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
          <div className="space-y-1">
            <p className="text-sm">
              {pick === s.answer
                ? <span className="text-good">Correct — &quot;{s.tokens[s.answer]}&quot; is the right token.</span>
                : <span className="text-bad">Not quite. The answer was &quot;{s.tokens[s.answer]}&quot;.</span>}
            </p>
            {s.explanation && <p className="text-xs text-gray-500">{s.explanation}</p>}
          </div>
        )}
      </div>
    </GameFrame>
  );
}