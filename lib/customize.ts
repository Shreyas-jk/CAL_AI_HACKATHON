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
