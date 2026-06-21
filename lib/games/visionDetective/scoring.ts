import type { VisionCase, VisionRun, VisionSettings } from "./types";
import { questionSignal } from "./questions";

const THRESHOLD_SCORE = { low: 0, medium: 8, high: 12 } as const;
const COMPUTE_BUDGET = { object: 20, ocr: 22, hallucination: 18 } as const;

export function computeVisionCost(settings: VisionSettings, askedCount: number): number {
  return (
    (settings.regionGrounding ? 5 : 0) +
    (settings.ocr ? 5 : 0) +
    (settings.objectDetector ? 5 : 0) +
    (settings.cropTool ? 3 : 0) +
    (settings.groundingRequired ? 3 : 0) +
    THRESHOLD_SCORE[settings.confidenceThreshold] +
    (settings.reasoningSteps - 1) +
    askedCount * 2
  );
}

export function runVisionCase(visionCase: VisionCase, settings: VisionSettings, questionHistory: string[]): VisionRun {
  const signal = questionSignal(visionCase, questionHistory);
  const askedCount = questionHistory.length;
  const computeCost = computeVisionCost(settings, askedCount);
  const computeBudget = COMPUTE_BUDGET[visionCase.id];
  const computeRemaining = computeBudget - computeCost;
  const overBudget = computeRemaining < 0;
  const unlockedEvidenceIds = unlockedEvidence(visionCase, settings, signal);

  let answerCorrectness = 0;
  let groundingAccuracy = 0;
  let hallucinationScore = 0;
  let confidence = 35 + Math.min(25, signal * 4) + (settings.reasoningSteps - 1) * 4;
  let modelAnswer = visionCase.decoyAnswer;
  let evidenceExplanation = "The model followed a plausible clue, but it did not ground the answer in the right visual evidence.";

  if (visionCase.id === "object") {
    const grounded = settings.regionGrounding && settings.objectDetector;
    answerCorrectness = grounded ? 50 : 0;
    groundingAccuracy = grounded ? 30 : settings.regionGrounding ? 12 : 0;
    hallucinationScore = grounded ? 10 : 0;
    confidence += grounded ? 20 : -5;
    if (grounded) {
      modelAnswer = visionCase.correctAnswer;
      evidenceExplanation = "Detector proposals plus region grounding lock onto the box at the doorway instead of the backpack.";
    }
  }

  if (visionCase.id === "ocr") {
    const readText = settings.ocr && (settings.cropTool || settings.reasoningSteps >= 3);
    answerCorrectness = readText ? 50 : 0;
    groundingAccuracy = readText ? 28 : settings.ocr ? 12 : 0;
    hallucinationScore = readText ? 8 : 0;
    confidence += readText ? 18 : -8;
    if (readText) {
      modelAnswer = visionCase.correctAnswer;
      evidenceExplanation = "OCR extracts the item prices, and the crop keeps the model focused on the receipt row with the highest value.";
    }
  }

  if (visionCase.id === "hallucination") {
    const cautious = settings.groundingRequired && settings.regionGrounding && settings.confidenceThreshold !== "low";
    answerCorrectness = cautious ? 45 : 0;
    groundingAccuracy = cautious ? 25 : settings.regionGrounding ? 10 : 0;
    hallucinationScore = cautious ? 25 : -15;
    confidence += cautious ? 12 : -12;
    if (cautious) {
      modelAnswer = visionCase.correctAnswer;
      evidenceExplanation = "The model cannot find a cat evidence region, so the grounded answer is a refusal rather than a guess.";
    }
  }

  if (overBudget) {
    hallucinationScore -= 10;
    evidenceExplanation = `The model ${answerCorrectness > 0 ? "found the right evidence," : "made progress,"} but the run exceeded the compute budget by ${Math.abs(computeRemaining)}. Solve it with fewer tools or fewer questions.`;
  }

  const rawScore = answerCorrectness + groundingAccuracy + hallucinationScore - computeCost;
  const finalScore = Math.max(0, Math.min(100, Math.round(rawScore)));
  confidence = Math.max(5, Math.min(99, Math.round(confidence)));
  const solved = answerCorrectness > 0 && finalScore >= 45 && !overBudget;

  return {
    answerCorrectness,
    groundingAccuracy,
    hallucinationScore,
    computeCost,
    computeBudget,
    computeRemaining,
    overBudget,
    confidence,
    finalScore,
    verdict: verdictFor(visionCase.id, solved, hallucinationScore, groundingAccuracy),
    modelAnswer,
    evidenceExplanation,
    unlockedEvidenceIds,
    solved,
  };
}

function unlockedEvidence(visionCase: VisionCase, settings: VisionSettings, signal: number): string[] {
  const ids = new Set<string>();
  if (settings.regionGrounding || signal >= 4) {
    for (const box of visionCase.evidence) if (box.kind !== "text") ids.add(box.id);
  }
  if (settings.objectDetector && visionCase.id === "object") ids.add("box");
  if (settings.ocr && visionCase.id === "ocr") ids.add("tea");
  if (settings.cropTool && visionCase.id === "ocr") ids.add("lamp");
  if (settings.groundingRequired && visionCase.id === "hallucination") ids.add("missing-cat");
  return Array.from(ids);
}

function verdictFor(caseId: VisionCase["id"], solved: boolean, hallucinationScore: number, groundingAccuracy: number) {
  if (caseId === "hallucination" && solved) return "hallucination-caught";
  if (solved) return "case-solved";
  if (hallucinationScore < 0) return "false-lead";
  if (groundingAccuracy > 0) return "weak-evidence";
  return "false-lead";
}
