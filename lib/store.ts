import { getRedis } from "./redis";
import type { PaperArtifact } from "./types";
const KEY = (id: string) => "papertrail:artifact:" + id;
const mem = new Map<string, PaperArtifact>();

export async function saveArtifact(a: PaperArtifact): Promise<void> {
  mem.set(a.id, a);
  const r = await getRedis();
  if (r) { try { await r.set(KEY(a.id), JSON.stringify(a), { EX: 60 * 60 * 24 }); } catch {} }
}

export async function getArtifact(id: string): Promise<PaperArtifact | null> {
  if (mem.has(id)) return mem.get(id)!;
  const r = await getRedis();
  if (r) {
    try { const v = await r.get(KEY(id)); if (v) { const a = JSON.parse(v) as PaperArtifact; mem.set(id, a); return a; } } catch {}
  }
  return null;
}