"use client";
import { useMemo, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import GameFrame from "../GameFrame";
import ParetoPlot, { type PlotPoint, type RunDot } from "../efficiency/ParetoPlot";
import { type RaceOutcome } from "../efficiency/RaceTrack";
import type { PartId } from "../efficiency/GarageCar3D";
import { computeCost } from "@/lib/games/efficiency/cost";
import { computeQuality, maxCoverage } from "@/lib/games/efficiency/grid";
import type { Knob, Settings, TradeoffSpec } from "@/lib/games/efficiency/types";

// 3D scenes are client-only (WebGL Canvas can't SSR).
const Race3D = dynamic(() => import("../efficiency/Race3D"), { ssr: false,
  loading: () => <div className="h-[360px] grid place-items-center rounded-xl border border-edge bg-ink/60 text-sm text-gray-500">loading race…</div> });
const GarageCar3D = dynamic(() => import("../efficiency/GarageCar3D"), { ssr: false,
  loading: () => <div className="h-[340px] grid place-items-center rounded-xl border border-edge bg-ink/60 text-sm text-gray-500">loading garage…</div> });

// "Race the Paper" — Forza garage->race. Pick a part TECHNOLOGY (the best is what
// the opponent runs), then tune on top. The engine houses AWQ's insight: the best
// tech only wins if you probe & protect the salient channels. All numbers computed.

const WIN_SPEED_TOL = 0.98;
const WIN_QUALITY_TOL = 0.005;
const KV_OPTIONS = [1024, 2048, 4096, 8192];

type Mode = "garage" | "race" | "result";

function frontier(cfg: TradeoffSpec["config"], baseKv: number, coverage: number): PlotPoint[] {
  const precs = cfg.knobs.find((k) => k.id === "precisionBits")?.options ?? [16, 8, 4, 3, 2];
  const sparsities = cfg.tireCompounds.map((t) => t.sparsity);
  const pts: PlotPoint[] = [];
  for (const precisionBits of precs)
    for (const sparsity of sparsities) {
      const s: Settings = { precisionBits, sparsity, batchSize: 1, kvCacheTokens: baseKv };
      pts.push({ quality: computeQuality(s, coverage, cfg.quality), speedup: computeCost(s, cfg.model).speedup });
    }
  const nd = pts.filter((a) => !pts.some((b) => b !== a && b.quality >= a.quality && b.speedup >= a.speedup && (b.quality > a.quality || b.speedup > a.speedup)));
  return nd.sort((a, b) => a.quality - b.quality);
}

export default function Efficiency({ spec }: { spec: TradeoffSpec }) {
  const cfg = spec.config;
  const { knobs, model, quality: qmodel, engineTechs, tireCompounds, baseline, collapseFloor, qualityFloor } = cfg;
  const baseKv = baseline.kvCacheTokens;

  const bestEngine = useMemo(() => engineTechs.find((t) => t.best) ?? engineTechs[engineTechs.length - 1], [engineTechs]);
  const bestTire = useMemo(() => tireCompounds.find((t) => t.best) ?? tireCompounds[0], [tireCompounds]);
  const stockTireId = bestTire.id; // slicks (no pruning) is both the stock start and the best
  const precOptions = knobById(knobs, "precisionBits").options ?? [16, 8, 4, 3, 2];
  const batchOptions = knobById(knobs, "batchSize").options ?? [1];
  const paperB = spec.paperPoint.settings.batchSize, paperKv = spec.paperPoint.settings.kvCacheTokens;

  // ---- build state ----
  const [precisionBits, setPrecision] = useState(16);
  const [batchSize, setBatch] = useState(1);
  const [kvCacheTokens, setKv] = useState(1024);
  const [engineId, setEngineId] = useState("rtn");
  const [tireId, setTireId] = useState(stockTireId);
  const [selectedPart, setSelectedPart] = useState<PartId>("engine");
  const [mode, setMode] = useState<Mode>("garage");
  const [lastOutcome, setLastOutcome] = useState<RaceOutcome | null>(null);
  const [runs, setRuns] = useState<RunDot[]>([]);
  const [showTelemetry, setShowTelemetry] = useState(false);

  const engine = engineTechs.find((t) => t.id === engineId) ?? engineTechs[0];
  const tire = tireCompounds.find((t) => t.id === tireId) ?? tireCompounds[0];
  const sparsity = tire.sparsity;
  const usingBest = engineId === bestEngine.id;

  // ---- real numbers ----
  // Each engine tech applies a flat coverage of the salient channels (the best
  // tech, AWQ, recovers the most). No per-channel minigame.
  const coverage = useMemo(() => engine.coverage.mode === "none" ? 0 : (engine.coverage.value ?? 0), [engine]);

  const yourSpeed = useMemo(() => computeCost({ precisionBits, sparsity, batchSize: 1, kvCacheTokens: baseKv }, model).speedup, [precisionBits, sparsity, model, baseKv]);
  const quality = useMemo(() => computeQuality({ precisionBits, sparsity }, coverage, qmodel), [precisionBits, sparsity, coverage, qmodel]);
  const deploy = useMemo(() => computeCost({ precisionBits, sparsity, batchSize, kvCacheTokens }, model), [precisionBits, sparsity, batchSize, kvCacheTokens, model]);
  const paperSpeed = useMemo(() => computeCost({ ...spec.paperPoint.settings, batchSize: 1, kvCacheTokens: baseKv }, model).speedup, [spec.paperPoint, model, baseKv]);
  const paperQuality = spec.paperPoint.quality;
  const closeness = Math.max(0, Math.min(1, (quality - collapseFloor) / (paperQuality - collapseFloor)));

  const outcome: RaceOutcome = useMemo(() => {
    if (deploy.memoryWall) return "memwall";
    if (quality < collapseFloor) return "breakdown";
    if (quality < qualityFloor - WIN_QUALITY_TOL) return "unreliable";
    if (yourSpeed < paperSpeed * WIN_SPEED_TOL) return "slow";
    return "win";
  }, [deploy.memoryWall, quality, collapseFloor, qualityFloor, yourSpeed, paperSpeed]);

  const frontiers = useMemo(() => ({ naive: frontier(cfg, baseKv, 0), trick: frontier(cfg, baseKv, maxCoverage(qmodel)) }), [cfg, baseKv, qmodel]);
  const bestScore = useMemo(() => { const ok = runs.filter((r) => r.ok); return ok.length ? Math.max(...ok.map((r) => r.speedup)) : 0; }, [runs]);

  const bestFlags: Record<PartId, boolean> = {
    engine: engineId === bestEngine.id, tires: tireId === bestTire.id,
    trunk: batchSize === paperB, cooling: kvCacheTokens === paperKv,
  };

  // ---- actions ----
  const onToggleBest = (v: boolean) => { setEngineId(v ? bestEngine.id : "rtn"); setSelectedPart("engine"); setMode("garage"); };
  const onRaceDone = useCallback((o: RaceOutcome) => {
    setLastOutcome(o);
    setRuns((r) => [...r, { quality, speedup: yourSpeed, trick: usingBest, ok: o === "win" }]);
    setMode("result");
  }, [quality, yourSpeed, usingBest]);
  const reset = useCallback(() => {
    setPrecision(16); setBatch(1); setKv(1024); setEngineId("rtn"); setTireId(stockTireId);
    setSelectedPart("engine");
    setMode("garage"); setLastOutcome(null); setRuns([]); setShowTelemetry(false);
  }, [stockTireId]);

  const status: "idle" | "playing" | "won" | "lost" =
    mode === "result" && lastOutcome ? (lastOutcome === "win" ? "won" : "lost")
      : engineId !== "rtn" || precisionBits !== 16 || sparsity !== 0 ? "playing" : "idle";

  const qPct = Math.round(quality * 100);
  const coveragePct = Math.round(coverage * 100);
  const score = bestScore ? `best ${bestScore.toFixed(1)}x · paper ${paperSpeed.toFixed(1)}x` : `paper ${paperSpeed.toFixed(1)}x`;

  const resultReason = (o: RaceOutcome): string => {
    const you = `${yourSpeed.toFixed(1)}x @ ${qPct}%`, ghost = `${paperSpeed.toFixed(1)}x @ ${Math.round(paperQuality * 100)}%`;
    switch (o) {
      case "win": return `${you} — you held the test car's quality at 4-bit speed. That's ${bestEngine.name}.`;
      case "slow": return `Reliable (${qPct}%) but only ${yourSpeed.toFixed(1)}x — the test car (${ghost}) pulled away. Crush further: drop the bits.`;
      case "unreliable": return `${you} vs ${ghost} — ${closeness > 0.8 ? "finished just behind" : "well behind"}. Fast enough, but quality slipped. Only ${bestEngine.name} holds 4-bit quality — and skip the pruning.`;
      case "breakdown": return `Quality collapsed to ${qPct}% — the salient channels got crushed. ${usingBest ? "" : `Round-to-nearest can't survive 4-bit — switch to ${bestEngine.name}, the test car's engine.`}`;
      case "memwall": return `Batch / KV overran ${model.hardware.memoryGB} GB VRAM — the build can't run. Ease the trunk / cooling.`;
    }
  };

  return (
    <GameFrame
      goal="Match the test car: same speed, no breakdown."
      baselineLabel="Stock engine (RTN)"
      powerupLabel={`⭐ Best engine (${bestEngine.name.split(" ")[0]})`}
      claim={`Test car's build: ${bestEngine.name.split(" ")[0]} + protect salient + ${bestTire.name.split(" ")[0]} + 4-bit → ${spec.paperPoint.speedupReported}x @ ${Math.round(paperQuality * 100)}%.`}
      usePowerup={engineId === bestEngine.id}
      onToggle={onToggleBest}
      score={score}
      status={status}
      onReset={reset}
    >
      {/* ===================== GARAGE ===================== */}
      {mode === "garage" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-accent2">🔧 Garage — click a part on the car to tune it</h3>
            <span className="text-xs text-gray-500">★ = test car's choice</span>
          </div>

          {/* spec card */}
          <div className="rounded-xl border border-edge bg-ink/40 p-4 space-y-3">
            <div className="text-xs uppercase tracking-wide text-gray-500">Projected build</div>
            <Meter label="Top speed" value={`${yourSpeed.toFixed(1)}x`} fill={Math.min(1, yourSpeed / (paperSpeed * 1.5))} marker={1 / 1.5} markerLabel={`test car ${paperSpeed.toFixed(1)}x`} tint="bg-accent" />
            <Reliability quality={quality} collapseFloor={collapseFloor} paperQuality={paperQuality} qPct={qPct} />
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            {/* the clickable 3D car */}
            <GarageCar3D selected={selectedPart} onSelect={setSelectedPart} best={bestFlags} />

            {/* the part panel */}
            <div className="rounded-xl border border-edge bg-ink/40 p-4 space-y-3 min-h-[340px]">
              {/* ENGINE */}
              {selectedPart === "engine" && (
                <>
                  <PanelHead icon="🔩" title="Engine — weight quantization" best={`${bestEngine.name}`} />
                  <div className="space-y-2">
                    {engineTechs.map((t) => (
                      <OptionCard key={t.id} selected={engineId === t.id} best={!!t.best} title={t.name} blurb={t.blurb}
                        onSelect={() => setEngineId(t.id)} />
                    ))}
                  </div>
                  <Dial label="Tune · weight precision" unit="bits" options={precOptions} value={precisionBits} onChange={setPrecision} best={4} />
                  {usingBest && (
                    <p className="text-xs text-good">✓ {bestEngine.name} recovers {coveragePct}% of the salient quality automatically — near-lossless at 4-bit.</p>
                  )}
                </>
              )}

              {/* TIRES */}
              {selectedPart === "tires" && (
                <>
                  <PanelHead icon="🛞" title="Tires — pruning compound" best={bestTire.name} />
                  <p className="text-xs text-gray-500">Pruning sheds weight for speed but costs quality. The test car doesn&apos;t prune.</p>
                  <div className="space-y-2">
                    {tireCompounds.map((t) => (
                      <OptionCard key={t.id} selected={tireId === t.id} best={!!t.best} title={`${t.name}`} blurb={t.blurb} onSelect={() => setTireId(t.id)} />
                    ))}
                  </div>
                </>
              )}

              {/* TRUNK = batch */}
              {selectedPart === "trunk" && (
                <>
                  <PanelHead icon="🧳" title="Trunk — batch size" best={`${paperB} seq`} />
                  <p className="text-xs text-gray-500">Bigger batch = more throughput, but more VRAM. Never touches quality — overrun the wall and the build won&apos;t run.</p>
                  <Dial label="Batch size" unit="seq" options={batchOptions} value={batchSize} onChange={setBatch} best={paperB} />
                  <VramMeter deploy={deploy} cap={model.hardware.memoryGB} />
                </>
              )}

              {/* COOLING = kv cache */}
              {selectedPart === "cooling" && (
                <>
                  <PanelHead icon="❄️" title="Cooling — KV-cache length" best={`${paperKv} tok`} />
                  <p className="text-xs text-gray-500">Longer context = more KV memory. A memory lever, not a quality one — past the wall the build won&apos;t run.</p>
                  <Dial label="KV-cache length" unit="tok" options={KV_OPTIONS} value={kvCacheTokens} onChange={setKv} best={paperKv} />
                  <VramMeter deploy={deploy} cap={model.hardware.memoryGB} />
                </>
              )}
            </div>
          </div>

          <button onClick={() => setMode("race")} className="btn bg-accent/80 text-white w-full py-2.5 text-base font-semibold">🏁 Race the test car</button>
        </div>
      )}

      {/* ===================== RACE ===================== */}
      {mode === "race" && (
        <Race3D yourSpeed={yourSpeed} paperSpeed={paperSpeed} outcome={outcome} closeness={closeness}
          qualityPct={qPct} paperQualityPct={Math.round(paperQuality * 100)} onDone={onRaceDone} />
      )}

      {/* ===================== RESULT ===================== */}
      {mode === "result" && lastOutcome && (
        <div className="space-y-4">
          <div className={"rounded-xl border p-4 " + (lastOutcome === "win" ? "border-good bg-good/15" : "border-bad bg-bad/10")}>
            <div className={"font-bold text-lg " + (lastOutcome === "win" ? "text-good" : "text-bad")}>{TITLES[lastOutcome]}</div>
            <p className="text-sm text-gray-300 mt-1">{resultReason(lastOutcome)}</p>
            <div className="flex flex-wrap gap-2 mt-2 text-xs text-gray-400">
              <span className="tag">you {yourSpeed.toFixed(1)}x @ {qPct}%</span>
              <span className="tag">paper {paperSpeed.toFixed(1)}x @ {Math.round(paperQuality * 100)}%</span>
              <span className="tag">{engine.name.split(" ")[0]} · {tire.name.split(" ")[0]}{coverage > 0 ? ` · ${coveragePct}% covered` : ""}</span>
            </div>
          </div>

          {lastOutcome === "win" && (
            <div className="rounded-xl border-l-2 border-accent bg-ink/40 pl-3 py-2 text-sm text-gray-300">
              <span className="text-accent2 font-semibold">🏆 {spec.reveal.method} — </span>{spec.reveal.plainEnglish}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button onClick={() => setMode("garage")} className="btn bg-accent/80 text-white py-1.5 px-4 text-sm">🔧 Back to garage</button>
            <button onClick={() => setShowTelemetry((v) => !v)} className="btn-ghost py-1.5 px-4 text-sm">📊 {showTelemetry ? "Hide" : "Show"} telemetry</button>
          </div>

          {showTelemetry && (
            <div className="space-y-2 rounded-xl border border-edge bg-ink/30 p-3">
              <div className="text-xs uppercase tracking-wide text-gray-500">Telemetry · speed vs quality (Pareto)</div>
              <ParetoPlot paper={{ quality: paperQuality, speedup: paperSpeed }} frontiers={frontiers} runs={runs} current={{ quality, speedup: yourSpeed, bad: lastOutcome !== "win" }} qualityFloor={qualityFloor} />
              <p className="text-xs text-gray-500">The <span className="text-[#7c5cff]">AWQ frontier</span> sits outside the <span className="text-bad">uniform-crush</span> one — same speed, far better quality, only by protecting the right channels.</p>
            </div>
          )}
        </div>
      )}
    </GameFrame>
  );
}

// --------------------------------------------------------------------------- helpers

const TITLES: Record<RaceOutcome, string> = {
  win: "🏆 You kept pace with the test car!",
  slow: "🏁 The test car pulled away",
  unreliable: "💨 You sputtered out",
  breakdown: "💥 Engine blew on the straight",
  memwall: "🧱 Didn't make the grid",
};

function knobById(knobs: Knob[], id: Knob["id"]): Knob { return knobs.find((k) => k.id === id)!; }

function PanelHead({ icon, title, best }: { icon: string; title: string; best: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="font-semibold text-gray-100">{icon} {title}</span>
      <span className="tag text-[#f5b500]">★ test car: {best}</span>
    </div>
  );
}

function OptionCard({ selected, best, title, blurb, onSelect }: { selected: boolean; best: boolean; title: string; blurb: string; onSelect: () => void }) {
  return (
    <button onClick={onSelect}
      className={"w-full text-left rounded-lg border p-2.5 transition " + (selected ? "border-accent2 bg-accent2/10" : "border-edge bg-ink/40 hover:border-gray-500")}>
      <div className="flex items-center justify-between">
        <span className={"text-sm font-semibold " + (selected ? "text-accent2" : "text-gray-200")}>{title}</span>
        <span className="text-xs">{best && <span className="text-[#f5b500]">★ best</span>}{selected && <span className="text-good ml-1">✓</span>}</span>
      </div>
      <p className="text-[11px] leading-snug text-gray-500 mt-0.5">{blurb}</p>
    </button>
  );
}

function Dial({ label, unit, options, value, onChange, best }: { label: string; unit: string; options: number[]; value: number; onChange: (v: number) => void; best?: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm"><span className="text-gray-300">{label}</span><span className="tag">{value} {unit}</span></div>
      <div className="flex flex-wrap gap-1">
        {options.map((o) => (
          <button key={o} onClick={() => onChange(o)}
            className={"btn py-1 px-2 text-xs relative " + (value === o ? "bg-accent/80 text-white" : "border border-edge text-gray-400")}>
            {o}{best === o && <span className="absolute -top-1.5 -right-1 text-[8px] text-[#f5b500]">★</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

function VramMeter({ deploy, cap }: { deploy: { memoryUsedGB: number; memoryWall: boolean }; cap: number }) {
  return <Meter label="VRAM" value={`${deploy.memoryUsedGB.toFixed(1)} / ${cap} GB`} fill={Math.min(1, deploy.memoryUsedGB / cap)} marker={1} markerLabel="wall" tint={deploy.memoryWall ? "bg-bad" : "bg-accent2"} />;
}

function Meter({ label, value, fill, marker, markerLabel, tint }: { label: string; value: string; fill: number; marker: number; markerLabel: string; tint: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs"><span className="text-gray-400">{label}</span><span className="text-gray-200 font-mono">{value}</span></div>
      <div className="relative h-3 rounded bg-ink border border-edge overflow-hidden">
        <div className={`h-full ${tint}`} style={{ width: `${Math.max(0, Math.min(100, fill * 100))}%` }} />
        <div className="absolute top-0 h-full w-px bg-[#f5b500]" style={{ left: `${Math.min(100, marker * 100)}%` }} title={markerLabel} />
      </div>
      <div className="text-right text-[10px] text-[#f5b500]">▲ {markerLabel}</div>
    </div>
  );
}

function Reliability({ quality, collapseFloor, paperQuality, qPct }: { quality: number; collapseFloor: number; paperQuality: number; qPct: number }) {
  const reliable = quality >= paperQuality - WIN_QUALITY_TOL;
  const broken = quality < collapseFloor;
  const tint = broken ? "bg-bad" : reliable ? "bg-good" : "bg-amber-500";
  const word = broken ? "will break down" : reliable ? "race-ready" : "unreliable";
  const wordTint = broken ? "text-bad" : reliable ? "text-good" : "text-amber-500";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs"><span className="text-gray-400">Reliability (quality)</span><span className={wordTint + " font-semibold"}>{qPct}% · {word}</span></div>
      <div className="relative h-3 rounded bg-ink border border-edge overflow-hidden">
        <div className={`h-full ${tint}`} style={{ width: `${Math.max(0, Math.min(100, qPct))}%` }} />
        <div className="absolute top-0 h-full w-px bg-bad/80" style={{ left: `${collapseFloor * 100}%` }} title="breakdown floor" />
        <div className="absolute top-0 h-full w-px bg-[#f5b500]" style={{ left: `${paperQuality * 100}%` }} title="test car" />
      </div>
      <div className="flex justify-between text-[10px] text-gray-600"><span className="text-bad/80">break {Math.round(collapseFloor * 100)}%</span><span className="text-[#f5b500]">test car {Math.round(paperQuality * 100)}%</span></div>
    </div>
  );
}
