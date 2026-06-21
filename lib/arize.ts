// Arize eval logging. No-ops gracefully when keys are absent so the app
// always runs in a demo. We compute simple heuristic eval scores client-side
// and (optionally) ship the event to Arize.
import type { PaperArtifact } from "./types";

export function scoreEval(paperText: string, a: Pick<PaperArtifact, "summary" | "plainEnglish">) {
  const txt = (paperText || "").toLowerCase();
  const claims = [a.summary, ...(a.plainEnglish || [])].join(" ").toLowerCase();
  const words = Array.from(new Set(claims.split(/[^a-z0-9]+/).filter((w) => w.length > 4)));
  if (words.length === 0) return { faithfulness: 0.5, hallucinationRisk: 0.5, note: "no-content" };
  const hits = words.filter((w) => txt.includes(w)).length;
  const faithfulness = Math.min(1, Math.max(0, hits / words.length));
  const hallucinationRisk = Math.round((1 - faithfulness) * 100) / 100;
  return {
    faithfulness: Math.round(faithfulness * 100) / 100,
    hallucinationRisk,
    note: faithfulness > 0.6 ? "grounded" : "review",
  };
}

export async function logToArize(event: Record<string, unknown>): Promise<void> {
  const key = process.env.ARIZE_API_KEY;
  const space = process.env.ARIZE_SPACE_ID;
  if (!key || !space) return;
  try {
    await fetch("https://api.arize.com/v1/log", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + key, "Space-Id": space },
      body: JSON.stringify({
        model: "papertrail-ai",
        model_version: "2.0",
        timestamp: new Date().toISOString(),
        ...event,
      }),
    });
  } catch {}
}

export async function logGameSpecEval(event: {
  id: string;
  template: string;
  category: string;
  hasGameSpec: boolean;
  vizType?: string;
  faithfulness: number;
  hallucinationRisk: number;
  pipelineLatencyMs: number;
}): Promise<void> {
  await logToArize({
    ...event,
    eval_type: "game_spec_generation",
    tags: {
      template: event.template,
      category: event.category,
      has_game_spec: event.hasGameSpec,
      viz_type: event.vizType || "none",
    },
  });
}
