import { getRedis } from "./redis";
import type { PaperArtifact } from "./types";
const KEY = (id: string) => "papertrail:artifact:" + id;
const INDEX_KEY = "papertrail:index";
const CATEGORY_KEY = (cat: string) => "papertrail:category:" + cat.toLowerCase().replace(/[^a-z0-9]/g, "-");
const mem = new Map<string, PaperArtifact>();

export async function saveArtifact(a: PaperArtifact): Promise<void> {
  mem.set(a.id, a);
  const r = await getRedis();
  if (r) {
    try {
      await r.set(KEY(a.id), JSON.stringify(a), { EX: 60 * 60 * 24 * 7 });
      await r.sAdd(INDEX_KEY, a.id);
      if (a.category) {
        await r.sAdd(CATEGORY_KEY(a.category), a.id);
      }
      await r.hSet("papertrail:meta:" + a.id, {
        title: a.title,
        category: a.category,
        template: a.game.template,
        source: a.source,
        createdAt: new Date().toISOString(),
      });
    } catch {}
  }
}

export async function getArtifact(id: string): Promise<PaperArtifact | null> {
  if (mem.has(id)) return mem.get(id)!;
  const r = await getRedis();
  if (r) {
    try { const v = await r.get(KEY(id)); if (v) { const a = JSON.parse(v) as PaperArtifact; mem.set(id, a); return a; } } catch {}
  }
  return null;
}

export async function listRecentArtifacts(limit = 10): Promise<{ id: string; title: string; category: string; template: string }[]> {
  const r = await getRedis();
  if (!r) return [];
  try {
    const ids = await r.sMembers(INDEX_KEY);
    const results: { id: string; title: string; category: string; template: string }[] = [];
    for (const id of ids.slice(-limit)) {
      const meta = await r.hGetAll("papertrail:meta:" + id);
      if (meta.title) {
        results.push({ id, title: meta.title, category: meta.category || "", template: meta.template || "" });
      }
    }
    return results;
  } catch { return []; }
}