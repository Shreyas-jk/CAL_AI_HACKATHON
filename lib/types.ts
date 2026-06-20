export type GameTemplateId =
  | "pathfinding" | "attention" | "gridworld-rl" | "epidemic" | "efficiency" | "none";

export interface ConceptNode { id: string; label: string; group?: string; }
export interface ConceptEdge { source: string; target: string; label?: string; }

export interface PaperArtifact {
  id: string;
  title: string;
  category: string;
  oneLiner: string;
  summary: string;
  plainEnglish: string[];
  concept: { nodes: ConceptNode[]; edges: ConceptEdge[] };
  game: {
    template: GameTemplateId;
    confidence: number;     // 0..1 classification confidence
    goal: string;           // what the player must achieve
    baselineLabel: string;  // naive / pre-paper tool
    powerupLabel: string;   // the paper's method as power-up
    claim: string;          // before/after claim tied to the paper
    params: Record<string, number | string>;
  };
  eval: { faithfulness: number; hallucinationRisk: number; note: string };
  source: "claude" | "mock";
}
