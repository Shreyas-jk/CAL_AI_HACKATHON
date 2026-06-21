"use client";
import type { RagAction, RagGrid, RagQuery } from "@/lib/games/rag/types";

const ACTION_LABEL: Record<RagAction, string> = { naive: "Naive (raw top-k)", refine: "Internal (refine)", web: "Web fallback", hybrid: "Hybrid (internal + web)" };

export default function QueryInspector({ query, grid, corpusText, action, onClose }: {
  query: RagQuery; grid: RagGrid; corpusText: Record<string, string>; action: RagAction; onClose: () => void;
}) {
  const naive = grid.cells[query.query_id].naive; // raw retrieval (what top-k returned)
  const cell = grid.cells[query.query_id][action]; // the action actually run on this query
  const sig = query.quality_signal;
  const band = sig < 0.35 ? { label: "LOW", tint: "text-bad", note: "retrieval failed — the top docs are off-topic" }
    : sig < 0.58 ? { label: "MEDIUM", tint: "text-amber-500", note: "shaky retrieval — partial coverage" }
    : { label: "HIGH", tint: "text-good", note: "strong retrieval — the answer is in the corpus" };

  return (
    <div className="rounded-xl border border-accent2/50 bg-ink/70 p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs text-gray-500">{query.query_id} · inspector</div>
          <div className="font-semibold text-gray-100">{query.text}</div>
        </div>
        <button onClick={onClose} className="btn-ghost py-1 px-2 text-xs">✕ close</button>
      </div>

      {/* signal verdict */}
      <div className="rounded-lg border border-edge bg-ink/50 p-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">retrieval quality signal</span>
          <span className={`font-mono font-bold ${band.tint}`}>{sig.toFixed(2)} · {band.label}</span>
        </div>
        <div className="mt-1 h-2 rounded bg-ink border border-edge overflow-hidden">
          <div className={band.label === "LOW" ? "bg-bad h-full" : band.label === "MEDIUM" ? "bg-amber-500 h-full" : "bg-good h-full"} style={{ width: `${sig * 100}%` }} />
        </div>
        <p className="mt-1 text-xs text-gray-500">{band.note}</p>
      </div>

      {/* the real retrieved docs */}
      <div>
        <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">What retrieval returned (top-{naive.retrieved.length})</div>
        <div className="space-y-1">
          {naive.retrieved.map((id, i) => (
            <div key={id} className="rounded border border-edge bg-ink/40 px-2 py-1.5 text-xs text-gray-400">
              <span className="text-gray-600 mr-1">#{i + 1} {id}</span>
              {corpusText[id] ? corpusText[id].slice(0, 160) + (corpusText[id].length > 160 ? "…" : "") : "(missing text)"}
            </div>
          ))}
          {naive.retrieved.length === 0 && <div className="text-xs text-gray-600">— no internal docs used —</div>}
        </div>
      </div>

      {/* outcome under the action this query is currently routed to */}
      <div className={`rounded-lg border p-3 ${cell.correct ? "border-good bg-good/10" : "border-bad bg-bad/10"}`}>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">routed to <span className="text-accent2 font-semibold">{ACTION_LABEL[action]}</span> (cost {cell.cost})</span>
          <span className={cell.correct ? "text-good font-semibold" : "text-bad font-semibold"}>{cell.correct ? "✓ correct" : "✗ breach"}</span>
        </div>
        <div className="mt-1 text-sm"><span className="text-gray-500">answer produced: </span><span className="font-mono text-gray-200">{cell.answer || "—"}</span></div>
        <div className="text-sm"><span className="text-gray-500">expected: </span><span className="font-mono text-gray-300">{query.gold_answer}</span></div>
      </div>
    </div>
  );
}
