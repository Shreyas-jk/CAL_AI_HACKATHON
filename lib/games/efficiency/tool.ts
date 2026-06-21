import type { EfficiencyToolParams, TradeoffSpec } from "./types";
import { BASELINE_SETTINGS } from "./cost";

// ----------------------------------------------------------------------------
// The tool the reasoning AI calls to instantiate THIS paper's efficiency game.
// The mechanic (Race the Paper) is fixed in code; only these params change per
// paper. The handler turns the params into a `tradeoff` GameSpec; the frontend
// renders it. Decoupled from the (not-yet-built) classifier — see app/dev.
// ----------------------------------------------------------------------------

export const buildEfficiencyGameTool = {
  name: "build_efficiency_game",
  description:
    "Instantiate the 'Race the Paper' efficiency game for an ML efficiency / " +
    "quantization / compression paper. Provide the paper's operating point, the " +
    "tunable knobs (precision, sparsity, batch size, kv cache) and their ranges, " +
    "the method ('trick') with a plain-English reveal, and a MEASURED quality grid " +
    "over precision x sparsity. Speed is computed from settings on the client; " +
    "quality comes from the grid. Never invent quality numbers.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Paper title." },
      summary: { type: "string", description: "1-2 sentence plain-language summary." },
      model: {
        type: "object",
        description: "The modeled system the cost roofline runs on.",
        properties: {
          paramsB: { type: "number", description: "Parameter count in billions." },
          kvBytesPerToken: { type: "number", description: "KV-cache bytes per token per sequence, in GB." },
          hardware: {
            type: "object",
            properties: {
              name: { type: "string" },
              tflops: { type: "number", description: "Peak dense fp16 TFLOP/s." },
              bandwidthGBs: { type: "number", description: "HBM bandwidth, GB/s." },
              memoryGB: { type: "number", description: "HBM capacity (the memory wall)." },
            },
            required: ["name", "tflops", "bandwidthGBs", "memoryGB"],
          },
        },
        required: ["paramsB", "kvBytesPerToken", "hardware"],
      },
      knobs: {
        type: "array",
        description:
          "The four tunable knobs. precision & sparsity MUST have costsQuality=true; " +
          "batchSize & kvCacheTokens MUST have costsQuality=false (speed/memory only).",
        items: {
          type: "object",
          properties: {
            id: { type: "string", enum: ["precisionBits", "sparsity", "batchSize", "kvCacheTokens"] },
            label: { type: "string" },
            unit: { type: "string" },
            kind: { type: "string", enum: ["discrete", "continuous"] },
            options: { type: "array", items: { type: "number" } },
            min: { type: "number" },
            max: { type: "number" },
            step: { type: "number" },
            default: { type: "number" },
            costsQuality: { type: "boolean" },
          },
          required: ["id", "label", "kind", "default", "costsQuality"],
        },
      },
      engineTechs: {
        type: "array",
        description: "Competing quantization technologies for the engine part. Exactly one should be best:true (the opponent's). coverage.mode: none=uniform crush (RTN), fixed=set recovery (GPTQ, give value 0..1), probe=activation-aware/player-driven (AWQ).",
        items: {
          type: "object",
          properties: {
            id: { type: "string" }, name: { type: "string" }, blurb: { type: "string" },
            coverage: { type: "object", properties: { mode: { type: "string", enum: ["none", "fixed", "probe"] }, value: { type: "number" } }, required: ["mode"] },
            best: { type: "boolean" },
          },
          required: ["id", "name", "blurb", "coverage"],
        },
      },
      tireCompounds: {
        type: "array",
        description: "Competing pruning/sparsity compounds for the tires part. best:true matches the paper's operating point.",
        items: {
          type: "object",
          properties: { id: { type: "string" }, name: { type: "string" }, blurb: { type: "string" }, sparsity: { type: "number" }, best: { type: "boolean" } },
          required: ["id", "name", "blurb", "sparsity"],
        },
      },
      quality: {
        type: "object",
        description:
          "The channel-coverage quality model. Quality = crush(precision) + (1-crush)*coverage, " +
          "scaled by a sparsity factor, where coverage is the importance-share of the protected " +
          "channels. Provide a realistic salient-channel profile (a few high-importance channels, " +
          "the rest low). Never invent these at runtime.",
        properties: {
          channels: {
            type: "object",
            properties: {
              importances: { type: "array", items: { type: "number" }, description: "Per-channel activation importance; a few dominate." },
              protectBudget: { type: "number", description: "How many channels the paper's part keeps at high precision." },
            },
            required: ["importances", "protectBudget"],
          },
          crush: {
            type: "object",
            description: "Retention of an UNPROTECTED channel vs global precision (x = bits).",
            properties: { x: { type: "array", items: { type: "number" } }, retention: { type: "array", items: { type: "number" } } },
            required: ["x", "retention"],
          },
          sparsity: {
            type: "object",
            description: "Global quality multiplier vs sparsity (x = sparsity fraction).",
            properties: { x: { type: "array", items: { type: "number" } }, retention: { type: "array", items: { type: "number" } } },
            required: ["x", "retention"],
          },
          note: { type: "string" },
        },
        required: ["channels", "crush", "sparsity", "note"],
      },
      paperPoint: {
        type: "object",
        description: "The paper's reported operating point — the target the player chases.",
        properties: {
          speedupReported: { type: "number" },
          quality: { type: "number" },
          settings: {
            type: "object",
            properties: {
              precisionBits: { type: "number" },
              sparsity: { type: "number" },
              batchSize: { type: "number" },
              kvCacheTokens: { type: "number" },
            },
            required: ["precisionBits", "sparsity", "batchSize", "kvCacheTokens"],
          },
        },
        required: ["speedupReported", "quality", "settings"],
      },
      collapseFloor: { type: "number", description: "Quality below this => model collapse (player loses)." },
      trick: {
        type: "object",
        properties: {
          name: { type: "string", description: "Short name, e.g. 'AWQ scaling'." },
          method: { type: "string", description: "The method as a power-up label." },
          plainEnglish: { type: "string", description: "Why it reaches the frontier — the reveal." },
        },
        required: ["name", "method", "plainEnglish"],
      },
      conceptMap: {
        type: "object",
        properties: {
          nodes: { type: "array", items: { type: "object" } },
          edges: { type: "array", items: { type: "object" } },
        },
        required: ["nodes", "edges"],
      },
    },
    required: ["title", "summary", "model", "knobs", "engineTechs", "tireCompounds", "quality", "paperPoint", "collapseFloor", "trick", "conceptMap"],
  },
} as const;

/** Build the tradeoff GameSpec from the tool params. Pure, no I/O. */
export function buildEfficiencyGame(p: EfficiencyToolParams): TradeoffSpec {
  return {
    archetype: "tradeoff",
    category: "efficiency",
    title: p.title,
    summary: p.summary,
    conceptMap: p.conceptMap,
    charts: [
      {
        type: "scatter",
        title: "Speed vs Quality (Pareto frontier)",
        // The plot is rendered live from cost.ts + grid.ts; the paper's point is
        // the target. We surface its coordinates here for any non-interactive view.
        data: { paperPoint: p.paperPoint, qualityFloor: p.paperPoint.quality },
      },
    ],
    paperPoint: p.paperPoint,
    config: {
      knobs: p.knobs,
      model: p.model,
      quality: p.quality,
      engineTechs: p.engineTechs,
      tireCompounds: p.tireCompounds,
      baseline: BASELINE_SETTINGS,
      collapseFloor: p.collapseFloor,
      qualityFloor: p.paperPoint.quality, // you must hold the paper's quality to "count"
    },
    // Speed is computed client-side from cost.ts (deterministic, no network in the
    // demo path). This documents the route a future server-side engine would expose.
    computeEndpoint: "/api/engine/efficiency",
    reveal: { method: p.trick.method, plainEnglish: p.trick.plainEnglish },
  };
}
