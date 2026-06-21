// Types for the shipped CRAG replay grid (lib/games/rag/data/grid.json).
// The UI is fully deterministic over this data — ZERO runtime model calls.
// No embeddings and no hidden verdicts are present in the shipped files.

export type RagAction = "naive" | "refine" | "web" | "hybrid";

/** Router zones the player configures (naive is the no-router baseline). */
export type RouterAction = "web" | "hybrid" | "refine";

export interface RagCell {
  retrieved: string[];     // chunk_ids used as context for this action
  quality_signal: number;  // max cosine of the top-k (same for every action of a query)
  answer: string;          // the answer this action's grounded generation produced
  correct: boolean;        // precomputed judge verdict
  cost: number;
}

export interface RagQuery {
  query_id: string;
  text: string;
  gold_answer: string;     // the factual answer (NOT the hidden correct/ambiguous/incorrect verdict)
  quality_signal: number;
}

export interface RagGrid {
  meta: {
    k: number;
    budget: number;
    actions: RagAction[];
    cost: Record<RagAction, number>;
    embedModel: string;
    genModel: string;
  };
  queries: RagQuery[];
  cells: Record<string, Record<RagAction, RagCell>>;
}

// ---- router + scoring (pure, deterministic) -------------------------------

/** The CRAG evaluator: route a query to an action by its retrieval quality. */
export function routeAction(signal: number, tLow: number, tHigh: number): RouterAction {
  if (signal < tLow) return "web";
  if (signal < tHigh) return "hybrid";
  return "refine";
}

export interface WaveResult {
  perQuery: { query_id: string; action: RagAction; correct: boolean; cost: number }[];
  correct: number;
  total: number;
  cost: number;
  accuracy: number; // 0..1
  won: boolean;
}

/** Score a wave. `assign` maps each query to the action it runs (naive baseline or routed). */
export function scoreWave(grid: RagGrid, assign: (q: RagQuery) => RagAction): WaveResult {
  const perQuery = grid.queries.map((q) => {
    const action = assign(q);
    const cell = grid.cells[q.query_id][action];
    return { query_id: q.query_id, action, correct: cell.correct, cost: cell.cost };
  });
  const correct = perQuery.filter((p) => p.correct).length;
  const cost = perQuery.reduce((s, p) => s + p.cost, 0);
  const total = perQuery.length;
  const accuracy = total ? correct / total : 0;
  return { perQuery, correct, total, cost, accuracy, won: accuracy >= 0.9 && cost <= grid.meta.budget };
}
