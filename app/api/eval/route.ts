import { NextRequest, NextResponse } from "next/server";
import { scoreEval, logToArize } from "@/lib/arize";
export async function POST(req: NextRequest) {
  const { paperText = "", summary = "", plainEnglish = [] } = await req.json().catch(() => ({}));
  const ev = scoreEval(paperText, { summary, plainEnglish });
  await logToArize({ ...ev, kind: "manual-eval" });
  return NextResponse.json(ev);
}