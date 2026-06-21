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

/** Is any chat-capable LLM key available? Prefers Anthropic; OpenAI is the fallback. */
export function hasChatLLM(): boolean {
  return !!process.env.ANTHROPIC_API_KEY || !!process.env.OPENAI_API_KEY;
}

function flattenSystem(system: Anthropic.MessageCreateParams["system"]): string {
  if (typeof system === "string") return system;
  if (Array.isArray(system)) return system.map((b) => (b.type === "text" ? b.text : "")).join("\n\n");
  return "";
}

/**
 * Stream a multi-turn chat reply, yielding text deltas as they arrive. Prefers
 * Anthropic (claude-sonnet-4-6); falls back to OpenAI when only OPENAI_API_KEY is
 * set (demo). `system` accepts a string or system blocks — pass a
 * `cache_control: { type: "ephemeral" }` block (the paper text) so Anthropic
 * re-sends bill at ~0.1x; OpenAI ignores cache_control and sees the flattened text.
 */
export async function* streamChat(
  system: Anthropic.MessageCreateParams["system"],
  messages: ChatMessage[],
  maxTokens = 1024,
): AsyncGenerator<string> {
  if (process.env.ANTHROPIC_API_KEY) {
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
    return;
  }
  if (process.env.OPENAI_API_KEY) {
    const OpenAI = (await import("openai")).default;
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.OPENAI_MODEL || "gpt-4o";
    const stream = await client.chat.completions.create({
      model,
      stream: true,
      temperature: 0.2,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: flattenSystem(system) },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    });
    for await (const chunk of stream) {
      const t = chunk.choices?.[0]?.delta?.content;
      if (t) yield t;
    }
    return;
  }
  throw new Error("No LLM API key set (ANTHROPIC_API_KEY or OPENAI_API_KEY)");
}
