import { NextRequest, NextResponse } from "next/server";
import { hasClaude, streamChat, type ChatMessage } from "@/lib/claude";
import { getPaperText, getArtifact } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Grounded "ask the paper" chat. Answers strictly from the stored paper text;
// when no text is on file (existing / mock / no-key) it reports unavailable and
// refuses rather than answering from general knowledge.

function groundingSystem(title: string, paper: string) {
  const rules =
    "You are a research assistant answering questions about ONE specific paper, given below.\n" +
    "RULES — follow exactly:\n" +
    "1. Answer ONLY using the paper text provided. Do NOT use outside or general knowledge.\n" +
    "2. Cite the part of the paper you used — name the section (e.g. \"Abstract\", \"Methods\", \"Section 3\") or quote a short phrase from it.\n" +
    "3. If the paper does not contain the answer, say plainly that the paper doesn't cover it. Do NOT guess or fall back to general knowledge.\n" +
    "4. Be concise and specific.";
  return [
    { type: "text" as const, text: rules },
    {
      // the big, stable block — cache it so re-sends each turn bill at ~0.1x
      type: "text" as const,
      text: `PAPER TITLE: ${title || "(untitled)"}\n\nPAPER TEXT (the only source you may use):\n${paper}`,
      cache_control: { type: "ephemeral" as const },
    },
  ];
}

// GET /api/chat?id=... -> is grounded chat available for this paper?
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") || "";
  if (!hasClaude()) return NextResponse.json({ available: false, reason: "no-key" });
  const text = id ? await getPaperText(id) : null;
  return NextResponse.json({ available: !!text, reason: text ? "ok" : "no-text" });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const id: string = body?.id || "";
  const messages: ChatMessage[] = Array.isArray(body?.messages) ? body.messages : [];

  if (!hasClaude()) {
    return NextResponse.json({ available: false, reason: "no-key" }, { status: 200 });
  }
  const paper = id ? await getPaperText(id) : null;
  if (!paper) {
    // Honest degradation — never answer without the paper text.
    return NextResponse.json({ available: false, reason: "no-text" }, { status: 200 });
  }
  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return NextResponse.json({ error: "messages must end with a user turn" }, { status: 400 });
  }

  const artifact = await getArtifact(id);
  const system = groundingSystem(artifact?.title || "", paper);
  const gen = streamChat(system, messages, 1500);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await gen.next();
        if (done) { controller.close(); return; }
        controller.enqueue(encoder.encode(value));
      } catch {
        controller.enqueue(encoder.encode("\n\n[chat error — please retry]"));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
