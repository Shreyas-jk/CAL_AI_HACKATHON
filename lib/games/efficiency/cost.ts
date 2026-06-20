import type { ModelSpec, Settings } from "./types";

// ----------------------------------------------------------------------------
// Faithfulness core: speed is COMPUTED from the settings, never narrated.
//
// A roofline model of single-step LLM decode:
//   - weights are streamed from HBM once per step; precision & sparsity shrink
//     them (this is the dominant term for low batch — decode is memory bound)
//   - the KV cache is streamed once per step; it scales with batch x context
//   - compute scales with batch x active-params; low precision raises throughput
//   - step latency = max(memory time, compute time)   (the roofline)
//   - speedup = throughput(settings) / throughput(fp16, dense, batch 1)
//
// Quality lives entirely in grid.ts. This file knows nothing about quality —
// batch size and kv cache move ONLY the numbers below, never quality.
// ----------------------------------------------------------------------------

export interface CostResult {
  latencyMsPerStep: number;     // wall time for one decode step (ms)
  throughputTokPerSec: number;  // tokens/sec across the batch
  speedup: number;              // vs fp16 / dense / batch-1 baseline
  memoryUsedGB: number;         // weights + KV + activation working set
  memoryWall: boolean;          // memoryUsedGB > hardware.memoryGB
  computeBound: boolean;        // compute time dominated memory time
}

const BYTES_PER_GB = 1e9;
const ACTIVATION_GB_PER_SEQ = 0.064; // modeled per-sequence activation working set

export const BASELINE_SETTINGS: Settings = {
  precisionBits: 16,
  sparsity: 0,
  batchSize: 1,
  kvCacheTokens: 1024,
};

function rawCost(s: Settings, m: ModelSpec) {
  const params = m.paramsB * 1e9;
  const active = 1 - s.sparsity;

  // Weights: streamed once per step, shrunk by precision and sparsity.
  const weightBytes = params * (s.precisionBits / 8) * active;
  // KV cache: streamed once per step, scales with batch and context length.
  const kvBytes = s.batchSize * s.kvCacheTokens * m.kvBytesPerToken * BYTES_PER_GB;
  const memBytes = weightBytes + kvBytes;

  const bandwidth = m.hardware.bandwidthGBs * BYTES_PER_GB; // bytes/sec
  const memTime = memBytes / bandwidth;

  // Compute: 2 FLOPs/param/token (fwd pass), low precision raises peak throughput.
  const flops = 2 * params * active * s.batchSize;
  const effTflops = m.hardware.tflops * (16 / s.precisionBits);
  const computeTime = flops / (effTflops * 1e12);

  const stepTime = Math.max(memTime, computeTime);
  const throughput = s.batchSize / stepTime;

  const memoryUsedGB =
    weightBytes / BYTES_PER_GB +
    kvBytes / BYTES_PER_GB +
    s.batchSize * ACTIVATION_GB_PER_SEQ;

  return { stepTime, throughput, memoryUsedGB, memTime, computeTime };
}

export function computeCost(s: Settings, m: ModelSpec): CostResult {
  const cur = rawCost(s, m);
  const base = rawCost(BASELINE_SETTINGS, m);
  return {
    latencyMsPerStep: cur.stepTime * 1000,
    throughputTokPerSec: cur.throughput,
    speedup: cur.throughput / base.throughput,
    memoryUsedGB: cur.memoryUsedGB,
    memoryWall: cur.memoryUsedGB > m.hardware.memoryGB,
    computeBound: cur.computeTime > cur.memTime,
  };
}
