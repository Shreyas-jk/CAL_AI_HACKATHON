import type { PaperArtifact } from "./types";

// Offline demo artifact — used when ANTHROPIC_API_KEY is absent so the app
// is always live for a hackathon demo. Themed around a pathfinding paper.
export function mockArtifact(id: string, title?: string): PaperArtifact {
  if (id.toLowerCase().includes("vision") || id.toLowerCase().includes("multimodal")) {
    return mockVisionArtifact(id, title);
  }

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

export function mockVisionArtifact(id: string, title?: string): PaperArtifact {
  return {
    id,
    title: title || "Grounded Vision-Language Models Reduce Visual Hallucination (demo paper)",
    category: "multimodal vision-language / grounding",
    oneLiner: "Vision-language models answer more reliably when they ground text in image regions, OCR evidence, and uncertainty.",
    summary:
      "The paper studies how multimodal models can avoid plausible but unsupported answers by tying language outputs to visual regions, " +
      "explicit OCR evidence, and calibrated refusal thresholds. A weak VLM guesses from scene priors; the grounded model cites evidence " +
      "or refuses when no visual support exists.",
    plainEnglish: [
      "A VLM should not just say a likely answer; it should point to the pixels or text that support it.",
      "Object questions need region grounding so the model does not follow a nearby false lead.",
      "Receipt and document questions need OCR because the important evidence is written text.",
      "If the image does not contain the requested object, a grounded model should refuse instead of hallucinating.",
    ],
    concept: {
      nodes: [
        { id: "vlm", label: "Vision-Language Model", group: "core" },
        { id: "regions", label: "Visual Regions", group: "evidence" },
        { id: "ocr", label: "OCR Text", group: "evidence" },
        { id: "threshold", label: "Uncertainty Threshold", group: "control" },
        { id: "refusal", label: "Grounded Refusal", group: "outcome" },
        { id: "hallucination", label: "Visual Hallucination", group: "risk" },
      ],
      edges: [
        { source: "regions", target: "vlm", label: "grounds" },
        { source: "ocr", target: "vlm", label: "adds text evidence" },
        { source: "threshold", target: "refusal", label: "triggers" },
        { source: "refusal", target: "hallucination", label: "reduces" },
        { source: "vlm", target: "refusal", label: "when unsupported" },
      ],
    },
    game: {
      template: "vision-detective",
      confidence: 0.96,
      goal: "Solve three visual cases by grounding VLM answers in evidence.",
      baselineLabel: "Ungrounded VLM",
      powerupLabel: "Grounded VLM",
      claim: "Paper claim: visual grounding, OCR, and refusal thresholds reduce unsupported multimodal answers.",
      params: {
        lesson: "Ground language answers in regions, OCR text, and uncertainty instead of scene priors.",
        methodName: "Grounded VLM",
        paperClaim: "Grounded evidence reduces visual hallucination.",
      },
    },
    eval: { faithfulness: 0.88, hallucinationRisk: 0.12, note: "grounded multimodal demo" },
    source: "mock",
  };
}
