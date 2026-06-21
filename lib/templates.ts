import type { GameTemplateId } from "./types";
export interface TemplateMeta {
  id: GameTemplateId;
  title: string;
  categories: string[];
  blurb: string;
  fullyPlayable: boolean;
}
export const TEMPLATES: TemplateMeta[] = [
  { id: "pathfinding", title: "Maze Runner (A* vs naive search)",
    categories: ["pathfinding", "planning", "search", "graph"],
    blurb: "Navigate a maze under a step budget. Naive BFS burns out; the paper's heuristic finds the goal.",
    fullyPlayable: true },
  { id: "fine-tuning-alignment", title: "The Leash (policy drift vs reward hacking)",
    categories: ["fine-tuning", "alignment", "rlhf", "dpo", "preference", "reward model", "policy optimization", "reinforcement learning from human feedback"],
    blurb: "Drag how much the policy can drift from base behavior. Too little and nothing changes; too much and it reward-hacks into gibberish.",
    fullyPlayable: true },
  { id: "attention", title: "Spotlight (uniform vs learned attention)",
    categories: ["attention", "transformer", "nlp", "sequence"],
    blurb: "Find the token the model should focus on. Uniform attention smears; learned attention spotlights it.",
    fullyPlayable: true },
  { id: "gridworld-rl", title: "Survivor (policy vs reward shaping)",
    categories: ["reinforcement learning", "rl", "policy", "control"],
    blurb: "Pick a policy and survive the grid. Naive policy dies; reward shaping keeps the agent alive.",
    fullyPlayable: false },
  { id: "epidemic", title: "Flatten It (policy strategy game)",
    categories: ["epidemic", "sir", "diffusion", "spread", "graph"],
    blurb: "Set interventions to keep infections under threshold. A strategy mini-game.",
    fullyPlayable: false },
  { id: "reasoning", title: "AI Conference Scheduler (test-time compute)",
    categories: ["reasoning", "chain-of-thought", "chain of thought", "cot", "test-time", "planning", "constraint"],
    blurb: "Solve a 6-session scheduling puzzle. A single sample fails; best-of-N + verifier + voting under a compute budget finds the 8/8 solution.",
    fullyPlayable: true },
  { id: "vision-detective", title: "Vision Detective (grounded VLM lab)",
    categories: ["multimodal", "vision-language", "vision language", "vlm", "vqa", "clip", "ocr", "document understanding", "grounding", "visual hallucination"],
    blurb: "Interrogate a vision-language model with yes/no questions, then ground answers in visual evidence before it hallucinates.",
    fullyPlayable: true },
];
export function pickTemplate(category: string): GameTemplateId {
  const c = (category || "").toLowerCase();
  for (const t of TEMPLATES) if (t.categories.some((k) => c.includes(k))) return t.id;
  return "none";
}