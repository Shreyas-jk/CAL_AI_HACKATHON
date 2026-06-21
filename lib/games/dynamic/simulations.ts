import type {
  DataPoint,
  PipelineStage,
  PipelineItem,
} from "../../gameSpec";

// ---- Curve interpolation ----

export function interpolateSeries(
  points: DataPoint[],
  x: number,
): number {
  if (points.length === 0) return 0;
  if (points.length === 1) return points[0].y;
  const sorted = [...points].sort((a, b) => a.x - b.x);
  if (x <= sorted[0].x) return sorted[0].y;
  if (x >= sorted[sorted.length - 1].x) return sorted[sorted.length - 1].y;
  for (let i = 0; i < sorted.length - 1; i++) {
    if (x >= sorted[i].x && x <= sorted[i + 1].x) {
      const t =
        (x - sorted[i].x) / (sorted[i + 1].x - sorted[i].x);
      return sorted[i].y + t * (sorted[i + 1].y - sorted[i].y);
    }
  }
  return sorted[sorted.length - 1].y;
}

// ---- Pipeline simulation ----

export interface PipelineResult {
  accuracy: number;
  latency: number;
  itemResults: { id: string; passed: boolean }[];
}

export function simulatePipeline(
  stages: PipelineStage[],
  enabledIds: Set<string>,
  baselineAccuracy: number,
  items: PipelineItem[],
): PipelineResult {
  let accuracy = baselineAccuracy;
  let latency = 0;
  for (const stage of stages) {
    if (enabledIds.has(stage.id)) {
      accuracy = Math.min(1, Math.max(0, accuracy + stage.effect.accuracyDelta));
      latency += stage.effect.latencyMs;
    }
  }
  const itemResults = items.map((item) => ({
    id: item.id,
    passed: Math.random() < accuracy * (1 - item.difficulty * 0.5),
  }));
  return { accuracy, latency, itemResults };
}

export function simulatePipelineDeterministic(
  stages: PipelineStage[],
  enabledIds: Set<string>,
  baselineAccuracy: number,
  items: PipelineItem[],
  seed: number,
): PipelineResult {
  let accuracy = baselineAccuracy;
  let latency = 0;
  for (const stage of stages) {
    if (enabledIds.has(stage.id)) {
      accuracy = Math.min(1, Math.max(0, accuracy + stage.effect.accuracyDelta));
      latency += stage.effect.latencyMs;
    }
  }
  const rng = mulberry32(seed);
  const itemResults = items.map((item) => ({
    id: item.id,
    passed: rng() < accuracy * (1 - item.difficulty * 0.5),
  }));
  return { accuracy, latency, itemResults };
}

// ---- Sampling simulation ----

export interface SamplingResult {
  samples: { id: number; accuracy: number; selected: boolean }[];
  finalAccuracy: number;
}

export function simulateSampling(
  distribution: number[],
  sampleCount: number,
  votingMethod: string,
  verifierAccuracy: number,
  seed: number,
): SamplingResult {
  const rng = mulberry32(seed);
  const count = Math.min(sampleCount, distribution.length);
  const indices = shuffle(
    Array.from({ length: distribution.length }, (_, i) => i),
    rng,
  ).slice(0, count);

  const samples = indices.map((idx, i) => ({
    id: i + 1,
    accuracy: distribution[idx],
    selected: false,
  }));

  let selectedIdx = 0;
  if (votingMethod === "majority" || votingMethod === "weighted") {
    let bestScore = -1;
    for (let i = 0; i < samples.length; i++) {
      const noise = votingMethod === "weighted"
        ? verifierAccuracy
        : 0.5;
      const score = samples[i].accuracy * noise + rng() * (1 - noise);
      if (score > bestScore) {
        bestScore = score;
        selectedIdx = i;
      }
    }
  }

  samples[selectedIdx].selected = true;
  return {
    samples,
    finalAccuracy: samples[selectedIdx].accuracy,
  };
}

// ---- Grid search simulation ----

type Cell = { x: number; y: number };

export interface GridSearchResult {
  expanded: Cell[];
  reached: boolean;
  path: Cell[];
}

export function simulateGridSearch(
  grid: string[][],
  start: [number, number],
  goal: [number, number],
  budget: number,
  useHeuristic: boolean,
  wallState: string,
): GridSearchResult {
  const rows = grid.length;
  const cols = grid[0]?.length || 0;
  const key = (c: Cell) => c.x + "," + c.y;
  const h = (c: Cell) =>
    Math.abs(c.x - goal[0]) + Math.abs(c.y - goal[1]);

  const startCell = { x: start[0], y: start[1] };
  const goalCell = { x: goal[0], y: goal[1] };

  const frontier: { c: Cell; g: number; f: number }[] = [
    { c: startCell, g: 0, f: useHeuristic ? h(startCell) : 0 },
  ];
  const seen = new Set<string>([key(startCell)]);
  const parent = new Map<string, string>();
  const expanded: Cell[] = [];

  while (frontier.length > 0 && expanded.length < budget) {
    frontier.sort((a, b) => a.f - b.f);
    const cur = frontier.shift()!;
    expanded.push(cur.c);

    if (cur.c.x === goalCell.x && cur.c.y === goalCell.y) {
      const path: Cell[] = [];
      let k = key(goalCell);
      while (k) {
        const [x, y] = k.split(",").map(Number);
        path.unshift({ x, y });
        k = parent.get(k)!;
      }
      return { expanded, reached: true, path };
    }

    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cur.c.x + dx;
      const ny = cur.c.y + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      if (grid[ny][nx] === wallState) continue;
      const nk = nx + "," + ny;
      if (seen.has(nk)) continue;
      seen.add(nk);
      parent.set(nk, key(cur.c));
      const g = cur.g + 1;
      frontier.push({
        c: { x: nx, y: ny },
        g,
        f: useHeuristic ? g + h({ x: nx, y: ny }) : g,
      });
    }
  }

  return { expanded, reached: false, path: [] };
}

// ---- Utilities ----

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const b = arr.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}
