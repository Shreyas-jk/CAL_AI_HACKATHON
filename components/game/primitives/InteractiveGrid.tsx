"use client";
import { useMemo, useState, useCallback } from "react";
import type { InteractiveGridSpec, ControlValues } from "@/lib/gameSpec";
import { simulateGridSearch } from "@/lib/games/dynamic/simulations";

const STYLES = `
@keyframes ig-expand {
  from { opacity: 0; transform: scale(0.5); }
  to { opacity: 1; transform: scale(1); }
}
@keyframes ig-path-glow {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}
@keyframes ig-goal-pulse {
  0%, 100% { r: 0; opacity: 0.5; }
  50% { r: 12; opacity: 0; }
}
`;

interface Props {
  spec: InteractiveGridSpec;
  controlValues: ControlValues;
  usePowerup: boolean;
}

export default function InteractiveGrid({ spec, controlValues, usePowerup }: Props) {
  const [seed, setSeed] = useState(0);
  const budget = Number(controlValues.budget ?? spec.searchBudget);

  const wallState = useMemo(() => {
    const states = Object.entries(spec.cellStates);
    const wall = states.find(([name]) =>
      name.toLowerCase().includes("wall") || name.toLowerCase().includes("block"),
    );
    return wall ? wall[0] : "wall";
  }, [spec.cellStates]);

  const result = useMemo(
    () => simulateGridSearch(spec.initialGrid, spec.agentStart, spec.goalCell, budget, usePowerup, wallState),
    [spec, budget, usePowerup, wallState, seed],
  );

  const expandedSet = useMemo(
    () => new Set(result.expanded.map((c) => c.x + "," + c.y)),
    [result],
  );
  const pathSet = useMemo(
    () => new Set(result.path.map((c) => c.x + "," + c.y)),
    [result],
  );

  const reset = useCallback(() => setSeed((s) => s + 1), []);
  const maxDim = Math.max(spec.rows, spec.cols);
  const px = Math.min(32, Math.floor(420 / maxDim));

  return (
    <>
      <style>{STYLES}</style>
      <div className="flex flex-col items-center gap-3">
        <svg
          width={spec.cols * px + 2}
          height={spec.rows * px + 2}
          className="rounded-xl"
          style={{ filter: "drop-shadow(0 0 20px rgba(124, 92, 255, 0.1))" }}
        >
          <defs>
            <radialGradient id="ig-start-grad">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.2" />
            </radialGradient>
            <radialGradient id="ig-goal-grad">
              <stop offset="0%" stopColor="#34d399" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#34d399" stopOpacity="0.2" />
            </radialGradient>
            <filter id="ig-glow">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Background */}
          <rect x={0} y={0} width={spec.cols * px + 2} height={spec.rows * px + 2}
            fill="#080a14" rx={8} />

          {spec.initialGrid.map((row, y) =>
            row.map((cell, x) => {
              const k = x + "," + y;
              const isStart = x === spec.agentStart[0] && y === spec.agentStart[1];
              const isGoal = x === spec.goalCell[0] && y === spec.goalCell[1];
              const isWall = cell === wallState;
              const onPath = pathSet.has(k);
              const isExpanded = expandedSet.has(k);

              let fill = "#0e1020";
              if (isWall) fill = spec.cellStates[wallState] || "#1a1a2e";
              if (isExpanded && !isStart && !isGoal) {
                fill = usePowerup ? "rgba(124,92,255,0.25)" : "rgba(248,113,113,0.2)";
              }
              if (onPath && !isStart && !isGoal) {
                fill = usePowerup ? "rgba(124,92,255,0.5)" : "rgba(248,113,113,0.45)";
              }

              const cx = x * px + px / 2 + 1;
              const cy = y * px + px / 2 + 1;

              return (
                <g key={k}>
                  <rect
                    x={x * px + 1}
                    y={y * px + 1}
                    width={px - 1}
                    height={px - 1}
                    fill={fill}
                    rx={2}
                    className={onPath && !isStart && !isGoal ? "transition-all duration-200" : ""}
                  />

                  {/* Start marker */}
                  {isStart && (
                    <>
                      <circle cx={cx} cy={cy} r={px * 0.35} fill="url(#ig-start-grad)" />
                      <circle cx={cx} cy={cy} r={px * 0.2} fill="#22d3ee" filter="url(#ig-glow)" />
                    </>
                  )}

                  {/* Goal marker with pulse */}
                  {isGoal && (
                    <>
                      <circle cx={cx} cy={cy} r={0} fill="none" stroke="#34d399" strokeWidth={1}
                        style={{ animation: "ig-goal-pulse 2s ease-out infinite" }} />
                      <circle cx={cx} cy={cy} r={px * 0.35} fill="url(#ig-goal-grad)" />
                      <circle cx={cx} cy={cy} r={px * 0.2} fill="#34d399" filter="url(#ig-glow)" />
                    </>
                  )}

                  {/* Wall texture */}
                  {isWall && (
                    <rect x={x * px + 3} y={y * px + 3} width={px - 5} height={px - 5}
                      fill="none" stroke="#ffffff08" strokeWidth={0.5} rx={1} />
                  )}
                </g>
              );
            }),
          )}

          {/* Path line overlay */}
          {result.path.length > 1 && (
            <polyline
              points={result.path.map((c) => `${c.x * px + px / 2 + 1},${c.y * px + px / 2 + 1}`).join(" ")}
              fill="none"
              stroke={usePowerup ? "#7c5cff" : "#f87171"}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.7}
              filter="url(#ig-glow)"
            />
          )}
        </svg>

        <div className="flex items-center gap-4">
          <p className="text-sm">
            {result.reached ? (
              <span className="text-good">
                Reached goal — {result.expanded.length} expansions
              </span>
            ) : (
              <span className="text-bad">
                Budget exhausted — {result.expanded.length}/{budget} expansions
              </span>
            )}
          </p>
          <button onClick={reset} className="btn-ghost px-3 py-1 text-xs">
            Reset
          </button>
        </div>
      </div>
    </>
  );
}
