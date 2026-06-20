// PDF text extraction + lightweight section chunking. Server-only.
export async function extractPdfText(buf: Buffer): Promise<string> {
  try {
    // dynamic import keeps pdf-parse out of the edge/client bundle
    const pdfParse = (await import("pdf-parse")).default as (b: Buffer) => Promise<{ text: string }>;
    const out = await pdfParse(buf);
    return (out.text || "").trim();
  } catch {
    return "";
  }
}

export interface Section { name: string; text: string; }

const HEADERS = ["abstract", "introduction", "background", "related work", "method",
  "approach", "model", "experiments", "results", "evaluation", "discussion", "conclusion"];

export function chunkSections(text: string): Section[] {
  const lines = text.split(/\r?\n/);
  const sections: Section[] = [];
  let current: Section = { name: "preamble", text: "" };
  for (const line of lines) {
    const t = line.trim().toLowerCase().replace(/^[0-9.\s]+/, "");
    const hit = HEADERS.find((h) => t === h || t.startsWith(h + " ") || t === h + ".");
    if (hit && line.trim().length < 40) {
      if (current.text.trim()) sections.push(current);
      current = { name: hit, text: "" };
    } else {
      current.text += line + "\n";
    }
  }
  if (current.text.trim()) sections.push(current);
  return sections;
}
