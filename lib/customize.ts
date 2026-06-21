import { askJson, hasChatLLM } from "./claude";
import { getTemplateSpec } from "./templateSpecs";
import type { GameTemplateId } from "./types";

export interface AttentionContent {
  sentences: Array<{ tokens: string[]; answer: number; explanation: string }>;
}

export interface ReasoningContent {
  theme: string;
  sessionNames: string[];
  roomNames: string[];
  slotLabels: string[];
}

export interface FineTuningContent {
  contextDescription: string;
  outputExamples: { low: string; sweet: string; high: string };
  curveLabel: string;
}

export interface VisionDetectiveContent {
  investigationContext: string;
  caseLessons: string[];
}

export interface PathfindingContent {
  scenarioContext: string;
  heuristicDescription: string;
}

export interface GridworldContent {
  hazardType: string;
  rewardDescription: string;
}

export interface EpidemicContent {
  spreadContext: string;
}

const ne = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const strArrLen = (v: unknown, len: number): boolean =>
  Array.isArray(v) && v.length === len && v.every(ne);

/**
 * Strict per-template check that customizeGame's output actually fills the
 * crafted mechanic's content (not thin/garbage). When this passes, the crafted
 * template renders parameterized to the paper; when it fails, the pipeline falls
 * back to a generic GameSpec. Keyed on the contentSchema in templateSpecs.ts.
 */
export function isValidCraftedContent(template: GameTemplateId, content: unknown): boolean {
  if (!content || typeof content !== "object" || Array.isArray(content)) return false;
  const c = content as Record<string, unknown>;
  switch (template) {
    case "attention": {
      const s = c.sentences;
      if (!Array.isArray(s) || s.length < 2) return false;
      return s.every((x: any) =>
        x && Array.isArray(x.tokens) && x.tokens.length >= 2 && x.tokens.every((t: unknown) => typeof t === "string") &&
        typeof x.answer === "number" && x.answer >= 0 && x.answer < x.tokens.length && ne(x.explanation));
    }
    case "fine-tuning-alignment": {
      const ex = c.outputExamples as { low?: unknown; sweet?: unknown; high?: unknown } | undefined;
      return ne(c.contextDescription) && ne(c.curveLabel) && !!ex && ne(ex.low) && ne(ex.sweet) && ne(ex.high);
    }
    case "reasoning":
      return ne(c.theme) && strArrLen(c.sessionNames, 6) && strArrLen(c.roomNames, 3) && strArrLen(c.slotLabels, 4);
    case "vision-detective":
      return ne(c.investigationContext) && strArrLen(c.caseLessons, 3);
    case "pathfinding":
      return ne(c.scenarioContext) && ne(c.heuristicDescription);
    case "gridworld-rl":
      return ne(c.hazardType) && ne(c.rewardDescription);
    case "epidemic":
      return ne(c.spreadContext);
    default:
      return false;
  }
}

function buildCustomizePrompt(
  template: GameTemplateId,
  summary: string,
  category: string,
  methodSection: string,
): { system: string; user: string } | null {
  const spec = getTemplateSpec(template);
  if (!spec) return null;

  const schemaLines = Object.entries(spec.contentSchema)
    .map(([key, desc]) => `  "${key}": ${desc}`)
    .join("\n");

  const system = [
    "You are customizing a game template for a specific AI/ML research paper.",
    "The game teaches the paper's core concept through interactive play.",
    "",
    `GAME: ${spec.name}`,
    `MECHANICS: ${spec.mechanics}`,
    "",
    "CONTENT SCHEMA — generate a JSON object with exactly these keys:",
    schemaLines,
    "",
    "RULES:",
    "- Use terminology and concepts from the paper.",
    "- Keep strings concise (1-2 sentences max per field).",
    "- For array fields, provide exactly the count specified.",
    "- The player should learn the paper's key insight by playing.",
    "- Return ONLY valid JSON, no explanation.",
    "",
    "EXAMPLE for a similar paper:",
    `Paper: "${spec.example.paperTitle}" (${spec.example.category})`,
    "Content: " + JSON.stringify(spec.example.content, null, 2),
  ].join("\n");

  const user = [
    `PAPER CATEGORY: ${category}`,
    `PAPER SUMMARY: ${summary}`,
    methodSection ? `PAPER METHOD: ${methodSection.slice(0, 2000)}` : "",
    "",
    "Generate the content JSON now.",
  ]
    .filter(Boolean)
    .join("\n");

  return { system, user };
}

export async function customizeGame(
  template: GameTemplateId,
  summary: string,
  category: string,
  methodSection: string,
): Promise<Record<string, unknown>> {
  if (!hasChatLLM()) return {};
  if (template === "none") return {};

  const prompt = buildCustomizePrompt(template, summary, category, methodSection);
  if (!prompt) return {};

  try {
    return await askJson<Record<string, unknown>>(prompt.system, prompt.user, 4000);
  } catch {
    return {};
  }
}
