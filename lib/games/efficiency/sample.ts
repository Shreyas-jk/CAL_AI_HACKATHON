import type { EfficiencyToolParams } from "./types";

// ----------------------------------------------------------------------------
// Sample payload — a REAL paper: AWQ (Activation-aware Weight Quantization,
// Lin et al., 2023). 4-bit weight-only quantization that protects the ~1% of
// salient weight channels (chosen by activation magnitude) with a per-channel
// scale, giving near-lossless 4-bit LLMs and a ~3x decode speedup from the
// reduced weight-memory traffic. AWQ does NOT prune, so its operating point
// sits at sparsity 0.
//
// The cost roofline (cost.ts) is real arithmetic. The quality GRID is MOCK
// (hand-authored, plausible, clearly marked) — but the paper's operating point
// and the "trick" match the real method. Swap the grid for measured data later
// without touching the engine.
// ----------------------------------------------------------------------------

export const SAMPLE_EFFICIENCY_PAPER: EfficiencyToolParams = {
  title: "AWQ: Activation-aware Weight Quantization for LLM Compression",
  summary:
    "Quantizing LLM weights to 4-bit naively (round-to-nearest) costs real accuracy. " +
    "AWQ observes that a tiny fraction of weight channels — the ones multiplied by " +
    "large activations — matter most, and protects them with a per-channel scale. " +
    "The result is near-lossless 4-bit inference with a ~3x decode speedup.",

  model: {
    paramsB: 7,
    kvBytesPerToken: 0.0005, // ~0.5 MB/token for a 7B model (fp16 KV)
    hardware: { name: "A100-40GB", tflops: 312, bandwidthGBs: 1555, memoryGB: 40 },
  },

  knobs: [
    { id: "precisionBits", label: "Weight precision", unit: "bits", kind: "discrete",
      options: [16, 8, 4, 3, 2], default: 16, costsQuality: true },
    { id: "sparsity", label: "Sparsity", unit: "frac", kind: "continuous",
      min: 0, max: 0.9, step: 0.05, default: 0, costsQuality: true },
    { id: "batchSize", label: "Batch size", unit: "seqs", kind: "discrete",
      options: [1, 2, 4, 8, 16, 32, 64], default: 1, costsQuality: false },
    { id: "kvCacheTokens", label: "KV-cache length", unit: "tok", kind: "continuous",
      min: 256, max: 8192, step: 256, default: 1024, costsQuality: false },
  ],

  quality: {
    // 48 weight channels. A few carry huge activations (the salient channels);
    // the rest are near-zero. Protecting the salient ones is the whole game.
    // Hot channels live at indices 5, 18, 37. (MOCK profile, but heavy-tailed
    // exactly as AWQ describes activation outliers — swap for measured stats.)
    channels: {
      importances: [
        0.04, 0.03, 0.06, 0.02, 0.05, 52.0, 0.03, 0.07, 0.02, 0.05,
        0.04, 0.08, 0.03, 0.02, 0.06, 0.04, 0.03, 0.05, 34.0, 0.04,
        0.02, 0.07, 0.03, 0.05, 0.04, 0.02, 0.06, 0.03, 0.05, 0.04,
        0.03, 0.08, 0.02, 0.05, 0.04, 0.03, 0.06, 16.0, 0.04, 0.02,
        0.05, 0.03, 0.07, 0.04, 0.02, 0.06, 0.03, 0.05,
      ],
      protectBudget: 4, // keep ~a handful at high precision — the "~1%" idea, scaled to the bank
    },
    // Retention of an UNPROTECTED channel as the global dial crushes it. At 4-bit
    // a crushed channel keeps <half its quality — so uniform 4-bit destroys the
    // salient ones and the model collapses unless they're protected.
    crush: { x: [16, 8, 4, 3, 2], retention: [1.0, 0.92, 0.42, 0.25, 0.1] },
    // Pruning hurts globally regardless of protection (strip too much -> chassis falls apart).
    sparsity: { x: [0, 0.25, 0.5, 0.75, 0.9], retention: [1.0, 0.95, 0.85, 0.65, 0.4] },
    note: "MOCK channel-importance profile (hand-authored, heavy-tailed like real activation outliers). Swap for measured per-channel stats.",
  },

  // ENGINE part — competing quantization technologies. The test car runs AWQ
  // (the best), but AWQ only wins if you actually find & protect the salient
  // channels; lazily it's worse than GPTQ. That's the Forza "best part still
  // needs tuning" lesson.
  engineTechs: [
    { id: "rtn", name: "Round-to-nearest (RTN)",
      blurb: "Snap every weight to the nearest level. Cheap and uniform — but it crushes the salient channels too, so 4-bit collapses.",
      coverage: { mode: "none" } },
    { id: "gptq", name: "GPTQ (error-corrected)",
      blurb: "Quantize greedily while correcting error layer by layer. Recovers a lot automatically — but it isn't activation-aware, so it can't fully protect the outlier channels. Gets close, never matches.",
      coverage: { mode: "fixed", value: 0.85 } },
    { id: "awq", name: "AWQ (activation-aware)",
      blurb: "Automatically finds the channels with the biggest activations and protects them at high precision. Near-lossless at 4-bit — the test car's engine.",
      coverage: { mode: "fixed", value: 0.983 }, best: true },
  ],

  // TIRES part — pruning compounds. The paper doesn't prune, so slicks (0%) is best.
  tireCompounds: [
    { id: "slicks", name: "Slicks — no pruning", blurb: "Keep every weight. Full quality, least speed. What the test car runs.", sparsity: 0, best: true },
    { id: "mediums", name: "Mediums — 25% pruned", blurb: "Drop a quarter of the weights. A little faster; a small quality hit.", sparsity: 0.25 },
    { id: "softs", name: "Softs — 50% pruned", blurb: "Strip half the weights. Fast, but quality gets fragile.", sparsity: 0.5 },
  ],

  paperPoint: {
    speedupReported: 3.2,
    quality: 0.99,
    settings: { precisionBits: 4, sparsity: 0, batchSize: 1, kvCacheTokens: 1024 },
  },

  collapseFloor: 0.5,

  trick: {
    name: "AWQ scaling",
    method: "Activation-aware weight scaling",
    plainEnglish:
      "Not all weights are equal. AWQ finds the ~1% of weight channels that get " +
      "multiplied by the largest activations and gives them a protective per-channel " +
      "scale before quantizing. Those few channels carry most of the model's accuracy, " +
      "so protecting them lets the other 99% drop to 4-bit almost for free — reaching the " +
      "speed of aggressive quantization while keeping fp16-level quality. That is the " +
      "Pareto point naive round-to-nearest can never hit.",
  },

  conceptMap: {
    nodes: [
      { id: "fp16", label: "FP16 weights", group: "baseline" },
      { id: "quant", label: "4-bit Quantization", group: "core" },
      { id: "rtn", label: "Round-to-nearest", group: "baseline" },
      { id: "salient", label: "Salient channels (~1%)", group: "contribution" },
      { id: "scale", label: "Activation-aware scale", group: "contribution" },
      { id: "speed", label: "~3x decode speedup", group: "outcome" },
      { id: "quality", label: "Near-lossless quality", group: "outcome" },
    ],
    edges: [
      { source: "fp16", target: "quant", label: "compress" },
      { source: "quant", target: "rtn", label: "naive" },
      { source: "rtn", target: "quality", label: "hurts" },
      { source: "salient", target: "scale", label: "protect" },
      { source: "scale", target: "quant", label: "guides" },
      { source: "scale", target: "quality", label: "preserves" },
      { source: "quant", target: "speed", label: "less memory" },
    ],
  },
};
