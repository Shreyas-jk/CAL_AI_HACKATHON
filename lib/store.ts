import { getRedis } from "./redis";
import type { PaperArtifact } from "./types";
const KEY = (id: string) => "papertrail:artifact:" + id;
const INDEX_KEY = "papertrail:index";
const CATEGORY_KEY = (cat: string) => "papertrail:category:" + cat.toLowerCase().replace(/[^a-z0-9]/g, "-");
const PAPER_KEY = (id: string) => "papertrail:paper:" + id;
const TTL_SEC = 60 * 60 * 24 * 7; // 7 days — matches the artifact TTL
const MAX_PAPER_CHARS = 200_000;  // guard; a full paper still fits Sonnet 4.6's window
const mem = new Map<string, PaperArtifact>();
// Pin to globalThis so the in-memory paper-text store is shared across Next route
// bundles in one process (without this, /api/extract and /api/chat get separate
// Map instances and text saved at intake isn't visible to chat unless Redis is set).
const g = globalThis as unknown as { __paperMem?: Map<string, string> };
const paperMem: Map<string, string> = g.__paperMem ?? (g.__paperMem = new Map());

/**
 * Persist the raw parsed paper text separately from the artifact (kept off the
 * artifact so the client payload / Redis value stay lean). Used by the grounded
 * chat. Skips empty text. Same 7-day TTL as artifacts.
 */
export async function savePaperText(id: string, text: string): Promise<void> {
  const t = (text || "").trim();
  if (!t) return;
  const clipped = t.length > MAX_PAPER_CHARS ? t.slice(0, MAX_PAPER_CHARS) : t;
  paperMem.set(id, clipped);
  const r = await getRedis();
  if (r) {
    try { await r.set(PAPER_KEY(id), clipped, { EX: TTL_SEC }); } catch {}
  }
}

/** Returns the stored paper text for an id, or null if none (existing/mock/no-key). */
export async function getPaperText(id: string): Promise<string | null> {
  if (paperMem.has(id)) return paperMem.get(id)!;
  const r = await getRedis();
  if (r) {
    try { const v = await r.get(PAPER_KEY(id)); if (v) { paperMem.set(id, v); return v; } } catch {}
  }
  return null;
}

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