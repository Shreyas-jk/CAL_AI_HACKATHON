export type GameTemplateId =
  | "pathfinding" | "attention" | "gridworld-rl" | "epidemic" | "fine-tuning-alignment" | "none";
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
    confidence: number;
    goal: string;
    baselineLabel: string;
    powerupLabel: string;
    claim: string;
    params: Record<string, number | string>;
  };
  eval: { faithfulness: number; hallucinationRisk: number; note: string };
  source: "claude" | "mock";
}