"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { RagGrid, RagQuery } from "@/lib/games/rag/types";

const H = 170, BASE = 122, ROW = 20, MIN_GAP = 0.034;

export default function EvaluatorAxis({ queries, grid, onWin, onSelect }: {
  queries: RagQuery[]; grid: RagGrid; onWin: (acc: number, cost: number) => void; onSelect: (id: string) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [T, setT] = useState(0.4);
  const [drag, setDrag] = useState(false);
  const cost = grid.meta.cost, budget = grid.meta.budget;

  // below T -> HYBRID (corrective, includes web); at/above T -> INTERNAL (refine)
  const eval_ = useMemo(() => {
    let correct = 0, total = 0, c = 0;
    const per: Record<string, boolean> = {};
    for (const q of queries) {
      const action = q.quality_signal < T ? "hybrid" : "refine";
      const cell = grid.cells[q.query_id][action];
      per[q.query_id] = cell.correct; if (cell.correct) correct++; c += cell.cost; total++;
    }
    const acc = total ? correct / total : 0;
    return { per, correct, total, cost: c, acc, won: acc >= 0.9 && c <= budget };
  }, [queries, grid, T, budget]);

  const wonRef = useRef(false);
  useEffect(() => {
    if (eval_.won && !wonRef.current) { wonRef.current = true; onWin(Math.round(eval_.acc * 100), eval_.cost); }
    if (!eval_.won) wonRef.current = false;
  }, [eval_.won, eval_.acc, eval_.cost, onWin]);

  const layout = useMemo(() => {
    const sorted = [...queries].sort((a, b) => a.quality_signal - b.quality_signal);
    const lastX: number[] = []; const pos: Record<string, { x: number; row: number }> = {};
    for (const q of sorted) { const x = q.quality_signal; let r = 0; while (r < lastX.length && x - lastX[r] < MIN_GAP) r++; lastX[r] = x; pos[q.query_id] = { x, row: r }; }
    return pos;
  }, [queries]);

  const onMove = (e: ReactPointerEvent) => {
    if (!drag) return;
    const r = trackRef.current!.getBoundingClientRect();
    setT(Math.max(0.05, Math.min(0.95, (e.clientX - r.left) / r.width)));
  };

  return (
    <div className="space-y-2 select-none">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Auto accuracy" value={`${Math.round(eval_.acc * 100)}%`} sub={`${eval_.correct}/${eval_.total}`} tint={eval_.acc >= 0.9 ? "text-good" : "text-bad"} />
        <Stat label="Auto cost" value={`${eval_.cost}`} sub={`budget ${budget}`} tint={eval_.cost <= budget ? "text-good" : "text-bad"} />
        <Stat label="Evaluator" value={eval_.won ? "✅ clears it" : "tune me"} sub={`threshold ${T.toFixed(2)}`} tint={eval_.won ? "text-good" : "text-amber-500"} />
      </div>

      <div ref={trackRef} className="relative w-full rounded-lg border border-edge bg-ink/50" style={{ height: H, touchAction: "none" }}
        onPointerMove={onMove} onPointerUp={() => setDrag(false)} onPointerLeave={() => setDrag(false)}>
        {/* zones */}
        <div className="absolute top-0 bottom-0 left-0 flex items-start justify-center" style={{ width: `${T * 100}%`, background: "rgba(245,181,0,0.12)" }}>
          <div className="mt-1 text-center text-[10px] font-semibold uppercase tracking-wide text-amber-500">corrective (hybrid)<div className="text-[9px] font-normal normal-case text-gray-500">cost {cost.hybrid}</div></div>
        </div>
        <div className="absolute top-0 bottom-0 right-0 flex items-start justify-center" style={{ width: `${(1 - T) * 100}%`, background: "rgba(52,211,153,0.12)" }}>
          <div className="mt-1 text-center text-[10px] font-semibold uppercase tracking-wide text-good">internal (refine)<div className="text-[9px] font-normal normal-case text-gray-500">cost {cost.refine}</div></div>
        </div>

        {/* dots */}
        {queries.map((q) => {
          const { x, row } = layout[q.query_id];
          const ok = eval_.per[q.query_id];
          return <button key={q.query_id} title={`${q.query_id} · ${q.quality_signal.toFixed(2)}`} onClick={() => onSelect(q.query_id)}
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${x * 100}%`, top: BASE - row * ROW, width: 13, height: 13, background: ok ? "#34d399" : "#f87171", border: "1px solid rgba(0,0,0,0.4)" }} />;
        })}

        {/* single handle */}
        <div onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); setDrag(true); }}
          className="absolute top-0 bottom-0 z-10 flex cursor-ew-resize items-center justify-center" style={{ left: `calc(${T * 100}% - 9px)`, width: 18 }}>
          <div className="h-full w-0.5 bg-accent2" />
          <div className="absolute -bottom-0.5 rounded bg-accent2 px-1 py-0.5 text-[9px] font-mono text-ink">{T.toFixed(2)}</div>
        </div>
      </div>
      <p className="text-center text-[11px] text-gray-500">Drag the one threshold so bad-retrieval packets auto-route to the corrective path and good ones stay cheap. This is the evaluator you were running by hand.</p>
    </div>
  );
}

function Stat({ label, value, sub, tint }: { label: string; value: string; sub: string; tint: string }) {
  return (
    <div className="rounded-xl border border-edge bg-ink/40 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`font-mono text-lg font-bold ${tint}`}>{value}</div>
      <div className="text-[10px] text-gray-500">{sub}</div>
    </div>
  );
}
