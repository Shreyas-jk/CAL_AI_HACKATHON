import { askJson, hasChatLLM } from "./claude";

const SYSTEM_PROMPT = `You generate a GameSpec JSON for a research paper game. The GameSpec describes a unique playable game whose mechanics teach the paper's core contribution. It is PURE DATA — a renderer interprets it. No functions, no executable strings.

AVAILABLE VIZ TYPES (pick the one that best teaches the paper's concept):

1. "curve-chart" — Line charts. Player adjusts a parameter via slider, watches curves diverge.
   Best for: training dynamics, optimization, scaling laws, tradeoff curves, fine-tuning.
   Required fields: title, xLabel, yLabel, series (array of {id, label, color, points: [{x,y}], dashed?}), thresholds? (array of {axis, value, label, color}), interactiveParam? (control id mapped to x-cursor), baselineSeries? (ids), powerupSeries? (ids).
   IMPORTANT: Provide at least 15 data points per series. Use actual numbers from the paper when possible. Points should span the full parameter range.

2. "pipeline" — Horizontal stages with toggle switches. Player enables/disables modules.
   Best for: RAG, agentic AI, safety defenses, multi-stage systems.
   Required fields: stages (array of {id, label, description, toggleable, default, effect: {accuracyDelta, latencyMs}}), inputItems (array of {id, label, correctOutput, difficulty}), baselineAccuracy (0-1).

3. "sampling" — Best-of-N samples with voting. Player sets sample count and voting method.
   Best for: reasoning, chain-of-thought, test-time compute, ensemble methods.
   Required fields: problemLabel, accuracyDistribution (array of 20+ numbers 0-1, representing accuracy of individual samples), votingMethods (["none","majority","weighted"]), verifierAccuracy (0-1), targetAccuracy (0-1).

4. "comparison-bars" — Side-by-side metric comparison bars.
   Best for: evaluation, benchmarks, ablation studies.
   Required fields: metrics (array of {id, label, baselineValue, powerupValue, max, unit, higherIsBetter}).

5. "token-sequence" — Clickable tokens with attention weight visualization.
   Best for: attention mechanisms, prompt engineering, NLP, multimodal grounding.
   Required fields: sequences (array of {tokens: string[], weights: number[], correctIndex, explanation}).

6. "interactive-grid" — NxN grid with cell states and search visualization.
   Best for: pathfinding, RL, grid-based planning.
   Required fields: rows, cols, cellStates (map of state name to hex color), initialGrid (2D array of state names), agentStart ([x,y]), goalCell ([x,y]), searchBudget.

GAMESPEC STRUCTURE:
{
  "version": 1,
  "insight": "One sentence: what the player learns by playing",
  "goal": "What the player must achieve",
  "baselineLabel": "Name of the naive/baseline approach",
  "powerupLabel": "Name of the paper's method",
  "claim": "The paper's key quantitative claim",
  "viz": { "vizType": "...", ...vizType-specific fields },
  "secondaryViz": optional second visualization,
  "controls": [
    { "type": "slider", "id": "...", "label": "...", "min": 0, "max": 1, "step": 0.1, "default": 0.5, "unit": "%" }
    OR { "type": "toggle", "id": "...", "label": "...", "default": false }
    OR { "type": "selector", "id": "...", "label": "...", "options": [{"value":"a","label":"A"}], "default": "a" }
  ],
  "scoring": {
    "metric": "Display name of the metric",
    "target": 0.8,
    "direction": "higher" or "lower",
    "winMessage": "Message when player wins",
    "loseMessage": "Message when player loses"
  }
}

RULES:
- Choose the vizType that BEST teaches this specific paper's contribution. Two papers in the same category should get different games if their contributions differ.
- For curve-chart: provide at LEAST 15 data points per series reflecting the paper's actual findings.
- For pipeline: provide 3-6 stages with realistic accuracy/latency deltas.
- For sampling: provide 20+ accuracy values in accuracyDistribution.
- Provide 1-3 player controls (sliders, toggles, or selectors).
- The scoring target should be achievable with the powerup but not the baseline.
- All values must be numbers, strings, booleans, or arrays. NO functions or code.
- Return ONLY valid JSON.

EXAMPLE 1 (Fine-tuning paper → curve-chart):
{
  "version": 1,
  "insight": "Too much policy drift reward-hacks; too little leaves the model unchanged. DPO's sweet spot is in between.",
  "goal": "Find the drift level that maximizes true quality without reward hacking",
  "baselineLabel": "Base model (frozen)",
  "powerupLabel": "DPO-tuned policy",
  "claim": "DPO achieves optimal alignment at ~40% drift, beyond which Goodhart's law kicks in",
  "viz": {
    "vizType": "curve-chart",
    "title": "True Quality vs Proxy Reward",
    "xLabel": "Policy Drift (%)",
    "yLabel": "Score",
    "series": [
      {"id": "proxy", "label": "Proxy Reward", "color": "#22d3ee", "dashed": true, "points": [{"x":0,"y":0},{"x":10,"y":18},{"x":20,"y":35},{"x":30,"y":50},{"x":40,"y":63},{"x":50,"y":74},{"x":60,"y":82},{"x":70,"y":88},{"x":80,"y":92},{"x":90,"y":95},{"x":100,"y":97}]},
      {"id": "true", "label": "True Quality", "color": "#d4af37", "points": [{"x":0,"y":0},{"x":10,"y":17},{"x":20,"y":33},{"x":30,"y":47},{"x":40,"y":55},{"x":50,"y":48},{"x":60,"y":35},{"x":70,"y":20},{"x":80,"y":10},{"x":90,"y":5},{"x":100,"y":2}]}
    ],
    "thresholds": [{"axis": "x", "value": 40, "label": "optimal", "color": "#34d399"}, {"axis": "x", "value": 70, "label": "collapse", "color": "#f87171"}],
    "interactiveParam": "drift"
  },
  "controls": [
    {"type": "slider", "id": "drift", "label": "Policy Drift", "min": 0, "max": 100, "step": 5, "default": 0, "unit": "%"}
  ],
  "scoring": {"metric": "True Quality", "target": 50, "direction": "higher", "winMessage": "You found the sweet spot!", "loseMessage": "Too much drift — reward hacking!"}
}

EXAMPLE 2 (RAG paper → pipeline):
{
  "version": 1,
  "insight": "Without corrective retrieval, bad context produces confident wrong answers. CRAG catches retrieval failures before generation.",
  "goal": "Achieve 85%+ accuracy by enabling the right pipeline modules",
  "baselineLabel": "Naive RAG (no correction)",
  "powerupLabel": "CRAG (Corrective RAG)",
  "claim": "CRAG improves retrieval-augmented accuracy from 52% to 89% by detecting and correcting bad retrievals",
  "viz": {
    "vizType": "pipeline",
    "stages": [
      {"id": "embed", "label": "Embed", "description": "Convert query to vector", "toggleable": false, "default": true, "effect": {"accuracyDelta": 0, "latencyMs": 10}},
      {"id": "retrieve", "label": "Retrieve", "description": "Find top-k documents", "toggleable": false, "default": true, "effect": {"accuracyDelta": 0, "latencyMs": 50}},
      {"id": "evaluator", "label": "Evaluator", "description": "Score retrieval quality", "toggleable": true, "default": true, "effect": {"accuracyDelta": 0.15, "latencyMs": 30}},
      {"id": "corrective", "label": "Corrective", "description": "Re-retrieve on low scores", "toggleable": true, "default": true, "effect": {"accuracyDelta": 0.22, "latencyMs": 80}},
      {"id": "generate", "label": "Generate", "description": "Produce final answer", "toggleable": false, "default": true, "effect": {"accuracyDelta": 0, "latencyMs": 40}}
    ],
    "inputItems": [
      {"id": "q1", "label": "Factoid question", "correctOutput": "Paris", "difficulty": 0.2},
      {"id": "q2", "label": "Multi-hop question", "correctOutput": "1969", "difficulty": 0.6},
      {"id": "q3", "label": "Ambiguous question", "correctOutput": "It depends", "difficulty": 0.8},
      {"id": "q4", "label": "Out-of-scope query", "correctOutput": "I don't know", "difficulty": 0.9}
    ],
    "baselineAccuracy": 0.52
  },
  "controls": [],
  "scoring": {"metric": "Accuracy", "target": 0.85, "direction": "higher", "winMessage": "CRAG caught the bad retrievals!", "loseMessage": "Enable the corrective modules."}
}

EXAMPLE 3 (CoT paper → sampling):
{
  "version": 1,
  "insight": "A single reasoning attempt often fails multi-step problems. Sampling many chains and voting selects the correct one.",
  "goal": "Reach 74% accuracy by scaling test-time compute",
  "baselineLabel": "Single-shot (1 sample)",
  "powerupLabel": "Self-consistency (N samples + vote)",
  "claim": "Self-consistency with 40 samples raises GSM8K accuracy from 18% to 74%",
  "viz": {
    "vizType": "sampling",
    "problemLabel": "GSM8K Math Word Problems",
    "accuracyDistribution": [0.12,0.15,0.08,0.22,0.45,0.18,0.55,0.72,0.33,0.67,0.41,0.28,0.59,0.74,0.19,0.63,0.37,0.81,0.49,0.26,0.71,0.38,0.56,0.14,0.68],
    "votingMethods": ["none", "majority", "weighted"],
    "verifierAccuracy": 0.8,
    "targetAccuracy": 0.74
  },
  "controls": [
    {"type": "slider", "id": "sampleCount", "label": "Number of samples", "min": 1, "max": 25, "step": 1, "default": 1},
    {"type": "selector", "id": "voting", "label": "Voting method", "options": [{"value":"none","label":"None"},{"value":"majority","label":"Majority"},{"value":"weighted","label":"Weighted"}], "default": "none"}
  ],
  "scoring": {"metric": "Accuracy", "target": 0.74, "direction": "higher", "winMessage": "Self-consistency works!", "loseMessage": "Try more samples + weighted voting."}
}`;

export async function generateGameSpec(
  summary: string,
  category: string,
  methodSection: string,
): Promise<Record<string, unknown>> {
  if (!hasChatLLM()) return {};

  const user = [
    `PAPER CATEGORY: ${category}`,
    `PAPER SUMMARY: ${summary}`,
    methodSection ? `PAPER METHOD: ${methodSection.slice(0, 2500)}` : "",
    "",
    "Generate the GameSpec JSON now. Choose the vizType that BEST teaches this paper's specific contribution.",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    return await askJson<Record<string, unknown>>(SYSTEM_PROMPT, user, 4000);
  } catch {
    return {};
  }
}
