"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { RagGrid, RouterAction } from "@/lib/games/rag/types";

// ============================================================================
// Headless game logic for the real-time RAG router. UNCHANGED from the original
// RealtimeJunction — tick loop, per-lane latency, queue/congestion, grid-driven
// correct/breach, win/lose conditions. Only the RENDER layer (2D vs 3D factory)
// consumes this; the mechanic is identical.
// ============================================================================

export const TICK_MS = 340;            // ~3 ticks/sec
export const CAP = 5;                  // queue capacity before overflow
export const LAT: Record<RouterAction, number> = { refine: 1, hybrid: 3, web: 5 };
const BREACH_PEN = 12;
const TIMEOUT_PEN = 16;

export interface ScheduleEntry { t: number; q: string; }
export interface Packet { uid: number; query_id: string; bars: number; }
export interface Lane { busy: Packet | null; start: number; latency: number; last: { ok: boolean; q: string } | null; }
export interface World {
  tick: number; nextUid: number; spawnPtr: number;
  queue: Packet[];
  lanes: Record<RouterAction, Lane>;
  integrity: number; correct: number; total: number;
  breaches: number; timeouts: number;
  selectedUid: number | null;
  status: "running" | "won" | "lost";
}
export interface WaveEnd { status: "won" | "lost"; accuracy: number; breaches: number; timeouts: number; }

function emptyLane(): Lane { return { busy: null, start: 0, latency: 0, last: null }; }

export function useRealtimeGame({ grid, schedule, auto, winBar, onPeek, onEnd }: {
  grid: RagGrid; schedule: ScheduleEntry[]; auto: boolean; winBar: number;
  onPeek: (q: string) => void; onEnd: (r: WaveEnd) => void;
}) {
  const sigOf = useMemo(() => { const m: Record<string, number> = {}; for (const q of grid.queries) m[q.query_id] = q.quality_signal; return m; }, [grid]);
  const barsOf = (q: string) => { const s = sigOf[q]; return s < 0.35 ? 1 : s < 0.58 ? 2 : 3; };

  const init = (): World => ({
    tick: 0, nextUid: 1, spawnPtr: 0, queue: [],
    lanes: { refine: emptyLane(), hybrid: emptyLane(), web: emptyLane() },
    integrity: 100, correct: 0, total: 0, breaches: 0, timeouts: 0, selectedUid: null, status: "running",
  });
  const [w, setW] = useState<World>(init);

  function advance(prev: World): World {
    if (prev.status !== "running") return prev;
    const w: World = { ...prev, tick: prev.tick + 1, queue: [...prev.queue], lanes: { ...prev.lanes } };
    const t = w.tick;
    while (w.spawnPtr < schedule.length && schedule[w.spawnPtr].t <= t) {
      const e = schedule[w.spawnPtr]; w.queue.push({ uid: w.nextUid, query_id: e.q, bars: barsOf(e.q) }); w.nextUid++; w.spawnPtr++;
    }
    while (w.queue.length > CAP) { w.queue.shift(); w.total++; w.timeouts++; w.integrity -= TIMEOUT_PEN; }
    for (const a of ["refine", "hybrid", "web"] as RouterAction[]) {
      const ln = w.lanes[a];
      if (ln.busy && t - ln.start >= ln.latency) {
        const cell = grid.cells[ln.busy.query_id][a];
        w.total++; if (cell.correct) w.correct++; else { w.breaches++; w.integrity -= BREACH_PEN; }
        w.lanes[a] = { ...ln, busy: null, last: { ok: cell.correct, q: ln.busy.query_id } };
      }
    }
    if (auto && !w.lanes.refine.busy && w.queue.length) {
      const pkt = w.queue.shift()!;
      w.lanes.refine = { ...w.lanes.refine, busy: pkt, start: t, latency: LAT.refine };
    }
    if (w.selectedUid != null && !w.queue.some((p) => p.uid === w.selectedUid)) w.selectedUid = w.queue[0]?.uid ?? null;
    if (w.integrity <= 0) { w.integrity = 0; w.status = "lost"; }
    else if (w.spawnPtr >= schedule.length && w.queue.length === 0 && !w.lanes.refine.busy && !w.lanes.hybrid.busy && !w.lanes.web.busy) {
      w.status = w.total > 0 && w.correct / w.total >= winBar ? "won" : "lost";
    }
    return w;
  }

  function route(prev: World, action: RouterAction): World {
    if (prev.status !== "running" || prev.lanes[action].busy) return prev;
    const idx = prev.selectedUid != null ? prev.queue.findIndex((p) => p.uid === prev.selectedUid) : 0;
    if (idx < 0 || prev.queue.length === 0) return prev;
    const pkt = prev.queue[idx];
    const queue = prev.queue.filter((_, i) => i !== idx);
    return { ...prev, queue, selectedUid: queue[0]?.uid ?? null, lanes: { ...prev.lanes, [action]: { ...prev.lanes[action], busy: pkt, start: prev.tick, latency: LAT[action] } } };
  }

  useEffect(() => {
    if (w.status !== "running") return;
    const iv = window.setInterval(() => setW((cur) => advance(cur)), TICK_MS);
    return () => window.clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w.status]);

  const endedRef = useRef(false);
  useEffect(() => {
    if (w.status !== "running" && !endedRef.current) {
      endedRef.current = true;
      onEnd({ status: w.status, accuracy: w.total ? w.correct / w.total : 0, breaches: w.breaches, timeouts: w.timeouts });
    }
  }, [w.status, w.correct, w.total, w.breaches, w.timeouts, onEnd]);

  const doRoute = (a: RouterAction) => { if (!auto) setW((cur) => route(cur, a)); };
  const selectPkt = (p: Packet) => { if (auto) return; setW((cur) => ({ ...cur, selectedUid: p.uid })); onPeek(p.query_id); };

  return { world: w, doRoute, selectPkt, barsOf };
}
