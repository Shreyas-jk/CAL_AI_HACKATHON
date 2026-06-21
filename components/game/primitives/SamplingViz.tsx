"use client";
import { useMemo, useState, useEffect } from "react";
import type { SamplingVizSpec, ControlValues } from "@/lib/gameSpec";
import { simulateSampling } from "@/lib/games/dynamic/simulations";

const STYLES = `
@keyframes sv-card-in {
  from { transform: scale(0.8) rotateY(90deg); opacity: 0; }
  to { transform: scale(1) rotateY(0deg); opacity: 1; }
}
@keyframes sv-selected-glow {
  0%, 100% { box-shadow: 0 0 12px rgba(52, 211, 153, 0.3); }
  50% { box-shadow: 0 0 24px rgba(52, 211, 153, 0.6); }
}
@keyframes sv-scan {
  0% { left: 0; opacity: 0; }
  10% { opacity: 1; }
  90% { opacity: 1; }
  100% { left: 100%; opacity: 0; }
}
`;

interface Props {
  spec: SamplingVizSpec;
  controlValues: ControlValues;
  usePowerup: boolean;
}

export default function SamplingViz({ spec, controlValues, usePowerup }: Props) {
  const sampleCount = Number(controlValues.sampleCount ?? (usePowerup ? 8 : 1));
  const voting = String(controlValues.voting ?? (usePowerup ? "weighted" : "none"));
  const [highlight, setHighlight] = useState(0);
  const [animKey, setAnimKey] = useState(0);

  const result = useMemo(() => {
    setAnimKey((k) => k + 1);
    return simulateSampling(spec.accuracyDistribution, sampleCount, voting, spec.verifierAccuracy, 42);
  }, [spec, sampleCount, voting]);

  useEffect(() => {
    if (result.samples.length <= 1) return;
    const timer = setInterval(() => {
      setHighlight((h) => (h + 1) % result.samples.length);
    }, 700);
    return () => clearInterval(timer);
  }, [result.samples.length]);

  const won = result.finalAccuracy >= spec.targetAccuracy;

  return (
    <>
      <style>{STYLES}</style>
      <div className="space-y-4">
        <div className="text-sm text-gray-400 flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-accent2 animate-pulse" />
          {spec.problemLabel}
        </div>

        {/* Sample cards grid */}
        <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(90px,1fr))]">
          {result.samples.map((s, i) => {
            const pct = Math.round(s.accuracy * 100);
            const isGood = s.accuracy >= spec.targetAccuracy;
            return (
              <div
                key={`${animKey}-${s.id}`}
                className={
                  "relative rounded-xl border p-3 text-center transition-all duration-300 " +
                  (s.selected
                    ? "border-good/60 bg-gradient-to-b from-good/20 to-good/5"
                    : i === highlight
                    ? "border-accent/50 bg-accent/10"
                    : "border-white/5 bg-[#0c0e1a]")
                }
                style={{
                  animation: `sv-card-in 0.4s ease-out ${i * 80}ms both`,
                  ...(s.selected ? { animation: `sv-card-in 0.4s ease-out ${i * 80}ms both, sv-selected-glow 2s ease-in-out infinite` } : {}),
                }}
              >
                {/* Accuracy ring */}
                <div className="relative mx-auto w-12 h-12">
                  <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                    <circle cx="18" cy="18" r="15" fill="none" stroke="#1f2937" strokeWidth="3" />
                    <circle
                      cx="18" cy="18" r="15" fill="none"
                      stroke={isGood ? "#34d399" : s.selected ? "#34d399" : "#6b7280"}
                      strokeWidth="3"
                      strokeDasharray={`${pct * 0.94} 100`}
                      strokeLinecap="round"
                      className="transition-all duration-700"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className={`text-xs font-bold ${isGood ? "text-good" : "text-gray-300"}`}>
                      {pct}
                    </span>
                  </div>
                </div>

                <div className="text-[10px] text-gray-500 mt-1">#{s.id}</div>
                {s.selected && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-good flex items-center justify-center text-[8px] text-white font-bold shadow-lg">
                    ✓
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Scanning indicator */}
        {result.samples.length > 1 && (
          <div className="relative h-1 rounded-full bg-white/5 overflow-hidden">
            <div
              className="absolute h-full w-8 rounded-full bg-gradient-to-r from-transparent via-accent/60 to-transparent"
              style={{ animation: "sv-scan 2s ease-in-out infinite" }}
            />
          </div>
        )}

        {/* Result metrics */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-white/5 bg-[#0c0e1a] p-3">
            <div className="text-[10px] uppercase tracking-wider text-gray-500">Samples</div>
            <div className="text-lg font-bold text-white">{result.samples.length}</div>
          </div>
          <div className="rounded-xl border border-white/5 bg-[#0c0e1a] p-3">
            <div className="text-[10px] uppercase tracking-wider text-gray-500">Voting</div>
            <div className="text-lg font-bold text-accent capitalize">{voting}</div>
          </div>
          <div className="rounded-xl border border-white/5 bg-[#0c0e1a] p-3">
            <div className="text-[10px] uppercase tracking-wider text-gray-500">Final</div>
            <div className={`text-lg font-bold ${won ? "text-good" : "text-bad"}`}>
              {Math.round(result.finalAccuracy * 100)}%
            </div>
          </div>
        </div>

        {/* Target accuracy bar */}
        <div>
          <div className="flex justify-between text-[10px] text-gray-500 mb-1">
            <span>Final accuracy</span>
            <span>Target: {Math.round(spec.targetAccuracy * 100)}%</span>
          </div>
          <div className="relative h-3 rounded-full bg-white/5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${won ? "bg-gradient-to-r from-good/80 to-good" : "bg-gradient-to-r from-bad/60 to-bad/80"}`}
              style={{ width: `${Math.min(100, result.finalAccuracy * 100)}%` }}
            />
            <div
              className="absolute inset-y-0 w-0.5 bg-white/60"
              style={{ left: `${spec.targetAccuracy * 100}%` }}
            />
          </div>
        </div>
      </div>
    </>
  );
}
