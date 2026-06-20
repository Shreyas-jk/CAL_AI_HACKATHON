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
