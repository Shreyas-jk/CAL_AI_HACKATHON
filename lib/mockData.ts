import type { PaperArtifact, GameTemplateId } from "./types";

const PATHFINDING: PaperArtifact = {
  id: "demo-pathfinding",
  title: "Learning Heuristics for A* Search (demo paper)",
  category: "pathfinding / planning",
  oneLiner: "A learned heuristic guides A* to the goal under a tight expansion budget.",
  summary:
    "The paper replaces hand-tuned search heuristics with a learned estimate of cost-to-go, " +
    "letting A* expand far fewer nodes while still finding near-optimal paths. Naive uninformed " +
    "search (BFS) exhausts its budget on large maps; the learned heuristic focuses expansion " +
    "toward the goal.",
  plainEnglish: [
    "Searching a maze blindly wastes moves exploring dead ends.",
    "A heuristic is a smart guess of how far the goal still is.",
    "The paper learns that guess from data instead of hand-coding it.",
    "Result: the same A* algorithm reaches the goal with a fraction of the steps.",
  ],
  concept: {
    nodes: [
      { id: "search", label: "Graph Search", group: "core" },
      { id: "bfs", label: "Naive BFS", group: "baseline" },
      { id: "astar", label: "A*", group: "core" },
      { id: "heur", label: "Learned Heuristic", group: "contribution" },
      { id: "budget", label: "Expansion Budget", group: "constraint" },
      { id: "goal", label: "Optimal Path", group: "outcome" },
    ],
    edges: [
      { source: "search", target: "bfs", label: "naive" },
      { source: "search", target: "astar", label: "informed" },
      { source: "heur", target: "astar", label: "guides" },
      { source: "budget", target: "bfs", label: "exhausts" },
      { source: "astar", target: "goal", label: "reaches" },
      { source: "heur", target: "goal", label: "enables" },
    ],
  },
  game: {
    template: "pathfinding",
    confidence: 0.92,
    goal: "Reach the goal tile before the step budget runs out.",
    baselineLabel: "Naive BFS (no heuristic)",
    powerupLabel: "Learned A* Heuristic",
    claim: "Paper claim: learned heuristic reaches the goal using ~5x fewer expansions than BFS.",
    params: { gridSize: 15, budget: 60, walls: 0.28 },
  },
  eval: { faithfulness: 0.83, hallucinationRisk: 0.17, note: "grounded (demo)" },
  source: "mock",
};

const ATTENTION: PaperArtifact = {
  id: "demo-attention",
  title: "Attention Is All You Need (demo paper)",
  category: "attention / transformer",
  oneLiner: "Self-attention lets every token look directly at the one it actually depends on.",
  summary:
    "Uniform attention smears focus equally across every token, making coreference resolution a " +
    "guess. Learned attention spotlights the referent token directly, regardless of distance.",
  plainEnglish: [
    "A pronoun like 'it' needs to point back to the right noun.",
    "Without learned attention, the model has no way to know which one.",
    "Self-attention lets it weigh every token's relevance directly.",
    "Result: the model spotlights the correct referent instead of guessing.",
  ],
  concept: {
    nodes: [
      { id: "attn", label: "Self-attention", group: "core" },
      { id: "uniform", label: "Uniform weights", group: "baseline" },
      { id: "learned", label: "Learned weights", group: "contribution" },
      { id: "coref", label: "Coreference", group: "outcome" },
    ],
    edges: [
      { source: "attn", target: "learned", label: "produces" },
      { source: "uniform", target: "coref", label: "fails at" },
      { source: "learned", target: "coref", label: "resolves" },
    ],
  },
  game: {
    template: "attention",
    confidence: 0.95,
    goal: "Click the token the model should attend to.",
    baselineLabel: "Uniform attention",
    powerupLabel: "Learned attention",
    claim: "Paper claim: learned attention concentrates weight on the correct referent token.",
    params: {},
  },
  eval: { faithfulness: 0.88, hallucinationRisk: 0.1, note: "grounded (demo)" },
  source: "mock",
};

const GRIDWORLD_RL: PaperArtifact = {
  id: "demo-gridworld-rl",
  title: "Reward Shaping for Sparse-Reward Gridworlds (demo paper)",
  category: "reinforcement learning",
  oneLiner: "Shaped rewards let an agent learn to survive where sparse rewards leave it directionless.",
  summary:
    "A naive policy under sparse reward wanders randomly until it stumbles onto the goal, often " +
    "dying first. Reward shaping adds intermediate signal that guides the agent toward survival " +
    "and the goal far more reliably.",
  plainEnglish: [
    "Sparse reward means the agent only learns something at the very end.",
    "Until then, it's wandering blind.",
    "Reward shaping gives small hints along the way.",
    "Result: the agent survives and reaches the goal far more often.",
  ],
  concept: {
    nodes: [
      { id: "policy", label: "Policy", group: "core" },
      { id: "sparse", label: "Sparse reward", group: "baseline" },
      { id: "shaped", label: "Shaped reward", group: "contribution" },
      { id: "survive", label: "Survival", group: "outcome" },
    ],
    edges: [
      { source: "sparse", target: "policy", label: "limits" },
      { source: "shaped", target: "policy", label: "guides" },
      { source: "policy", target: "survive", label: "achieves" },
    ],
  },
  game: {
    template: "gridworld-rl",
    confidence: 0.7,
    goal: "Survive and reach the goal cell.",
    baselineLabel: "Naive policy (sparse reward)",
    powerupLabel: "Shaped-reward policy",
    claim: "Paper claim: reward shaping substantially raises the agent's survival rate.",
    params: { gridSize: 8, hazards: 0.15, maxSteps: 40 },
  },
  eval: { faithfulness: 0.6, hallucinationRisk: 0.3, note: "unverified params (demo)" },
  source: "mock",
};

const EPIDEMIC: PaperArtifact = {
  id: "demo-epidemic",
  title: "Intervention Timing in SIR Models (demo paper)",
  category: "epidemic modeling",
  oneLiner: "Early, modest interventions outperform late, aggressive ones at flattening the curve.",
  summary:
    "Without intervention, infections spread exponentially until herd immunity. The paper shows " +
    "that earlier, smaller interventions keep peak infection well below capacity, while delayed " +
    "interventions need to be far more severe to achieve the same effect.",
  plainEnglish: [
    "Left alone, infections grow exponentially.",
    "Waiting to intervene means the peak is already locked in.",
    "Acting early needs a much smaller nudge.",
    "Result: earlier + smaller beats later + larger.",
  ],
  concept: {
    nodes: [
      { id: "sir", label: "SIR model", group: "core" },
      { id: "none", label: "No intervention", group: "baseline" },
      { id: "early", label: "Early intervention", group: "contribution" },
      { id: "peak", label: "Peak infections", group: "outcome" },
    ],
    edges: [
      { source: "none", target: "peak", label: "maximizes" },
      { source: "early", target: "peak", label: "flattens" },
      { source: "sir", target: "peak", label: "predicts" },
    ],
  },
  game: {
    template: "epidemic",
    confidence: 0.65,
    goal: "Keep peak infections under the threshold.",
    baselineLabel: "No intervention",
    powerupLabel: "Early intervention strategy",
    claim: "Paper claim: early intervention keeps the peak well under capacity vs. no action.",
    params: { threshold: 40, r0: 2.5, population: 1000 },
  },
  eval: { faithfulness: 0.6, hallucinationRisk: 0.3, note: "unverified params (demo)" },
  source: "mock",
};

const FINE_TUNING_ALIGNMENT: PaperArtifact = {
  id: "demo-fine-tuning-alignment",
  title: "Direct Preference Optimization (demo paper)",
  category: "fine-tuning / alignment",
  oneLiner: "Too little policy drift leaves the model unchanged; too much and it reward-hacks into gibberish.",
  summary:
    "Alignment methods like RLHF/DPO let a policy drift from its base behavior to chase a reward " +
    "signal. Too little drift and the model barely changes. Too much and it overfits the reward " +
    "signal, producing fluent but degenerate outputs optimized purely for the metric.",
  plainEnglish: [
    "Alignment lets the model move away from its base behavior to chase reward.",
    "Move too little and nothing improves.",
    "Move too much and it games the reward instead of being useful.",
    "There's a narrow band in between that's actually good.",
  ],
  concept: {
    nodes: [
      { id: "policy", label: "Policy", group: "baseline" },
      { id: "drift", label: "Policy drift", group: "contribution" },
      { id: "reward", label: "Reward signal", group: "core" },
      { id: "hack", label: "Reward hacking", group: "outcome" },
    ],
    edges: [
      { source: "drift", target: "reward", label: "increases" },
      { source: "drift", target: "hack", label: "risks past threshold" },
      { source: "policy", target: "drift", label: "controlled by" },
    ],
  },
  game: {
    template: "fine-tuning-alignment",
    confidence: 0.9,
    goal: "Find the drift level that maximizes reward without breaking coherence.",
    baselineLabel: "Base model (frozen)",
    powerupLabel: "Your tuned policy",
    claim: "Paper claim: the optimal drift sits well below the point where reward-hacking begins.",
    params: { paramLabel: "Policy drift allowed", unit: "%", breakHigh: 70, minMeaningful: 15, optimalDrift: 40 },
  },
  eval: { faithfulness: 0.85, hallucinationRisk: 0.12, note: "grounded (demo)" },
  source: "mock",
};

// Partial: not every template id has a baked demo artifact (efficiency uses its own
// TradeoffSpec; reasoning/vision-detective have dedicated mock* factories below).
export const MOCK_ARTIFACTS: Partial<Record<Exclude<GameTemplateId, "none">, PaperArtifact>> = {
  pathfinding: PATHFINDING,
  attention: ATTENTION,
  "gridworld-rl": GRIDWORLD_RL,
  epidemic: EPIDEMIC,
  "fine-tuning-alignment": FINE_TUNING_ALIGNMENT,
};

// Kept for backward compatibility with existing call sites (e.g. the
// no-API-key fallback path) - still returns the pathfinding demo.
export function mockArtifact(id: string, title?: string): PaperArtifact {
  return { ...PATHFINDING, id, title: title || PATHFINDING.title };
}

export function mockReasoning(id: string, title?: string): PaperArtifact {
  return {
    id,
    title: title || "Scaling Test-Time Compute for Reasoning (demo paper)",
    category: "reasoning / chain-of-thought",
    oneLiner: "Spend more compute at inference — sample many chains, verify, and vote — to solve multi-step puzzles.",
    summary:
      "Instead of training a bigger model, the paper scales compute at inference time: generate many " +
      "candidate reasoning chains (best-of-N), score them with a verifier, and aggregate via voting. " +
      "A single greedy chain often fails multi-step constraint problems; sampling + verification + " +
      "voting reliably recovers the correct solution under a fixed compute budget.",
    plainEnglish: [
      "Hard puzzles need several reasoning steps that all must line up.",
      "One quick attempt usually breaks at least one constraint.",
      "So the model makes many attempts (best-of-N) instead of one.",
      "A verifier scores each attempt; voting picks the best-supported answer.",
      "More attempts cost more compute — so there's a budget trade-off.",
    ],
    concept: {
      nodes: [
        { id: "prob", label: "Multi-step Puzzle", group: "core" },
        { id: "single", label: "Single Sample", group: "baseline" },
        { id: "bon", label: "Best-of-N Sampling", group: "contribution" },
        { id: "verify", label: "Verifier", group: "contribution" },
        { id: "vote", label: "Voting", group: "contribution" },
        { id: "budget", label: "Compute Budget", group: "constraint" },
        { id: "sol", label: "Correct Solution", group: "outcome" },
      ],
      edges: [
        { source: "prob", target: "single", label: "naive" },
        { source: "single", target: "sol", label: "often fails" },
        { source: "prob", target: "bon", label: "scale compute" },
        { source: "bon", target: "verify", label: "score" },
        { source: "verify", target: "vote", label: "weight" },
        { source: "vote", target: "sol", label: "selects" },
        { source: "budget", target: "bon", label: "limits" },
      ],
    },
    game: {
      template: "reasoning",
      confidence: 0.9,
      goal: "Schedule all 6 sessions so all 8 constraints pass — under the compute budget.",
      baselineLabel: "Single-shot (1 attempt)",
      powerupLabel: "Best-of-N + Verifier + Voting",
      claim: "Paper claim: scaling test-time compute (samples + verifier + voting) finds correct multi-step solutions a single sample misses.",
      params: { sessions: 6, rooms: 3, slots: 4, constraints: 8 },
    },
    eval: { faithfulness: 0.8, hallucinationRisk: 0.2, note: "grounded (demo)" },
    source: "mock",
  };
}
