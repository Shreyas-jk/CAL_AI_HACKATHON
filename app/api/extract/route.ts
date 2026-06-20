import { NextRequest, NextResponse } from "next/server";
import { extractPdfText } from "@/lib/chunk";
import { buildArtifact } from "@/lib/pipeline";
import { saveArtifact } from "@/lib/store";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const id = Math.random().toString(36).slice(2, 10);
  let rawText = "";
  let title: string | undefined;
  const ctype = req.headers.get("content-type") || "";
  try {
    if (ctype.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file") as File | null;
      if (file) {
        title = file.name.replace(/\.pdf$/i, "");
        const buf = Buffer.from(await file.arrayBuffer());
        rawText = await extractPdfText(buf);
      }
    } else {
      const body = await req.json().catch(() => ({}));
      rawText = body.text || "";
      title = body.title;
    }
  } catch {}
  const artifact = await buildArtifact(id, rawText, title);
  await saveArtifact(artifact);
  return NextResponse.json({ id, artifact });
}