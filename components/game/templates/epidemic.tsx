"use client";
import { useState, useCallback, useMemo } from "react";
import GameFrame from "../GameFrame";
import type { PaperArtifact } from "@/lib/types";

const STEPS = 100;
const W = 400;
const H = 160;

function simulateSIR(beta: number, gamma: number, intervention: number) {
  const effectiveBeta = beta * (1 - intervention);
  let S = 0.99, I = 0.01, R = 0;
  const data: { s: number; i: number; r: number }[] = [{ s: S, i: I, r: R }];

  for (let t = 0; t < STEPS; t++) {
    const newInfected = effectiveBeta * S * I;
    const newRecovered = gamma * I;
    S = Math.max(0, S - newInfected);
    I = Math.max(0, I + newInfected - newRecovered);
    R = Math.min(1, R + newRecovered);
    data.push({ s: S, i: I, r: R });
  }
  return data;
}

function toPath(data: { s: number; i: number; r: number }[], key: "s" | "i" | "r") {
  return data
    .map((d, t) => `${(t / STEPS) * W},${H - d[key] * H}`)
    .join(" ");
}

export default function Epidemic({ game }: { game: PaperArtifact["game"] }) {
  const [usePowerup, setUsePowerup] = useState(false);
  const [intervention, setIntervention] = useState(0.3);

  const spreadContext = useMemo(() => {
    const c = game.content || {};
    return typeof c.spreadContext === "string" ? c.spreadContext : "";
  }, [game.content]);

  const beta = usePowerup ? 0.35 : 0.6;
  const gamma = 0.1;
  const data = useMemo(
    () => simulateSIR(beta, gamma, intervention),
    [beta, intervention]
  );

  const peakInfection = Math.max(...data.map((d) => d.i));
  const threshold = 0.2;
  const win = peakInfection <= threshold;
  const reset = useCallback(() => setIntervention(0.3), []);

  return (
    <GameFrame
      goal={game.goal || "Keep peak infections under 20%."}
      baselineLabel={game.baselineLabel || "No intervention"}
      powerupLabel={game.powerupLabel || "Early intervention strategy"}
      claim={game.claim}
      usePowerup={usePowerup}
      onToggle={setUsePowerup}
      score={`peak ${Math.round(peakInfection * 100)}% (cap ${Math.round(threshold * 100)}%)`}
      status={win ? "won" : "lost"}
      onReset={reset}
    >
      <div className="space-y-4">
        <div className="flex flex-col items-center gap-3">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-lg h-40 rounded bg-[#0e0e18]">
            <line
              x1={0} y1={H - threshold * H}
              x2={W} y2={H - threshold * H}
              stroke="#f8717155" strokeWidth={1} strokeDasharray="4 3"
            />
            <text x={W - 4} y={H - threshold * H - 4} textAnchor="end" fontSize={9} fill="#f87171">
              {Math.round(threshold * 100)}% cap
            </text>

            <polyline points={toPath(data, "s")} fill="none" stroke="#60a5fa" strokeWidth={1.5} />
            <polyline points={toPath(data, "i")} fill="none" stroke="#f87171" strokeWidth={2} />
            <polyline points={toPath(data, "r")} fill="none" stroke="#34d399" strokeWidth={1.5} />
          </svg>

          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-0.5 bg-[#60a5fa]" /> Susceptible
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-0.5 bg-[#f87171]" /> Infected
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-0.5 bg-[#34d399]" /> Recovered
            </span>
          </div>
        </div>

        <label className="block text-sm text-gray-300">
          Intervention strength: {Math.round(intervention * 100)}%
          <input
            type="range" min={0} max={1} step={0.05} value={intervention}
            onChange={(e) => setIntervention(Number(e.target.value))}
            className="w-full mt-1"
          />
        </label>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded border border-edge bg-ink/40 p-2">
            <div className="text-[10px] uppercase tracking-wide text-gray-500">Peak infection</div>
            <div className={win ? "text-good font-semibold" : "text-bad font-semibold"}>
              {Math.round(peakInfection * 100)}%
            </div>
          </div>
          <div className="rounded border border-edge bg-ink/40 p-2">
            <div className="text-[10px] uppercase tracking-wide text-gray-500">Final recovered</div>
            <div className="text-gray-200 font-semibold">
              {Math.round(data[data.length - 1].r * 100)}%
            </div>
          </div>
        </div>

        {spreadContext && <p className="text-xs text-gray-400 italic">{spreadContext}</p>}

        <p className="text-xs text-gray-500">
          {usePowerup
            ? "The paper's targeted strategy lowers effective transmission rate."
            : "Without the paper's method, the baseline transmission rate is much higher."}
        </p>
      </div>
    </GameFrame>
  );
}
