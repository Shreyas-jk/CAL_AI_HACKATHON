"use client";
import { useMemo, useState, useCallback } from "react";
import GameFrame from "../GameFrame";
import type { PaperArtifact } from "@/lib/types";

type Cell = { x: number; y: number };
const key = (c: Cell) => c.x + "," + c.y;

function genMaze(n: number, wallP: number, seed: number) {
  let s = seed;
  const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const grid: boolean[][] = []; // true = wall
  for (let y = 0; y < n; y++) { grid[y] = []; for (let x = 0; x < n; x++) grid[y][x] = rnd() < wallP; }
  grid[0][0] = false; grid[n - 1][n - 1] = false;
  return grid;
}

function neighbors(c: Cell, n: number, grid: boolean[][]) {
  const out: Cell[] = [];
  for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
    const x = c.x + dx, y = c.y + dy;
    if (x >= 0 && y >= 0 && x < n && y < n && !grid[y][x]) out.push({ x, y });
  }
  return out;
}

// Returns the set of expanded nodes (search order) and whether goal reached, within budget.
function search(grid: boolean[][], n: number, budget: number, informed: boolean) {
  const start = { x: 0, y: 0 }, goal = { x: n - 1, y: n - 1 };
  const h = (c: Cell) => Math.abs(c.x - goal.x) + Math.abs(c.y - goal.y); // learned-ish heuristic
  const frontier: { c: Cell; g: number; f: number }[] = [{ c: start, g: 0, f: informed ? h(start) : 0 }];
  const seen = new Set<string>([key(start)]);
  const expanded: Cell[] = [];
  while (frontier.length && expanded.length < budget) {
    frontier.sort((a, b) => a.f - b.f);
    const cur = frontier.shift()!;
    expanded.push(cur.c);
    if (cur.c.x === goal.x && cur.c.y === goal.y) return { expanded, reached: true };
    for (const nb of neighbors(cur.c, n, grid)) {
      if (seen.has(key(nb))) continue;
      seen.add(key(nb));
      const g = cur.g + 1;
      frontier.push({ c: nb, g, f: informed ? g + h(nb) : g });
    }
  }
  return { expanded, reached: false };
}

function parsePathfindingContent(content?: Record<string, unknown>) {
  const c = content || {};
  return {
    scenarioContext: typeof c.scenarioContext === "string" ? c.scenarioContext : "",
    heuristicDescription: typeof c.heuristicDescription === "string" ? c.heuristicDescription : "",
  };
}

export default function Pathfinding({ game }: { game: PaperArtifact["game"] }) {
  const themed = useMemo(() => parsePathfindingContent(game.content), [game.content]);
  const n = Number(game.params.gridSize ?? 15);
  const wallP = Number(game.params.walls ?? 0.28);
  const budget = Number(game.params.budget ?? 60);
  const [usePowerup, setUsePowerup] = useState(false);
  const [seed, setSeed] = useState(7);
  const grid = useMemo(() => genMaze(n, wallP, seed), [n, wallP, seed]);
  const result = useMemo(() => search(grid, n, budget, usePowerup), [grid, n, budget, usePowerup]);

  const status: "won" | "lost" = result.reached ? "won" : "lost";
  const expandedSet = useMemo(() => new Set(result.expanded.map(key)), [result]);
  const reset = useCallback(() => setSeed((s) => s + 1), []);

  const px = 22;
  return (
    <GameFrame
      goal={game.goal}
      baselineLabel={game.baselineLabel}
      powerupLabel={game.powerupLabel}
      claim={game.claim}
      usePowerup={usePowerup}
      onToggle={setUsePowerup}
      score={`expanded ${result.expanded.length}/${budget}`}
      status={status}
      onReset={reset}
    >
      <div className="flex flex-col items-center gap-3">
        <svg width={n * px} height={n * px} className="rounded">
          {grid.map((row, y) => row.map((wall, x) => {
            const k = x + "," + y;
            const isStart = x === 0 && y === 0;
            const isGoal = x === n - 1 && y === n - 1;
            const fill = wall ? "#1f2030" : isStart ? "#22d3ee" : isGoal ? "#34d399"
              : expandedSet.has(k) ? (usePowerup ? "#7c5cff55" : "#f8717155") : "#0e0e18";
            return <rect key={k} x={x*px} y={y*px} width={px-1} height={px-1} fill={fill} />;
          }))}
        </svg>
        <p className="text-sm">
          {result.reached
            ? <span className="text-good">Reached the goal with {result.expanded.length} expansions.</span>
            : <span className="text-bad">Budget exhausted after {result.expanded.length} expansions — no path found.</span>}
        </p>
        {themed.scenarioContext && <p className="text-xs text-gray-400 italic">{themed.scenarioContext}</p>}
        {themed.heuristicDescription && usePowerup && <p className="text-xs text-accent2">{themed.heuristicDescription}</p>}
        <p className="text-xs text-gray-500">
          Toggle to {usePowerup ? "the naive baseline to watch it fail" : "the paper's heuristic to see it focus the search"}.
        </p>
      </div>
    </GameFrame>
  );
}