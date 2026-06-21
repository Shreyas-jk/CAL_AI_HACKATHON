import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "DEEPGRAM_API_KEY not set" }, { status: 503 });
  }

  const { text } = await req.json().catch(() => ({ text: "" }));
  if (!text) {
    return NextResponse.json({ error: "No text provided" }, { status: 400 });
  }

  try {
    const res = await fetch("https://api.deepgram.com/v1/speak?model=aura-2-en", {
      method: "POST",
      headers: {
        Authorization: `Token ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Deepgram TTS failed" }, { status: 502 });
    }

    const audioBuffer = await res.arrayBuffer();
    return new NextResponse(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "TTS request failed" }, { status: 500 });
  }
}
