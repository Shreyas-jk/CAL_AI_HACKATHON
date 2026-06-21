"use client";
import { useMemo, useState, useCallback } from "react";
import GameFrame from "./GameFrame";
import type { PaperArtifact } from "@/lib/types";
import type { GameSpec, VizSpec, ControlValues } from "@/lib/gameSpec";
import { isValidGameSpec } from "@/lib/gameSpec";
import { interpolateSeries, simulateSampling } from "@/lib/games/dynamic/simulations";
import GameVisualWrapper from "./primitives/GameVisualWrapper";
import CurveChart from "./primitives/CurveChart";
import ComparisonBars from "./primitives/ComparisonBars";
import PipelineViz from "./primitives/PipelineViz";
import SamplingViz from "./primitives/SamplingViz";
import TokenSequence from "./primitives/TokenSequence";
import InteractiveGrid from "./primitives/InteractiveGrid";
import ControlPanel from "./primitives/ControlPanel";

function initDefaults(controls: GameSpec["controls"]): ControlValues {
  const out: ControlValues = {};
  for (const c of controls) {
    out[c.id] = c.default;
  }
  return out;
}

function computeScore(
  spec: GameSpec,
  controlValues: ControlValues,
  usePowerup: boolean,
): { score: string; status: "idle" | "playing" | "won" | "lost" } {
  const scoring = spec.scoring;
  let metricValue = 0;

  if (spec.viz.vizType === "curve-chart" && spec.viz.interactiveParam) {
    const viz = spec.viz;
    const x = Number(controlValues[viz.interactiveParam!] ?? 0);
    const series = viz.series;
    const activeSeries = usePowerup
      ? series.filter((s) => !viz.baselineSeries || viz.powerupSeries?.includes(s.id))
      : series;
    if (activeSeries.length > 0) {
      metricValue = interpolateSeries(activeSeries[0].points, x);
    }
  } else if (spec.viz.vizType === "sampling") {
    const count = Number(controlValues.sampleCount ?? (usePowerup ? 8 : 1));
    const voting = String(controlValues.voting ?? (usePowerup ? "weighted" : "none"));
    const result = simulateSampling(
      spec.viz.accuracyDistribution, count, voting, spec.viz.verifierAccuracy, 42,
    );
    metricValue = result.finalAccuracy;
  } else if (spec.viz.vizType === "comparison-bars") {
    const m = spec.viz.metrics[0];
    metricValue = usePowerup ? m.powerupValue : m.baselineValue;
  } else if (spec.viz.vizType === "pipeline") {
    const enabled = new Set<string>();
    for (const stage of spec.viz.stages) {
      if (!stage.toggleable) { enabled.add(stage.id); continue; }
      const val = controlValues[stage.id];
      const on = val != null ? Boolean(val) : (usePowerup ? stage.default : false);
      if (on) enabled.add(stage.id);
    }
    let acc = spec.viz.baselineAccuracy;
    for (const stage of spec.viz.stages) {
      if (enabled.has(stage.id)) acc += stage.effect.accuracyDelta;
    }
    metricValue = Math.min(1, Math.max(0, acc));
  }

  const won = scoring.direction === "higher"
    ? metricValue >= scoring.target
    : metricValue <= scoring.target;

  if (!usePowerup) {
    return { score: `${scoring.metric}: ${metricValue.toFixed(2)}`, status: "idle" };
  }

  return {
    score: `${scoring.metric}: ${metricValue.toFixed(2)}`,
    status: won ? "won" : "lost",
  };
}

function VizRenderer({
  viz,
  controlValues,
  usePowerup,
}: {
  viz: VizSpec;
  controlValues: ControlValues;
  usePowerup: boolean;
}) {
  switch (viz.vizType) {
    case "curve-chart":
      return <CurveChart spec={viz} controlValues={controlValues} usePowerup={usePowerup} />;
    case "pipeline":
      return <PipelineViz spec={viz} controlValues={controlValues} usePowerup={usePowerup} />;
    case "sampling":
      return <SamplingViz spec={viz} controlValues={controlValues} usePowerup={usePowerup} />;
    case "comparison-bars":
      return <ComparisonBars spec={viz} usePowerup={usePowerup} />;
    case "token-sequence":
      return <TokenSequence spec={viz} usePowerup={usePowerup} />;
    case "interactive-grid":
      return <InteractiveGrid spec={viz} controlValues={controlValues} usePowerup={usePowerup} />;
    default:
      return <div className="text-sm text-gray-400">Unknown visualization type.</div>;
  }
}

export default function DynamicGame({ game }: { game: PaperArtifact["game"] }) {
  const spec = game.content as GameSpec | undefined;
  if (!spec || !isValidGameSpec(spec as unknown as Record<string, unknown>)) return null;

  const [usePowerup, setUsePowerup] = useState(false);
  const [controlValues, setControlValues] = useState<ControlValues>(
    () => initDefaults(spec.controls),
  );

  const { score, status } = useMemo(
    () => computeScore(spec, controlValues, usePowerup),
    [spec, controlValues, usePowerup],
  );

  const reset = useCallback(() => {
    setControlValues(initDefaults(spec.controls));
    setUsePowerup(false);
  }, [spec]);

  return (
    <GameVisualWrapper status={status}>
      <GameFrame
        goal={spec.goal}
        baselineLabel={spec.baselineLabel}
        powerupLabel={spec.powerupLabel}
        claim={spec.claim}
        usePowerup={usePowerup}
        onToggle={setUsePowerup}
        score={score}
        status={status}
        onReset={reset}
      >
        <div className="space-y-4">
          {spec.insight && (
            <p className="text-xs text-accent2 italic">{spec.insight}</p>
          )}

          <VizRenderer
            viz={spec.viz}
            controlValues={controlValues}
            usePowerup={usePowerup}
          />

          {spec.secondaryViz && (
            <VizRenderer
              viz={spec.secondaryViz}
              controlValues={controlValues}
              usePowerup={usePowerup}
            />
          )}

          <ControlPanel
            controls={spec.controls}
            values={controlValues}
            onChange={setControlValues}
          />
        </div>
      </GameFrame>
    </GameVisualWrapper>
  );
}
