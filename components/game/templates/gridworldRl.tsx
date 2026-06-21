"use client";
import { useState, useCallback, useMemo } from "react";
import GameFrame from "../GameFrame";
import type { PaperArtifact } from "@/lib/types";

type Cell = "empty" | "hazard" | "agent" | "goal";

function parseGridContent(content?: Record<string, unknown>) {
  const c = content || {};
  return {
    hazardType: typeof c.hazardType === "string" ? c.hazardType : "Lava (instant death)",
    rewardDescription: typeof c.rewardDescription === "string" ? c.rewardDescription : "",
  };
}

function genGrid(size: number, hazardRate: number, seed: number) {
  let s = seed;
  const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const grid: Cell[][] = [];
  for (let y = 0; y < size; y++) {
    grid[y] = [];
    for (let x = 0; x < size; x++) {
      grid[y][x] = rnd() < hazardRate ? "hazard" : "empty";
    }
  }
  grid[0][0] = "agent";
  grid[size - 1][size - 1] = "goal";
  return grid;
}

function runPolicy(grid: Cell[][], informed: boolean, maxSteps: number) {
  const n = grid.length;
  const path: { x: number; y: number }[] = [{ x: 0, y: 0 }];
  let x = 0, y = 0;
  let alive = true;

  for (let step = 0; step < maxSteps; step++) {
    if (x === n - 1 && y === n - 1) break;

    let nx = x, ny = y;
    if (informed) {
      const goalX = n - 1, goalY = n - 1;
      const candidates = [
        { dx: 1, dy: 0 }, { dx: 0, dy: 1 },
        { dx: -1, dy: 0 }, { dx: 0, dy: -1 },
      ]
        .map(({ dx, dy }) => ({ x: x + dx, y: y + dy }))
        .filter((c) => c.x >= 0 && c.y >= 0 && c.x < n && c.y < n);

      const safe = candidates.filter((c) => grid[c.y][c.x] !== "hazard");
      const pool = safe.length > 0 ? safe : candidates;
      pool.sort((a, b) =>
        Math.abs(a.x - goalX) + Math.abs(a.y - goalY) -
        (Math.abs(b.x - goalX) + Math.abs(b.y - goalY))
      );
      nx = pool[0].x;
      ny = pool[0].y;
    } else {
      const moves = [
        { x: x + 1, y }, { x, y: y + 1 },
        { x: x - 1, y }, { x, y: y - 1 },
      ].filter((c) => c.x >= 0 && c.y >= 0 && c.x < n && c.y < n);
      const goalX = n - 1, goalY = n - 1;
      moves.sort((a, b) =>
        Math.abs(a.x - goalX) + Math.abs(a.y - goalY) -
        (Math.abs(b.x - goalX) + Math.abs(b.y - goalY))
      );
      nx = moves[0].x;
      ny = moves[0].y;
    }

    x = nx;
    y = ny;
    path.push({ x, y });

    if (grid[y][x] === "hazard") {
      alive = false;
      break;
    }
  }

  const reached = x === n - 1 && y === n - 1;
  return { path, alive, reached };
}

export default function GridworldRL({ game }: { game: PaperArtifact["game"] }) {
  const size = Number(game.params.gridSize ?? 8);
  const hazardRate = Number(game.params.hazards ?? 0.15);
  const maxSteps = Number(game.params.maxSteps ?? 40);
  const themed = useMemo(() => parseGridContent(game.content), [game.content]);

  const [usePowerup, setUsePowerup] = useState(false);
  const [seed, setSeed] = useState(42);
  const [running, setRunning] = useState(false);

  const grid = useMemo(() => genGrid(size, hazardRate, seed), [size, hazardRate, seed]);
  const result = useMemo(
    () => running ? runPolicy(grid, usePowerup, maxSteps) : null,
    [grid, usePowerup, maxSteps, running]
  );

  const pathSet = useMemo(
    () => new Set((result?.path || []).map((p) => p.x + "," + p.y)),
    [result]
  );

  const status = !running ? "idle" : result?.alive && result.reached ? "won" : "lost";
  const reset = useCallback(() => { setRunning(false); setSeed((s) => s + 1); }, []);

  const px = 28;
  return (
    <GameFrame
      goal={game.goal || "Get the agent to the flag alive."}
      baselineLabel={game.baselineLabel || "Naive policy (sparse reward)"}
      powerupLabel={game.powerupLabel || "Shaped-reward policy"}
      claim={game.claim}
      usePowerup={usePowerup}
      onToggle={(v) => { setUsePowerup(v); setRunning(false); }}
      score={!running ? "press run" : result?.alive && result.reached ? "survived" : result?.alive ? "stuck" : "died"}
      status={status as "won" | "lost"}
      onReset={reset}
    >
      <div className="space-y-3">
        <div className="flex flex-col items-center gap-3">
          <svg width={size * px} height={size * px} className="rounded">
            {grid.map((row, y) =>
              row.map((cell, x) => {
                const k = x + "," + y;
                const isStart = x === 0 && y === 0;
                const isGoal = x === size - 1 && y === size - 1;
                const onPath = pathSet.has(k);
                const isDead = result && !result.alive && result.path[result.path.length - 1].x === x && result.path[result.path.length - 1].y === y;

                let fill = "#0e0e18";
                if (cell === "hazard") fill = "#dc262633";
                if (isStart) fill = "#22d3ee";
                if (isGoal) fill = "#34d399";
                if (onPath && !isStart && !isGoal) fill = isDead ? "#f87171" : usePowerup ? "#7c5cff55" : "#f8717155";

                return (
                  <g key={k}>
                    <rect x={x * px} y={y * px} width={px - 1} height={px - 1} fill={fill} />
                    {cell === "hazard" && (
                      <text x={x * px + px / 2} y={y * px + px / 2 + 5} textAnchor="middle" fontSize={14}>🔥</text>
                    )}
                    {isStart && !onPath && (
                      <text x={x * px + px / 2} y={y * px + px / 2 + 5} textAnchor="middle" fontSize={14}>🤖</text>
                    )}
                    {onPath && result && result.path[result.path.length - 1].x === x && result.path[result.path.length - 1].y === y && (
                      <text x={x * px + px / 2} y={y * px + px / 2 + 5} textAnchor="middle" fontSize={14}>
                        {isDead ? "💀" : "🤖"}
                      </text>
                    )}
                    {isGoal && (
                      <text x={x * px + px / 2} y={y * px + px / 2 + 5} textAnchor="middle" fontSize={14}>🏁</text>
                    )}
                  </g>
                );
              })
            )}
          </svg>

          <button className="btn-primary py-1.5 px-4 text-sm" onClick={() => setRunning(true)}>
            Run episode
          </button>
        </div>

        {running && result && (
          <p className="text-sm text-center">
            {result.alive && result.reached
              ? <span className="text-good">Agent reached the goal in {result.path.length - 1} steps!</span>
              : result.alive
              ? <span className="text-bad">Agent got stuck after {result.path.length - 1} steps.</span>
              : <span className="text-bad">Agent died on step {result.path.length - 1} — stepped into {themed.hazardType.toLowerCase()}.</span>}
          </p>
        )}

        {themed.rewardDescription && (
          <p className="text-xs text-gray-400 italic text-center">{themed.rewardDescription}</p>
        )}

        <p className="text-xs text-gray-500 text-center">
          {usePowerup
            ? "Shaped reward avoids hazards and navigates to the goal."
            : "Sparse reward gives no signal until the goal — the agent walks into hazards."}
        </p>
      </div>
    </GameFrame>
  );
}
