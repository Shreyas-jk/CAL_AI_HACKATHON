import type { PaperArtifact } from "./types";

// Offline demo artifact — used when ANTHROPIC_API_KEY is absent so the app
// is always live for a hackathon demo. Themed around a pathfinding paper.
export function mockArtifact(id: string, title?: string): PaperArtifact {
  return {
    id,
    title: title || "Learning Heuristics for A* Search (demo paper)",
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
