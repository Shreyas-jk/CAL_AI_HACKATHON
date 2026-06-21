import * as Sentry from "@sentry/nextjs";
import { askJson, hasChatLLM } from "./claude";
import { chunkSections } from "./chunk";
import { pickTemplate } from "./templates";
import { scoreEval, logToArize, logGameSpecEval } from "./arize";
import { customizeGame, isValidCraftedContent } from "./customize";
import { getTemplateSpec } from "./templateSpecs";
import { generateGameSpec } from "./generateGameSpec";
import { isValidGameSpec } from "./gameSpec";
import { mockArtifact } from "./mockData";
import type { PaperArtifact, GameTemplateId } from "./types";

const SYS_EXTRACT = "You convert research-paper text into JSON only: {title, category, oneLiner, summary}. category is a short lowercase phrase.";
const SYS_CLASSIFY = [
  "Pick the best game template id for this paper from: pathfinding | attention | fine-tuning-alignment | reasoning | vision-detective | gridworld-rl | epidemic | none.",
  "- pathfinding: search, planning, A*/heuristics, graph traversal, maze/navigation, route optimization, evaluation/benchmarks, embedding similarity, metric navigation.",
  "- attention: transformer attention, self-attention, sequence/NLP, coreference, what tokens a model focuses on, prompt engineering, in-context learning, few-shot learning.",
  "- fine-tuning-alignment: fine-tuning, RLHF, DPO, preference optimization, reward modeling, alignment, policy drift / reward hacking, LLM pretraining, learning rate scheduling, loss landscape, training stability.",
  "- reasoning: chain-of-thought, test-time compute, best-of-N sampling, verifiers/voting, multi-step or constraint-satisfaction reasoning, planning puzzles, agentic AI, tool-use, task decomposition, agent planning.",
  "- vision-detective: multimodal vision-language, VQA, OCR/document understanding, CLIP-style image-text, grounding, visual hallucination, safety, interpretability, red-teaming, adversarial attacks, feature steering.",
  "- gridworld-rl: reinforcement learning, policy gradient, Q-learning, reward shaping, control.",
  "- epidemic: epidemic modeling, SIR/SIS, diffusion, information spread, contagion, network effects.",
  "- none: anything that fits none of the above.",
  "Note: papers about efficiency/quantization/compression or RAG/retrieval map to the nearest template above (they have separate flagship games).",
  "Prefer a real template when the paper plausibly fits; use none only when nothing matches.",
  "JSON only: {template, confidence, goal, baselineLabel, powerupLabel, claim, params}. params are primitive knobs for the template; for vision-detective prefer params {lesson, methodName, paperClaim}.",
].join("\n");
const SYS_EXPLAIN = "JSON only: {plainEnglish: string[4-6], concept:{nodes:[{id,label,group}], edges:[{source,target,label}]}}.";

// ---- defensive coercion: the model (Anthropic OR OpenAI) can return off-shape
// fields; coerce every value the result page / GameRouter / ConceptMap reads so a
// malformed response degrades to a safe default instead of throwing (e.g. a
// non-string rendered as a React child, or plainEnglish.join on a string). ----
const TEMPLATE_IDS = new Set<GameTemplateId>([
  "pathfinding", "attention", "gridworld-rl", "epidemic", "efficiency", "rag",
  "fine-tuning-alignment", "reasoning", "vision-detective", "none",
]);
const strOr = (v: unknown, fb: string): string => (typeof v === "string" && v.trim() ? v : fb);
const numOr = (v: unknown, fb: number, min = -Infinity, max = Infinity): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fb;
};
// Coerce plainEnglish into a render-safe string[]: keep string arrays; pull a
// string out of object elements; split a single-paragraph string into sentence
// bullets (OpenAI tends to return one string where the schema asks for string[]).
function coercePlainEnglish(v: unknown): string[] {
  if (Array.isArray(v)) {
    const out = v
      .map((x) => (typeof x === "string" ? x : x && typeof x === "object"
        ? String(Object.values(x).find((val) => typeof val === "string") ?? "") : ""))
      .map((s) => s.trim())
      .filter(Boolean);
    if (out.length) return out.slice(0, 6);
  }
  if (typeof v === "string" && v.trim()) {
    return v.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean).slice(0, 6);
  }
  return [];
}
function coerceConcept(v: unknown): PaperArtifact["concept"] {
  const c = (v && typeof v === "object" ? v : {}) as { nodes?: unknown; edges?: unknown };
  const nodes = (Array.isArray(c.nodes) ? c.nodes : []).filter(
    (n: any) => n && typeof n.id === "string" && typeof n.label === "string",
  );
  const edges = (Array.isArray(c.edges) ? c.edges : []).filter(
    (e: any) => e && typeof e.source === "string" && typeof e.target === "string",
  );
  return { nodes, edges };
}
function coerceParams(v: unknown): Record<string, number | string> {
  const out: Record<string, number | string> = {};
  if (v && typeof v === "object" && !Array.isArray(v)) {
    for (const [k, val] of Object.entries(v)) {
      if (typeof val === "number" || typeof val === "string") out[k] = val;
    }
  }
  return out;
}

export async function buildArtifact(id: string, rawText: string, fallbackTitle?: string): Promise<PaperArtifact> {
  return Sentry.startSpan({ name: "buildArtifact", op: "pipeline" }, async () => {
  if (!hasChatLLM() || !rawText || rawText.length < 200) {
    return mockArtifact(id, fallbackTitle);
  }
  try {
    const sections = chunkSections(rawText);
    const trimmed = rawText.slice(0, 12000);

    const ex = await askJson<{ title: string; category: string; oneLiner: string; summary: string }>(
      SYS_EXTRACT, "Paper text:\n" + trimmed);

    const methodText = (sections.find(s => s.name === "method")?.text || "").slice(0, 3000);

    const [cl, exp] = await Promise.all([
      askJson<{ template: GameTemplateId; confidence: number; goal: string; baselineLabel: string; powerupLabel: string; claim: string; params: Record<string, number | string> }>(
        SYS_CLASSIFY, "Category: " + ex.category + "\nSummary: " + ex.summary),
      askJson<{ plainEnglish: string[]; concept: PaperArtifact["concept"] }>(
        SYS_EXPLAIN, "Summary: " + ex.summary + "\nMethod: " + methodText),
    ]);

    // coerced, render-safe text/category up front
    const category = strOr(ex.category, "uncategorized");
    const summary = strOr(ex.summary, "");

    // template must be a valid id; otherwise fall back to keyword matching (which
    // only ever returns a valid id or "none" — both safe in GameRouter).
    const proposed = typeof cl.template === "string" && TEMPLATE_IDS.has(cl.template as GameTemplateId)
      ? (cl.template as GameTemplateId) : null;
    const template: GameTemplateId = proposed && proposed !== "none" ? proposed : pickTemplate(category);

    // Generator priority (fix a): templates with a crafted mechanic get crafted
    // content FIRST; only if it's thin/invalid do they fall back to a generic
    // GameSpec. Templates with no crafted mechanic go straight to the generic spec.
    // (GameRouter dispatches on content shape — crafted content is never a valid
    // GameSpec, so it renders the crafted switch; a generic GameSpec renders
    // DynamicGame. The decision lives here, not in the router.)
    let content: Record<string, unknown> = {};
    if (getTemplateSpec(template)) {
      const crafted = await customizeGame(template, summary, category, methodText);
      if (isValidCraftedContent(template, crafted)) {
        content = crafted;
      } else {
        const generic = await generateGameSpec(summary, category, methodText);
        if (isValidGameSpec(generic)) content = generic;
      }
    } else {
      const generic = await generateGameSpec(summary, category, methodText);
      if (isValidGameSpec(generic)) content = generic;
    }

    const plainEnglish = coercePlainEnglish(exp.plainEnglish);
    const concept = coerceConcept(exp.concept);
    const ev = scoreEval(rawText, { summary, plainEnglish });

    const artifact: PaperArtifact = {
      id,
      title: strOr(ex.title, strOr(fallbackTitle, "Untitled paper")),
      category,
      oneLiner: strOr(ex.oneLiner, ""),
      summary,
      plainEnglish,
      concept,
      game: {
        template,
        confidence: numOr(cl.confidence, 0.6, 0, 1),
        goal: strOr(cl.goal, "Beat the challenge."),
        baselineLabel: strOr(cl.baselineLabel, "Naive baseline"),
        powerupLabel: strOr(cl.powerupLabel, "Paper's method"),
        claim: strOr(cl.claim, ""),
        params: coerceParams(cl.params),
        content: content && typeof content === "object" && !Array.isArray(content) ? content : {},
      },
      eval: {
        faithfulness: numOr(ev.faithfulness, 0.5, 0, 1),
        hallucinationRisk: numOr(ev.hallucinationRisk, 0.5, 0, 1),
        note: strOr(ev.note, ""),
      },
      source: "claude",
    };
    const hasGameSpec = isValidGameSpec(content);
    await logToArize({ id, faithfulness: ev.faithfulness, hallucinationRisk: ev.hallucinationRisk, template });
    await logGameSpecEval({
      id, template, category, hasGameSpec,
      vizType: hasGameSpec ? (content as Record<string, unknown> & { viz?: { vizType?: string } }).viz?.vizType : undefined,
      faithfulness: ev.faithfulness, hallucinationRisk: ev.hallucinationRisk,
      pipelineLatencyMs: Date.now(),
    });
    return artifact;
  } catch (e) {
    Sentry.captureException(e);
    console.error("[pipeline] buildArtifact error:", (e as Error).message || e);
    return mockArtifact(id, fallbackTitle);
  }
  });
}
