import type { QualityModel, RetentionCurve, Settings } from "./types";

// ----------------------------------------------------------------------------
// Channel-coverage quality model — AWQ's insight made computable.
//
// A few weight channels (the ones with the largest activations) carry most of
// the model's quality. Keep those at high precision and you can crush the rest
// to 4-bit nearly losslessly. So quality depends on WHICH channels you protect
// relative to their importance — not just the global precision dial.
//
//   quality = [ crush(precisionBits) + (1 - crush) * coverage ] * sparsityFactor
//
//   crush     = retention of an unprotected channel at the global precision
//   coverage  = share of total importance carried by the protected channels
//   "naive"   = coverage 0 (uniform crush) — the brute-force wall
//
// Deterministic arithmetic over per-paper data. Never narrated by an LLM.
// cost.ts (speed) is unaffected: protecting a tiny set barely changes memory.
// ----------------------------------------------------------------------------

// Linear interpolation on a monotonic curve (x ascending or descending), clamped.
function interp(x: number, c: RetentionCurve): number {
  const xs = c.x, ys = c.retention;
  const lo = Math.min(xs[0], xs[xs.length - 1]);
  const hi = Math.max(xs[0], xs[xs.length - 1]);
  const cx = Math.max(lo, Math.min(hi, x));
  for (let i = 0; i < xs.length - 1; i++) {
    const a = xs[i], b = xs[i + 1];
    if (cx >= Math.min(a, b) && cx <= Math.max(a, b)) {
      const t = a === b ? 0 : (cx - a) / (b - a);
      return ys[i] + (ys[i + 1] - ys[i]) * t;
    }
  }
  return ys[ys.length - 1];
}

export function totalImportance(importances: number[]): number {
  return importances.reduce((a, b) => a + b, 0);
}

/** Share of total importance carried by the protected channel indices (0..1). */
export function coverageOf(protect: number[], importances: number[]): number {
  const total = totalImportance(importances);
  if (total <= 0) return 0;
  let s = 0;
  for (const i of protect) if (importances[i] != null) s += importances[i];
  return s / total;
}

/** Best coverage achievable: protect the `protectBudget` most-important channels. */
export function maxCoverage(q: QualityModel): number {
  const total = totalImportance(q.channels.importances) || 1;
  const sorted = [...q.channels.importances].sort((a, b) => b - a);
  let s = 0;
  for (let i = 0; i < Math.min(q.channels.protectBudget, sorted.length); i++) s += sorted[i];
  return s / total;
}

/** Indices of the `protectBudget` most-important channels (the correct protect set). */
export function salientIndices(q: QualityModel): number[] {
  return q.channels.importances
    .map((v, i) => [v, i] as const)
    .sort((a, b) => b[0] - a[0])
    .slice(0, q.channels.protectBudget)
    .map(([, i]) => i);
}

export function computeQuality(
  s: Pick<Settings, "precisionBits" | "sparsity">,
  coverage: number,
  q: QualityModel,
): number {
  const crush = interp(s.precisionBits, q.crush);     // crushed-channel retention
  const base = crush + (1 - crush) * coverage;         // protected channels keep full contribution
  const sparsityFactor = interp(s.sparsity, q.sparsity);
  return Math.max(0, Math.min(1, base * sparsityFactor));
}
