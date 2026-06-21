"use client";
import { useMemo } from "react";
import type { PipelineVizSpec, ControlValues } from "@/lib/gameSpec";
import { simulatePipelineDeterministic } from "@/lib/games/dynamic/simulations";

const STYLES = `
@keyframes pv-flow {
  0% { transform: translateX(-100%); opacity: 0; }
  20% { opacity: 1; }
  80% { opacity: 1; }
  100% { transform: translateX(100%); opacity: 0; }
}
@keyframes pv-pulse {
  0%, 100% { box-shadow: 0 0 8px rgba(52, 211, 153, 0.2); }
  50% { box-shadow: 0 0 20px rgba(52, 211, 153, 0.5); }
}
@keyframes pv-fail-pulse {
  0%, 100% { box-shadow: 0 0 8px rgba(248, 113, 113, 0.2); }
  50% { box-shadow: 0 0 16px rgba(248, 113, 113, 0.4); }
}
@keyframes pv-particle {
  0% { transform: translateX(0) scale(1); opacity: 0.8; }
  100% { transform: translateX(40px) scale(0.3); opacity: 0; }
}
`;

interface Props {
  spec: PipelineVizSpec;
  controlValues: ControlValues;
  usePowerup: boolean;
}

export default function PipelineViz({ spec, controlValues, usePowerup }: Props) {
  const enabledIds = useMemo(() => {
    const ids = new Set<string>();
    for (const stage of spec.stages) {
      if (!stage.toggleable) { ids.add(stage.id); continue; }
      const val = controlValues[stage.id];
      const enabled = val != null ? Boolean(val) : (usePowerup ? stage.default : false);
      if (enabled) ids.add(stage.id);
    }
    return ids;
  }, [spec.stages, controlValues, usePowerup]);

  const result = useMemo(
    () => simulatePipelineDeterministic(spec.stages, enabledIds, spec.baselineAccuracy, spec.inputItems, 42),
    [spec, enabledIds],
  );

  const passRate = result.itemResults.filter((r) => r.passed).length / result.itemResults.length;

  return (
    <>
      <style>{STYLES}</style>
      <div className="space-y-5">
        {/* Pipeline stages — 3D-style cards */}
        <div className="flex items-stretch gap-0 overflow-x-auto pb-3">
          {spec.stages.map((stage, i) => {
            const on = enabledIds.has(stage.id);
            return (
              <div key={stage.id} className="flex items-center shrink-0">
                {/* Connection arrow with flow particles */}
                {i > 0 && (
                  <div className="relative w-10 flex items-center justify-center">
                    <div className={`h-0.5 w-full ${on ? "bg-gradient-to-r from-good/60 to-good/30" : "bg-gray-800"}`} />
                    {on && (
                      <>
                        <div className="absolute w-2 h-2 rounded-full bg-good/80"
                          style={{ animation: "pv-particle 1.5s linear infinite", left: 0 }} />
                        <div className="absolute w-1.5 h-1.5 rounded-full bg-good/60"
                          style={{ animation: "pv-particle 1.5s linear infinite 0.5s", left: 0 }} />
                        <div className="absolute w-1 h-1 rounded-full bg-good/40"
                          style={{ animation: "pv-particle 1.5s linear infinite 1s", left: 0 }} />
                      </>
                    )}
                    <svg className="absolute right-0" width={8} height={12}>
                      <path d="M0,0 L8,6 L0,12" fill={on ? "#34d39980" : "#374151"} />
                    </svg>
                  </div>
                )}

                {/* Stage card */}
                <div
                  className={
                    "relative rounded-xl border-2 p-3 min-w-[120px] transition-all duration-300 " +
                    (on
                      ? "border-good/50 bg-gradient-to-b from-good/15 to-good/5 shadow-lg"
                      : "border-gray-800 bg-gray-900/50 opacity-40")
                  }
                  style={on ? { animation: "pv-pulse 3s ease-in-out infinite" } : undefined}
                >
                  {/* Top accent bar */}
                  <div className={`absolute top-0 left-3 right-3 h-0.5 rounded-full ${on ? "bg-good/60" : "bg-gray-700"}`} />

                  <div className="text-xs font-bold text-white mt-1">{stage.label}</div>
                  <div className="text-[10px] text-gray-400 mt-1 leading-tight">{stage.description}</div>

                  {stage.toggleable && (
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[10px]">
                        {on
                          ? <span className="text-good font-semibold">+{(stage.effect.accuracyDelta * 100).toFixed(0)}%</span>
                          : <span className="text-gray-600">off</span>}
                      </span>
                      <span className="text-[9px] text-gray-600">{stage.effect.latencyMs}ms</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Metrics dashboard */}
        <div className="grid grid-cols-3 gap-3">
          <MetricCard
            label="Accuracy"
            value={`${Math.round(result.accuracy * 100)}%`}
            tone={result.accuracy > 0.7 ? "good" : "bad"}
            bar={result.accuracy}
          />
          <MetricCard
            label="Latency"
            value={`${result.latency}ms`}
            tone={result.latency < 200 ? "good" : "neutral"}
            bar={Math.min(1, result.latency / 300)}
          />
          <MetricCard
            label="Pass Rate"
            value={`${result.itemResults.filter((r) => r.passed).length}/${result.itemResults.length}`}
            tone={passRate > 0.7 ? "good" : "bad"}
            bar={passRate}
          />
        </div>

        {/* Item results with animations */}
        <div className="flex flex-wrap gap-2">
          {result.itemResults.map((item, i) => {
            const def = spec.inputItems.find((d) => d.id === item.id);
            return (
              <div
                key={item.id}
                className={
                  "rounded-lg border px-3 py-1.5 text-xs transition-all duration-300 " +
                  (item.passed
                    ? "border-good/30 bg-good/10 text-good shadow-[0_0_8px_rgba(52,211,153,0.15)]"
                    : "border-bad/30 bg-bad/10 text-bad shadow-[0_0_8px_rgba(248,113,113,0.15)]")
                }
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <span className="font-medium">{item.passed ? "✓" : "✗"}</span>{" "}
                {def?.label || item.id}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function MetricCard({
  label,
  value,
  tone,
  bar,
}: {
  label: string;
  value: string;
  tone: "good" | "bad" | "neutral";
  bar: number;
}) {
  const color = tone === "good" ? "#34d399" : tone === "bad" ? "#f87171" : "#9ca3af";
  return (
    <div className="rounded-xl border border-white/5 bg-[#0c0e1a] p-3">
      <div className="text-[10px] uppercase tracking-wider text-gray-500">{label}</div>
      <div className="text-lg font-bold mt-0.5" style={{ color }}>{value}</div>
      <div className="mt-2 h-1 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${bar * 100}%`, background: color }}
        />
      </div>
    </div>
  );
}
