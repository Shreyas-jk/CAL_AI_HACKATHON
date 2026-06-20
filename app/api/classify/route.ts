import { NextRequest, NextResponse } from "next/server";
import { pickTemplate } from "@/lib/templates";
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const category = body.category || "";
  return NextResponse.json({ template: pickTemplate(category), category });
}