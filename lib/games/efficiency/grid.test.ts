import test from "node:test";
import assert from "node:assert/strict";
import { computeQuality, coverageOf, maxCoverage, salientIndices } from "./grid.ts";
import { SAMPLE_EFFICIENCY_PAPER as P } from "./sample.ts";

const q = P.quality;
const imp = q.channels.importances;
const floor = P.collapseFloor;          // 0.5
const qFloor = P.paperPoint.quality;    // 0.99
const hot = salientIndices(q);

const at4 = (coverage: number, sparsity = 0) => computeQuality({ precisionBits: 4, sparsity }, coverage, q);

test("quality is computed & deterministic", () => {
  assert.equal(at4(coverageOf(hot, imp)), at4(coverageOf(hot, imp)));
});

test("uniform 4-bit crush (no protection) collapses below the breakdown floor", () => {
  assert.ok(at4(0) < floor, `expected <${floor}, got ${at4(0)}`);
});

test("protecting the salient channels holds quality at 4-bit (>= paper quality)", () => {
  const Q = at4(coverageOf(hot, imp));
  assert.ok(Q >= qFloor - 0.005, `expected >=${qFloor}, got ${Q}`);
});

test("protecting the WRONG (cold) channels still collapses — installing isn't enough", () => {
  const cold = [0, 1, 2, 3];
  assert.ok(at4(coverageOf(cold, imp)) < floor, `cold protect should collapse, got ${at4(coverageOf(cold, imp))}`);
});

test("partial protection gives DEGREES of closeness, monotonically", () => {
  const q1 = at4(coverageOf([hot[0]], imp));
  const q2 = at4(coverageOf([hot[0], hot[1]], imp));
  const q3 = at4(coverageOf([hot[0], hot[1], hot[2]], imp));
  assert.ok(q1 < q2 && q2 < q3, `expected monotone, got ${q1} < ${q2} < ${q3}`);
  assert.ok(q1 > floor, "one salient channel should already lift off the floor");
});

test("the salient channels carry the overwhelming majority of importance", () => {
  assert.ok(maxCoverage(q) > 0.95, `expected heavy-tailed profile, got ${maxCoverage(q)}`);
});

test("higher precision needs less coverage; sparsity only ever hurts", () => {
  assert.ok(computeQuality({ precisionBits: 8, sparsity: 0 }, 0, q) > computeQuality({ precisionBits: 4, sparsity: 0 }, 0, q));
  const cov = coverageOf(hot, imp);
  assert.ok(computeQuality({ precisionBits: 4, sparsity: 0.5 }, cov, q) < computeQuality({ precisionBits: 4, sparsity: 0 }, cov, q));
});
