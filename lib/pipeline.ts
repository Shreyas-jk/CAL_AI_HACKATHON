import { askJson, hasClaude } from "./claude";
import { chunkSections } from "./chunk";
import { pickTemplate } from "./templates";
import { scoreEval, logToArize } from "./arize";
import { mockArtifact } from "./mockData";
import type { PaperArtifact, GameTemplateId } from "./types";

const SYS_EXTRACT = "You convert research-paper text into JSON only: {title, category, oneLiner, summary}. category is a short lowercase phrase.";
const SYS_CLASSIFY = [
  "Pick the best game template id for this paper from: pathfinding | attention | fine-tuning-alignment | reasoning | vision-detective | none.",
  "- pathfinding: search, planning, A*/heuristics, graph traversal, maze/navigation, route optimization.",
  "- attention: transformer attention, self-attention, sequence/NLP, coreference, what tokens a model focuses on.",
  "- fine-tuning-alignment: fine-tuning, RLHF, DPO, preference optimization, reward modeling, alignment, policy drift / reward hacking.",
  "- reasoning: chain-of-thought, test-time compute, best-of-N sampling, verifiers/voting, multi-step or constraint-satisfaction reasoning, planning puzzles.",
  "- vision-detective: multimodal vision-language, VQA, OCR/document understanding, CLIP-style image-text, grounding, visual hallucination.",
  "- none: anything that fits none of the above.",
  "Prefer a real template when the paper plausibly fits; use none only when nothing matches.",
  "JSON only: {template, confidence, goal, baselineLabel, powerupLabel, claim, params}. params are primitive knobs for the template; for vision-detective prefer params {lesson, methodName, paperClaim}.",
].join("\n");
const SYS_EXPLAIN = "JSON only: {plainEnglish: string[4-6], concept:{nodes:[{id,label,group}], edges:[{source,target,label}]}}.";

export async function buildArtifact(id: string, rawText: string, fallbackTitle?: string): Promise<PaperArtifact> {
  if (!hasClaude() || !rawText || rawText.length < 200) {
    return mockArtifact(id, fallbackTitle);
  }
  try {
    const sections = chunkSections(rawText);
    const trimmed = rawText.slice(0, 12000);

    const ex = await askJson<{ title: string; category: string; oneLiner: string; summary: string }>(
      SYS_EXTRACT, "Paper text:\n" + trimmed);

    const cl = await askJson<{ template: GameTemplateId; confidence: number; goal: string; baselineLabel: string; powerupLabel: string; claim: string; params: Record<string, number | string> }>(
      SYS_CLASSIFY, "Category: " + ex.category + "\nSummary: " + ex.summary);

    const exp = await askJson<{ plainEnglish: string[]; concept: PaperArtifact["concept"] }>(
      SYS_EXPLAIN, "Summary: " + ex.summary + "\nMethod: " + (sections.find(s => s.name === "method")?.text || "").slice(0, 3000));

    const template = cl.template && cl.template !== "none" ? cl.template : pickTemplate(ex.category);
    const ev = scoreEval(rawText, { summary: ex.summary, plainEnglish: exp.plainEnglish });

    const artifact: PaperArtifact = {
      id, title: ex.title || fallbackTitle || "Untitled paper",
      category: ex.category, oneLiner: ex.oneLiner, summary: ex.summary,
      plainEnglish: exp.plainEnglish || [], concept: exp.concept || { nodes: [], edges: [] },
      game: {
        template, confidence: cl.confidence ?? 0.6, goal: cl.goal || "Beat the challenge.",
        baselineLabel: cl.baselineLabel || "Naive baseline", powerupLabel: cl.powerupLabel || "Paper's method",
        claim: cl.claim || "", params: cl.params || {},
      },
      eval: { ...ev, note: ev.note }, source: "claude",
    };
    await logToArize({ id, faithfulness: ev.faithfulness, hallucinationRisk: ev.hallucinationRisk, template });
    return artifact;
  } catch (e) {
    // any API failure -> never break the demo
    return mockArtifact(id, fallbackTitle);
  }
}
