"use client";
import type { ComparisonBarsSpec } from "@/lib/gameSpec";

const STYLES = `
@keyframes cb-fill {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}
@keyframes cb-shimmer {
  0% { left: -100%; }
  100% { left: 200%; }
}
`;

interface Props {
  spec: ComparisonBarsSpec;
  usePowerup: boolean;
}

export default function ComparisonBars({ spec, usePowerup }: Props) {
  return (
    <>
      <style>{STYLES}</style>
      <div className="space-y-4">
        {spec.metrics.map((m, i) => {
          const baseW = (m.baselineValue / m.max) * 100;
          const powerW = (m.powerupValue / m.max) * 100;
          const activeValue = usePowerup ? m.powerupValue : m.baselineValue;
          const activeW = usePowerup ? powerW : baseW;
          const isImproved = usePowerup
            ? m.higherIsBetter
              ? m.powerupValue > m.baselineValue
              : m.powerupValue < m.baselineValue
            : false;

          return (
            <div key={m.id} className="rounded-xl border border-white/5 bg-[#0c0e1a] p-3">
              <div className="flex justify-between text-xs mb-2">
                <span className="text-gray-400 font-medium">{m.label}</span>
                <span className={isImproved ? "text-good font-bold" : "text-gray-300 font-bold"}>
                  {activeValue.toFixed(1)}{m.unit}
                  {usePowerup && (
                    <span className="ml-1.5 text-[10px]">
                      {isImproved ? (
                        <span className="text-good">
                          ↑{Math.abs(m.powerupValue - m.baselineValue).toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-bad">
                          ↓{Math.abs(m.powerupValue - m.baselineValue).toFixed(1)}
                        </span>
                      )}
                    </span>
                  )}
                </span>
              </div>

              <div className="relative h-6 rounded-lg bg-white/5 overflow-hidden">
                {/* Baseline ghost bar */}
                {usePowerup && (
                  <div
                    className="absolute inset-y-0 left-0 rounded-lg bg-white/5 transition-all duration-500"
                    style={{ width: `${baseW}%` }}
                  />
                )}

                {/* Active bar with gradient */}
                <div
                  className={
                    "absolute inset-y-0 left-0 rounded-lg transition-all duration-700 origin-left " +
                    (isImproved
                      ? "bg-gradient-to-r from-good/70 to-good"
                      : usePowerup
                      ? "bg-gradient-to-r from-bad/50 to-bad/70"
                      : "bg-gradient-to-r from-accent/50 to-accent/70")
                  }
                  style={{
                    width: `${activeW}%`,
                    animation: `cb-fill 0.8s ease-out ${i * 150}ms both`,
                  }}
                >
                  {/* Shimmer overlay */}
                  <div
                    className="absolute inset-0 overflow-hidden rounded-lg"
                    style={{ animation: `cb-shimmer 2s ease-in-out infinite ${i * 300}ms` }}
                  >
                    <div className="absolute inset-y-0 w-16 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
                  </div>
                </div>

                {/* Value label inside bar */}
                <div className="absolute inset-0 flex items-center px-2">
                  <span className="text-[10px] font-bold text-white/80 drop-shadow-sm">
                    {activeValue.toFixed(1)}{m.unit}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
