import test from "node:test";
import assert from "node:assert/strict";
import { computeCost, BASELINE_SETTINGS } from "./cost.ts";
import type { ModelSpec, Settings } from "./types.ts";

const M: ModelSpec = {
  paramsB: 7,
  kvBytesPerToken: 0.0005,
  hardware: { name: "A100-40GB", tflops: 312, bandwidthGBs: 1555, memoryGB: 40 },
};

const at = (s: Partial<Settings>): Settings => ({ ...BASELINE_SETTINGS, ...s });

test("speed is computed, not narrated: same input -> identical output", () => {
  const a = computeCost(at({ precisionBits: 4 }), M);
  const b = computeCost(at({ precisionBits: 4 }), M);
  assert.deepEqual(a, b);
});

test("baseline (fp16, dense, batch 1) is exactly 1x", () => {
  const r = computeCost(BASELINE_SETTINGS, M);
  assert.ok(Math.abs(r.speedup - 1) < 1e-9, `expected 1x, got ${r.speedup}`);
});

test("lower precision is faster (memory-bound decode)", () => {
  const fp16 = computeCost(at({ precisionBits: 16 }), M).speedup;
  const int8 = computeCost(at({ precisionBits: 8 }), M).speedup;
  const int4 = computeCost(at({ precisionBits: 4 }), M).speedup;
  assert.ok(int4 > int8 && int8 > fp16, `expected int4>int8>fp16, got ${int4}/${int8}/${fp16}`);
});

test("sparsity increases speedup", () => {
  const dense = computeCost(at({ precisionBits: 4, sparsity: 0 }), M).speedup;
  const sparse = computeCost(at({ precisionBits: 4, sparsity: 0.5 }), M).speedup;
  assert.ok(sparse > dense, `expected sparse>dense, got ${sparse} vs ${dense}`);
});

test("AWQ operating point (4-bit, dense) lands in the reported ~3x ballpark", () => {
  const r = computeCost(at({ precisionBits: 4 }), M);
  assert.ok(r.speedup > 3 && r.speedup < 4.5, `expected ~3-4x, got ${r.speedup}`);
});

test("batch size amortizes weight loading -> higher throughput speedup", () => {
  const b1 = computeCost(at({ batchSize: 1 }), M).speedup;
  const b8 = computeCost(at({ batchSize: 8 }), M).speedup;
  assert.ok(b8 > b1, `expected batch-8 faster than batch-1, got ${b8} vs ${b1}`);
});

test("batch size & KV never appear in the quality path — only memory/speed here", () => {
  // Pushing batch + KV past capacity is a memory wall, not a slowdown-to-zero.
  const ok = computeCost(at({ batchSize: 1, kvCacheTokens: 1024 }), M);
  const wall = computeCost(at({ batchSize: 64, kvCacheTokens: 8192 }), M);
  assert.equal(ok.memoryWall, false);
  assert.equal(wall.memoryWall, true);
});

test("fp16 + large batch overruns the 40 GB memory wall", () => {
  assert.equal(computeCost(at({ batchSize: 64 }), M).memoryWall, true);
});
