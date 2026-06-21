import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

export function hasClaude(): boolean { return !!process.env.ANTHROPIC_API_KEY; }

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  return client;
}

// Ask Claude and parse a JSON object out of the response. Throws if no key.
export async function askJson<T>(system: string, user: string, maxTokens?: number): Promise<T> {
  if (!hasClaude()) throw new Error("ANTHROPIC_API_KEY not set");
  const msg = await getClient().messages.create({
    model: MODEL,
    max_tokens: maxTokens ?? 2000,
    system,
    messages: [{ role: "user", content: user }],
  });
  const text = msg.content.map((c) => (c.type === "text" ? c.text : "")).join("\n");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON in Claude response");
  return JSON.parse(text.slice(start, end + 1)) as T;
}

export type ChatMessage = { role: "user" | "assistant"; content: string };

/**
 * Stream a multi-turn chat reply, yielding text deltas as they arrive. Throws if
 * no key. `system` accepts a string or an array of system blocks — pass an array
 * with a `cache_control: { type: "ephemeral" }` block (e.g. the paper text) so
 * re-sending it each turn bills at ~0.1x (cache read).
 */
export async function* streamChat(
  system: Anthropic.MessageCreateParams["system"],
  messages: ChatMessage[],
  maxTokens = 1024,
): AsyncGenerator<string> {
  if (!hasClaude()) throw new Error("ANTHROPIC_API_KEY not set");
  const stream = getClient().messages.stream({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield event.delta.text;
    }
  }
}
