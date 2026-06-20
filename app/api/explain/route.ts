import { NextRequest, NextResponse } from "next/server";
import { askJson, hasClaude } from "@/lib/claude";
export async function POST(req: NextRequest) {
  const { summary = "" } = await req.json().catch(() => ({}));
  if (!hasClaude()) return NextResponse.json({ plainEnglish: ["(offline) connect ANTHROPIC_API_KEY for live explanations."], concept: { nodes: [], edges: [] } });
  try {
    const out = await askJson("JSON only: {plainEnglish:string[], concept:{nodes:[],edges:[]}}", "Summary: " + summary);
    return NextResponse.json(out);
  } catch { return NextResponse.json({ plainEnglish: [], concept: { nodes: [], edges: [] } }); }
}