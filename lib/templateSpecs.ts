import type { GameTemplateId } from "./types";

export interface TemplateSpec {
  id: GameTemplateId;
  name: string;
  forCategories: string[];
  mechanics: string;
  contentSchema: Record<string, string>;
  example: {
    paperTitle: string;
    category: string;
    content: Record<string, unknown>;
  };
}

export const TEMPLATE_SPECS: Partial<Record<GameTemplateId, TemplateSpec>> = {
  pathfinding: {
    id: "pathfinding",
    name: "Maze Runner",
    forCategories: [
      "pathfinding", "search", "planning", "graph traversal",
      "evaluation", "benchmarks", "embedding similarity",
    ],
    mechanics:
      "A 15x15 maze with a step budget. The player toggles between a naive baseline (BFS, expands equally in all directions) " +
      "and the paper's heuristic (A*, focuses toward the goal). The heuristic reaches the goal using fewer expansions. " +
      "Game renders as an SVG grid with colored cells. params: {gridSize, walls, budget}.",
    contentSchema: {
      scenarioContext: "string — 1-2 sentences explaining what the maze represents in this paper's domain",
      heuristicDescription: "string — what the paper's heuristic/method does, shown below the grid",
    },
    example: {
      paperTitle: "Learning Heuristics for A* Search",
      category: "pathfinding / planning",
      content: {
        scenarioContext: "The maze represents a planning graph where each cell is a state in the search space. Blind BFS wastes its budget exploring dead-end states.",
        heuristicDescription: "The paper's neural heuristic estimates cost-to-go from training data, letting A* skip unpromising branches entirely.",
      },
    },
  },

  attention: {
    id: "attention",
    name: "Spotlight",
    forCategories: [
      "attention", "transformer", "NLP", "coreference",
      "prompt engineering", "in-context learning", "few-shot",
    ],
    mechanics:
      "The player sees sentences with tokens highlighted by attention weights. They must click the token the model should attend to " +
      "(e.g., the referent of a pronoun). Uniform attention (baseline) smears weight equally — hard to guess. Learned attention (powerup) " +
      "peaks on the correct token. Game renders token buttons with opacity shading. The sentences array is the primary content to customize.",
    contentSchema: {
      sentences: "Array of {tokens: string[], answer: number, explanation: string}. Each sentence should have a pronoun or reference " +
        "that resolves to a specific token (the answer index). Use vocabulary and scenarios from the paper's domain. 3-5 sentences.",
    },
    example: {
      paperTitle: "Attention Is All You Need",
      category: "attention / transformer",
      content: {
        sentences: [
          {
            tokens: ["The", "model", "computed", "attention", "over", "all", "positions", "and", "it", "converged", "faster"],
            answer: 1,
            explanation: "'it' refers to 'the model' which computed the attention.",
          },
          {
            tokens: ["Self-attention", "lets", "each", "token", "see", "every", "other", "token", "so", "it", "captures", "long-range", "dependencies"],
            answer: 0,
            explanation: "'it' refers to 'Self-attention', the mechanism that enables long-range connections.",
          },
          {
            tokens: ["The", "encoder", "processes", "input", "while", "the", "decoder", "generates", "output", "because", "it", "is", "autoregressive"],
            answer: 6,
            explanation: "'it' refers to 'the decoder' which generates output autoregressively.",
          },
        ],
      },
    },
  },

  "fine-tuning-alignment": {
    id: "fine-tuning-alignment",
    name: "The Leash",
    forCategories: [
      "fine-tuning", "alignment", "RLHF", "DPO", "reward modeling",
      "LLM pretraining", "learning rate", "loss landscape", "training stability",
    ],
    mechanics:
      "A vertical slider controlling 'policy drift' (0-100%). Too little drift = model unchanged. Too much = reward-hacking gibberish. " +
      "A sweet spot balances reward with coherence. The Goodhart's-law chart shows true value vs proxy reward diverging past the optimum. " +
      "params already accepted: {paramLabel, unit, breakHigh, minMeaningful, optimalDrift}. content adds display framing.",
    contentSchema: {
      contextDescription: "string — 1-2 sentences explaining what the slider represents in this paper's context (e.g., learning rate, drift amount, regularization strength)",
      outputExamples: "object {low: string, sweet: string, high: string} — example model outputs at low drift, the sweet spot, and over-optimized drift. Each ~1 sentence.",
      curveLabel: "string — what the Goodhart's law curve represents (e.g., 'True quality vs proxy reward' or 'Loss vs learning rate')",
    },
    example: {
      paperTitle: "Direct Preference Optimization",
      category: "fine-tuning / alignment",
      content: {
        contextDescription: "The slider controls how far the fine-tuned policy is allowed to drift from the base model's distribution. DPO optimizes preferences directly without a separate reward model.",
        outputExamples: {
          low: "The assistant gives a clear, accurate, and honest answer.",
          sweet: "The assistant gives a clear, accurate answer. Definitely.",
          high: "AMAZING ANSWER!!! RATE ME FIVE STARS!!! BEST RESPONSE EVER!!!",
        },
        curveLabel: "True helpfulness vs proxy preference score",
      },
    },
  },

  reasoning: {
    id: "reasoning",
    name: "AI Conference Scheduler",
    forCategories: [
      "reasoning", "chain-of-thought", "test-time compute",
      "agentic AI", "tool-use", "task decomposition", "agent planning",
    ],
    mechanics:
      "A constraint-satisfaction puzzle: 6 items must be placed in a 3x4 grid (3 groups x 4 slots) satisfying 8 constraints. " +
      "Baseline: single attempt (often fails). Powerup: best-of-N + verifier + voting under compute budget. " +
      "The puzzle STRUCTURE stays fixed (6 items, 3 groups, 4 slots, 8 constraints). Only the DISPLAY LABELS change. " +
      "params: {sessions, rooms, slots, constraints}. content provides themed labels.",
    contentSchema: {
      theme: "string — name of the scheduling scenario (e.g., 'Agent Tool Chain', 'Workshop Schedule')",
      sessionNames: "string[6] — the 6 items being scheduled, themed to the paper. Each should be short (1-3 words).",
      roomNames: "string[3] — the 3 grouping categories, themed to the paper. Each should be short (1-3 words).",
      slotLabels: "string[4] — the 4 ordering slots (e.g., time slots, steps, phases).",
    },
    example: {
      paperTitle: "ReAct: Synergizing Reasoning and Acting",
      category: "agentic AI",
      content: {
        theme: "Agent Tool Chain",
        sessionNames: ["Search", "Parse", "Reason", "Act", "Verify", "Report"],
        roomNames: ["Planning", "Execution", "Validation"],
        slotLabels: ["Step 1", "Step 2", "Step 3", "Step 4"],
      },
    },
  },

  "vision-detective": {
    id: "vision-detective",
    name: "Vision Detective",
    forCategories: [
      "multimodal", "vision-language", "VQA", "grounding",
      "safety", "interpretability", "red-teaming", "adversarial",
    ],
    mechanics:
      "The player interrogates a VLM across 3 visual cases. They ask yes/no questions, enable tools (region grounding, OCR, " +
      "object detector, confidence threshold), and ground answers in evidence. The 3 cases are fixed (hardcoded 3D scenes). " +
      "params: {lesson, methodName, paperClaim}. content customizes the narrative framing around the fixed cases.",
    contentSchema: {
      investigationContext: "string — 1-2 sentences framing what the player is investigating in this paper's terms",
      caseLessons: "string[3] — one lesson string per case, explaining how that case relates to the paper's contribution",
    },
    example: {
      paperTitle: "Grounded VLMs Reduce Visual Hallucination",
      category: "multimodal vision-language",
      content: {
        investigationContext: "You're testing whether the VLM can ground its language answers in actual visual evidence, or if it hallucinates from scene priors.",
        caseLessons: [
          "Object questions need region grounding — without it, the model follows nearby false leads instead of the actual object.",
          "Receipt and document questions need OCR — the important evidence is written text that the model must read, not guess.",
          "When no visual support exists, a grounded model should refuse instead of hallucinating a plausible answer.",
        ],
      },
    },
  },

  "gridworld-rl": {
    id: "gridworld-rl",
    name: "Survivor",
    forCategories: ["reinforcement learning", "rl", "policy", "control"],
    mechanics:
      "An 8x8 SVG grid with an agent, hazard cells (lava), and a goal. " +
      "Baseline: naive policy under sparse reward wanders randomly into hazards. " +
      "Powerup: shaped-reward policy avoids hazards and reaches the goal. " +
      "params: {gridSize, hazards, maxSteps}. content provides display context.",
    contentSchema: {
      hazardType: "string — what the hazard cells represent in the paper's domain (e.g., 'unsafe states', 'high-loss regions')",
      rewardDescription: "string — 1 sentence explaining the reward shaping from the paper",
    },
    example: {
      paperTitle: "Reward Shaping for Sparse-Reward Gridworlds",
      category: "reinforcement learning",
      content: {
        hazardType: "Lava pits (instant death)",
        rewardDescription: "Shaped rewards give small positive signals for moving closer to the goal, preventing aimless wandering.",
      },
    },
  },

  epidemic: {
    id: "epidemic",
    name: "Flatten It",
    forCategories: ["epidemic", "sir", "diffusion", "spread", "graph", "contagion"],
    mechanics:
      "An SIR simulation with an intervention slider (0-100%). The player adjusts intervention strength to keep peak infections " +
      "below a threshold. An SVG line chart shows S/I/R curves in real time. " +
      "Baseline: no intervention (high peak). Powerup: early intervention strategy (flattened curve). " +
      "params: {threshold, r0, population}. content provides domain framing.",
    contentSchema: {
      spreadContext: "string — what is 'spreading' in the paper's domain (e.g., 'misinformation', 'gradient signal', 'infections')",
    },
    example: {
      paperTitle: "Intervention Timing in SIR Models",
      category: "epidemic modeling",
      content: {
        spreadContext: "Infections spread through a population network. Without intervention, exponential growth overwhelms capacity.",
      },
    },
  },
};

export function getTemplateSpec(id: GameTemplateId): TemplateSpec | undefined {
  return TEMPLATE_SPECS[id as keyof typeof TEMPLATE_SPECS];
}
