import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-latest";

export function hasClaude(): boolean { return !!process.env.ANTHROPIC_API_KEY; }

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  return client;
}

// Ask Claude and parse a JSON object out of the response. Throws if no key.
export async function askJson<T>(system: string, user: string): Promise<T> {
  if (!hasClaude()) throw new Error("ANTHROPIC_API_KEY not set");
  const msg = await getClient().messages.create({
    model: MODEL,
    max_tokens: 2000,
    system,
    messages: [{ role: "user", content: user }],
  });
  const text = msg.content.map((c) => (c.type === "text" ? c.text : "")).join("\n");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON in Claude response");
  return JSON.parse(text.slice(start, end + 1)) as T;
}
