import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const key = process.env.PIKA_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "PIKA_API_KEY not set" }, { status: 503 });
  }

  const { prompt } = await req.json().catch(() => ({ prompt: "" }));
  if (!prompt) {
    return NextResponse.json({ error: "No prompt provided" }, { status: 400 });
  }

  try {
    const res = await fetch("https://api.pika.art/v2/generate", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: prompt.slice(0, 500),
        duration: 4,
        aspect_ratio: "16:9",
      }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "unknown");
      return NextResponse.json({ error: "Pika generation failed", detail: err }, { status: 502 });
    }

    const data = await res.json();
    return NextResponse.json({
      videoUrl: data.video_url || data.url || data.data?.url,
      id: data.id,
      status: data.status,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
