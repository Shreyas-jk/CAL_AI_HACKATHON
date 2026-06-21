import { NextRequest, NextResponse } from "next/server";
import { extractPdfText } from "@/lib/chunk";
import { buildArtifact } from "@/lib/pipeline";
import { saveArtifact } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { url } = await req.json().catch(() => ({ url: "" }));
  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "No URL provided" }, { status: 400 });
  }

  const id = Math.random().toString(36).slice(2, 10);

  try {
    let rawText = "";
    let title: string | undefined;

    const bbKey = process.env.BROWSERBASE_API_KEY;
    const bbProject = process.env.BROWSERBASE_PROJECT_ID;

    if (bbKey && bbProject) {
      const sessionRes = await fetch("https://api.browserbase.com/v1/sessions", {
        method: "POST",
        headers: {
          "x-bb-api-key": bbKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ projectId: bbProject }),
      });
      const session = await sessionRes.json();

      const pageRes = await fetch(
        `https://api.browserbase.com/v1/sessions/${session.id}/pages`,
        {
          method: "POST",
          headers: {
            "x-bb-api-key": bbKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url,
            waitUntil: "networkidle2",
          }),
        },
      );
      const page = await pageRes.json();
      rawText = page.text || page.content || "";
      title = page.title;

      await fetch(`https://api.browserbase.com/v1/sessions/${session.id}`, {
        method: "DELETE",
        headers: { "x-bb-api-key": bbKey },
      }).catch(() => {});
    } else {
      const res = await fetch(url, {
        headers: { "User-Agent": "PaperTrail-AI/1.0" },
      });
      const contentType = res.headers.get("content-type") || "";

      if (contentType.includes("pdf")) {
        const buf = Buffer.from(await res.arrayBuffer());
        rawText = await extractPdfText(buf);
        title = url.split("/").pop()?.replace(/\.pdf$/i, "");
      } else {
        rawText = await res.text();
        const titleMatch = rawText.match(/<title[^>]*>([^<]+)<\/title>/i);
        title = titleMatch?.[1]?.trim();
        rawText = rawText.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      }
    }

    const artifact = await buildArtifact(id, rawText, title);
    await saveArtifact(artifact);
    return NextResponse.json({ id, artifact });
  } catch (e) {
    return NextResponse.json(
      { error: "Failed to fetch URL: " + (e as Error).message },
      { status: 500 },
    );
  }
}
