"use client";
import { useState } from "react";
import gridJson from "@/lib/games/rag/data/grid.json";
import corpusTextJson from "@/lib/games/rag/data/corpus_text.json";
import type { RagGrid } from "@/lib/games/rag/types";
import FactoryLine from "./FactoryLine";
import type { ScheduleEntry } from "@/lib/games/rag/useRealtimeGame";
import EvaluatorAxis from "./EvaluatorAxis";
import QueryInspector from "./QueryInspector";

const grid = gridJson as unknown as RagGrid;
const corpusText = corpusTextJson as Record<string, string>;
const ALWAYS_WEB_COST = grid.queries.length * grid.meta.cost.web;
const WIN_BAR = 0.75;

// short auto-demo: naive sends everything to INTERNAL; gaps (q08/q09/q10) breach
const INTRO: ScheduleEntry[] = [[2, "q01"], [5, "q08"], [8, "q02"], [11, "q09"], [14, "q03"], [17, "q10"], [20, "q04"]].map(([t, q]) => ({ t: t as number, q: q as string }));

// Act 1 — ramp + gap bursts (validated: smart wins ~93%, all-internal loses to breaches,
// all-web loses to congestion). gaps q08-13, hopeless q18, amb q14/q16/q17, easy q01-07/q15.
const ACT1: ScheduleEntry[] = [
  [3, "q01"], [7, "q08"], [11, "q02"], [15, "q09"], [19, "q03"],
  [22, "q10"], [24, "q11"], [25, "q12"], [27, "q04"], [28, "q13"], [30, "q14"],
  [32, "q05"], [34, "q17"], [36, "q08"],
  [38, "q09"], [39, "q10"], [41, "q11"], [42, "q06"], [43, "q12"], [45, "q13"], [46, "q16"], [48, "q08"], [49, "q09"], [51, "q18"], [52, "q10"], [54, "q07"], [56, "q11"], [58, "q12"], [60, "q15"], [62, "q13"],
].map(([t, q]) => ({ t: t as number, q: q as string }));

type Phase = "intro" | "act1" | "summary" | "act2";
type WaveResult = { status: "won" | "lost"; accuracy: number; breaches: number; timeouts: number };

export default function RagGame() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<WaveResult | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [act2Won, setAct2Won] = useState<{ acc: number; cost: number } | null>(null);

  const selectedQuery = grid.queries.find((q) => q.query_id === selectedId) ?? null;
  const retry = () => { setResult(null); setSelectedId(null); setAttempt((a) => a + 1); setPhase("act1"); };

  return (
    <div className="space-y-5">
      <PipelineStrip routerOn={phase !== "intro"} mode={phase === "act2" ? "auto" : phase === "intro" ? "naive" : "manual"} />

      {/* INTRO — naive is fast but breaches gaps */}
      {phase === "intro" && (
        <div className="space-y-3">
          <div className="rounded-xl border border-edge bg-ink/40 p-3">
            <h3 className="font-semibold text-accent2">Naive RAG is fast, but trusts whatever retrieval returns</h3>
            <p className="text-sm text-gray-400">It auto-routes every packet down the fast INTERNAL lane. Watch the low-signal gap queries breach (red) — naive can&apos;t tell good retrieval from bad.</p>
          </div>
          <FactoryLine key="intro" grid={grid} schedule={INTRO} auto winBar={0} onPeek={setSelectedId} onEnd={() => {}} />
          <button onClick={() => { setSelectedId(null); setPhase("act1"); }} className="btn bg-accent/80 text-white py-2 px-4 text-sm font-semibold">🎮 Take control →</button>
        </div>
      )}

      {/* ACT 1 — real-time triage */}
      {phase === "act1" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-accent2">Act 1 — keep the base alive</h3>
            <span className="text-xs text-gray-500">route each packet · slow lanes correct gaps but bottleneck · survive ≥{Math.round(WIN_BAR * 100)}%</span>
          </div>
          <FactoryLine key={attempt} grid={grid} schedule={ACT1} auto={false} winBar={WIN_BAR}
            onPeek={setSelectedId} onEnd={(r) => { setResult(r); setSelectedId(null); setPhase("summary"); }} />
          <p className="text-center text-[11px] text-gray-600">Coarse 3-bar cue triages fast; 🔍 peek (click a packet) reveals the real retrieved docs. The clock keeps running while you read.</p>
        </div>
      )}

      {/* SUMMARY */}
      {phase === "summary" && result && (
        <div className={"rounded-xl border p-4 space-y-2 " + (result.status === "won" ? "border-good bg-good/15" : "border-bad bg-bad/10")}>
          <div className={"font-bold text-lg " + (result.status === "won" ? "text-good" : "text-bad")}>
            {result.status === "won" ? "🛡 Base held!" : "💥 Wave lost"} — {Math.round(result.accuracy * 100)}% accuracy · {result.breaches} breaches · {result.timeouts} timed out
          </div>
          <p className="text-sm text-gray-300">
            {result.status === "won"
              ? "You triaged: gaps to the corrective lanes, easy queries to fast internal, and you didn't web-search everything (that congests). That's CRAG's instinct."
              : result.timeouts >= result.breaches
                ? "Congestion — the slow corrective lanes (web/hybrid) backed up and packets timed out. You can't correct everything; triage harder and don't over-use WEB (it's slow)."
                : "Breaches — too many low-signal gap queries went down fast INTERNAL and answered from off-topic docs. Send those to a corrective lane."}
          </p>
          <div className="flex flex-wrap gap-2">
            <button onClick={retry} className="btn-ghost py-1.5 px-4 text-sm">↻ Retry wave</button>
            <button onClick={() => setPhase("act2")} className="btn bg-accent/80 text-white py-1.5 px-4 text-sm">🛠 Build the evaluator →</button>
          </div>
        </div>
      )}

      {/* ACT 2 — earn the evaluator */}
      {phase === "act2" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-accent2">Act 2 — automate it: build the evaluator</h3>
            <button onClick={() => setPhase("act1")} className="btn-ghost py-1 px-2 text-xs">← back to manual</button>
          </div>
          <p className="text-sm text-gray-400">Encode the triage you just did under pressure as ONE policy: a threshold on retrieval quality that auto-routes the whole pool hands-free.</p>
          <EvaluatorAxis queries={grid.queries} grid={grid} onSelect={setSelectedId} onWin={(acc, cost) => setAct2Won({ acc, cost })} />
          {act2Won && (
            <div className="rounded-xl border border-good bg-good/15 p-4 space-y-2">
              <div className="text-good font-bold text-lg">🏆 That&apos;s Corrective RAG.</div>
              <p className="text-sm text-gray-200">
                You routed by retrieval quality under pressure, then automated it into a single evaluator. That evaluator — judge the retrieval, send only the bad ones down a corrective path — <span className="text-accent2 font-semibold">is exactly CRAG&apos;s contribution</span>. Naive RAG has no such judge, so it answers from bad context and breaches.
              </p>
              <p className="text-sm text-gray-300">You only pay the slow correction when retrieval actually fails: <span className="font-mono text-good">{act2Won.cost}</span> vs <span className="font-mono text-bad">{ALWAYS_WEB_COST}</span> if you web-searched everything — and you avoid the latency that congested you. Routing by quality is the whole saving.</p>
            </div>
          )}
        </div>
      )}

      {/* inspector — peek, reused everywhere */}
      {selectedQuery && (
        <QueryInspector query={selectedQuery} grid={grid} corpusText={corpusText} action="naive" onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}

function PipelineStrip({ routerOn, mode }: { routerOn: boolean; mode: "naive" | "manual" | "auto" }) {
  const sub = mode === "naive" ? "off (naive → internal)" : mode === "auto" ? "auto (evaluator)" : "you route in real time";
  const nodes = [
    { label: "query", sub: "" }, { label: "retrieve", sub: "top-k" },
    { label: "ROUTER", sub, router: true },
    { label: "{internal · hybrid · web}", sub: "lanes have latency" }, { label: "answer", sub: "" },
  ];
  return (
    <div className="flex items-stretch gap-1 overflow-x-auto rounded-xl border border-edge bg-ink/40 p-2">
      {nodes.map((n, i) => (
        <div key={i} className="flex items-center gap-1">
          <div className={"rounded-lg px-3 py-2 text-center " + (n.router ? (routerOn ? "border-2 border-accent2 bg-accent2/15" : "border-2 border-dashed border-gray-600 bg-ink/40") : "border border-edge bg-ink/40")}>
            <div className={"text-xs font-semibold " + (n.router ? "text-accent2" : "text-gray-200")}>{n.router ? "⚙ " : ""}{n.label}</div>
            {n.sub && <div className="text-[10px] text-gray-500">{n.sub}</div>}
          </div>
          {i < nodes.length - 1 && <span className="text-gray-600">→</span>}
        </div>
      ))}
    </div>
  );
}
