import type { ConceptNode, ConceptEdge } from "@/lib/types";

// ----------------------------------------------------------------------------
// Efficiency / quantization "Race the Paper" — tradeoff engine types.
//
// This is the first concrete instance of CLAUDE.md's `GameSpec` contract,
// specialised to the `tradeoff` archetype. It is intentionally richer than the
// flat `PaperArtifact.game` (which only carries Record<string, number|string>):
// a tradeoff game needs knob ranges + a measured quality grid, which don't fit
// the flat shape. See CLAUDE.md (reconciled) for how the two relate.
// ----------------------------------------------------------------------------

export type KnobId = "precisionBits" | "sparsity" | "batchSize" | "kvCacheTokens";

export interface Knob {
  id: KnobId;
  label: string;
  unit?: string;
  kind: "discrete" | "continuous";
  options?: number[];                 // discrete knobs
  min?: number;                       // continuous knobs
  max?: number;
  step?: number;
  default: number;
  /**
   * Does moving this knob spend the quality budget?
   *  - precision & sparsity: TRUE  (they degrade the model, can hit collapse)
   *  - batch size & kv cache: FALSE (pure speed/memory levers — a memory wall,
   *    never a quality drop)
   */
  costsQuality: boolean;
}

export type Settings = Record<KnobId, number>;

export interface Hardware {
  name: string;
  tflops: number;        // peak dense fp16 TFLOP/s of the modeled accelerator
  bandwidthGBs: number;  // HBM bandwidth, GB/s
  memoryGB: number;      // HBM capacity — the memory wall
}

export interface ModelSpec {
  paramsB: number;          // parameter count, in billions
  kvBytesPerToken: number;  // KV-cache bytes per token (per sequence), in GB
  hardware: Hardware;
}

/**
 * Per-paper quality model — the AWQ insight made computable. Quality depends on
 * WHICH channels you keep at high precision relative to their importance, not
 * just the global precision dial.
 *
 *   quality = [ crush(precisionBits) + (1 - crush) * coverage ] * sparsityFactor
 *
 * where `coverage` is the share of total activation-importance carried by the
 * protected channels. "Naive" (uniform crush) is the coverage == 0 case.
 * Batch size and kv cache never appear here — they can't change quality.
 * Quality is NEVER produced by an LLM; this is all per-paper data + arithmetic.
 */
export interface ChannelProfile {
  /** Per-channel activation importance (raw magnitudes); a few dominate (the salient channels). */
  importances: number[];
  /** How many channels the paper's part can keep at high precision (the tiny protected set). */
  protectBudget: number;
}

/** A monotonic retention curve: retention[i] is the quality factor at x[i]. */
export interface RetentionCurve {
  x: number[];
  retention: number[];
}

export interface QualityModel {
  channels: ChannelProfile;
  /** Retention of an UNPROTECTED (crushed) channel vs. global precision (x = bits). */
  crush: RetentionCurve;
  /** Global quality multiplier vs. sparsity (x = sparsity fraction). */
  sparsity: RetentionCurve;
  note: string;
}

export interface PaperPoint {
  speedupReported: number;  // the figure the paper reports (for display)
  quality: number;          // the paper's quality at its operating point (0..1)
  settings: Settings;       // the knob settings the paper operates at
}

/**
 * Forza-style competing technologies for the ENGINE part (how weights are
 * quantized). Each tech maps to a coverage policy fed to the quality model:
 *   - "none"  : uniform crush, coverage 0 (RTN)
 *   - "fixed" : a recovery method with a set coverage it can reach (GPTQ)
 *   - "probe" : activation-aware — coverage is what the PLAYER protects (AWQ)
 * The `best` tech is the one the opponent (test car) runs.
 */
export interface EngineTech {
  id: string;
  name: string;
  blurb: string;
  coverage: { mode: "none" | "fixed" | "probe"; value?: number };
  best?: boolean;
}

/** Competing TIRE compounds = pruning/sparsity levels. `best` matches the paper. */
export interface TireCompound {
  id: string;
  name: string;
  blurb: string;
  sparsity: number;
  best?: boolean;
}

export interface TradeoffConfig {
  knobs: Knob[];
  model: ModelSpec;
  quality: QualityModel;
  engineTechs: EngineTech[];
  tireCompounds: TireCompound[];
  baseline: Settings;     // fp16 / dense reference (speedup == 1x here)
  collapseFloor: number;  // quality below this => model collapse (LOST)
  qualityFloor: number;   // min quality a run must hold to "count" for score
}

export interface TradeoffSpec {
  archetype: "tradeoff";
  category: "efficiency";
  title: string;
  summary: string;
  conceptMap: { nodes: ConceptNode[]; edges: ConceptEdge[] };
  charts: { type: "line" | "bar" | "scatter"; title: string; data: unknown }[];
  paperPoint: PaperPoint;
  config: TradeoffConfig;
  computeEndpoint: string;                            // placeholder; speed is computed client-side via cost.ts
  reveal: { method: string; plainEnglish: string };
}

/** Everything the reasoning AI must supply to instantiate THIS paper's game. */
export interface EfficiencyToolParams {
  title: string;
  summary: string;
  model: ModelSpec;
  knobs: Knob[];
  quality: QualityModel;
  engineTechs: EngineTech[];
  tireCompounds: TireCompound[];
  paperPoint: PaperPoint;
  collapseFloor: number;
  trick: { name: string; method: string; plainEnglish: string };
  conceptMap: { nodes: ConceptNode[]; edges: ConceptEdge[] };
}
