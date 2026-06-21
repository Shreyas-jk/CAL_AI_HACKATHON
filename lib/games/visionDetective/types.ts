export type VisionCaseId = "object" | "ocr" | "hallucination";
export type ConfidenceThreshold = "low" | "medium" | "high";
export type Verdict = "case-solved" | "weak-evidence" | "hallucination-caught" | "false-lead";

export interface VisionSettings {
  regionGrounding: boolean;
  ocr: boolean;
  objectDetector: boolean;
  cropTool: boolean;
  groundingRequired: boolean;
  confidenceThreshold: ConfidenceThreshold;
  reasoningSteps: 1 | 3 | 5;
}

export interface EvidenceBox {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  kind: "target" | "decoy" | "text" | "missing";
}

export interface VisionQuestion {
  id: string;
  text: string;
  answer: boolean;
  clue: string;
  relevance: number;
}

export interface VisionCase {
  id: VisionCaseId;
  title: string;
  subtitle: string;
  objective: string;
  prompt: string;
  hiddenTarget: string;
  correctAnswer: string;
  decoyAnswer: string;
  lesson: string;
  scene: "doorway" | "receipt" | "counter";
  evidence: EvidenceBox[];
  questions: VisionQuestion[];
}

export interface VisionRun {
  answerCorrectness: number;
  groundingAccuracy: number;
  hallucinationScore: number;
  computeCost: number;
  computeBudget: number;
  computeRemaining: number;
  overBudget: boolean;
  confidence: number;
  finalScore: number;
  verdict: Verdict;
  modelAnswer: string;
  evidenceExplanation: string;
  unlockedEvidenceIds: string[];
  solved: boolean;
}
