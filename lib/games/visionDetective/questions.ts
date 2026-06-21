import type { VisionCase, VisionQuestion } from "./types";

export function questionById(visionCase: VisionCase, id: string): VisionQuestion | undefined {
  return visionCase.questions.find((q) => q.id === id);
}

export function questionClues(visionCase: VisionCase, askedIds: string[]): string[] {
  return askedIds
    .map((id) => questionById(visionCase, id))
    .filter((q): q is VisionQuestion => Boolean(q))
    .map((q) => `${q.answer ? "Yes" : "No"}: ${q.clue}`);
}

export function questionSignal(visionCase: VisionCase, askedIds: string[]): number {
  return askedIds.reduce((sum, id) => sum + (questionById(visionCase, id)?.relevance ?? 0), 0);
}
