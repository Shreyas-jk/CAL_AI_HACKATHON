// ---- Controls (player-adjustable parameters) ----

export interface SliderControl {
  type: "slider";
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
  unit?: string;
}

export interface ToggleControl {
  type: "toggle";
  id: string;
  label: string;
  default: boolean;
}

export interface SelectorControl {
  type: "selector";
  id: string;
  label: string;
  options: { value: string; label: string }[];
  default: string;
}

export type GameControl = SliderControl | ToggleControl | SelectorControl;

export type ControlValues = Record<string, number | boolean | string>;

// ---- Data types for visualizations ----

export interface DataPoint {
  x: number;
  y: number;
}

export interface DataSeries {
  id: string;
  label: string;
  color: string;
  points: DataPoint[];
  dashed?: boolean;
}

export interface ThresholdLine {
  axis: "x" | "y";
  value: number;
  label: string;
  color: string;
}

// ---- Viz-specific specs (discriminated union on vizType) ----

export interface CurveChartSpec {
  vizType: "curve-chart";
  title: string;
  xLabel: string;
  yLabel: string;
  series: DataSeries[];
  thresholds?: ThresholdLine[];
  interactiveParam?: string;
  baselineSeries?: string[];
  powerupSeries?: string[];
}

export interface PipelineStage {
  id: string;
  label: string;
  description: string;
  toggleable: boolean;
  default: boolean;
  effect: {
    accuracyDelta: number;
    latencyMs: number;
  };
}

export interface PipelineItem {
  id: string;
  label: string;
  correctOutput: string;
  difficulty: number;
}

export interface PipelineVizSpec {
  vizType: "pipeline";
  stages: PipelineStage[];
  inputItems: PipelineItem[];
  baselineAccuracy: number;
}

export interface SamplingVizSpec {
  vizType: "sampling";
  problemLabel: string;
  accuracyDistribution: number[];
  votingMethods: string[];
  verifierAccuracy: number;
  targetAccuracy: number;
}

export interface ComparisonMetric {
  id: string;
  label: string;
  baselineValue: number;
  powerupValue: number;
  max: number;
  unit: string;
  higherIsBetter: boolean;
}

export interface ComparisonBarsSpec {
  vizType: "comparison-bars";
  metrics: ComparisonMetric[];
}

export interface TokenSequenceEntry {
  tokens: string[];
  weights: number[];
  correctIndex: number;
  explanation: string;
}

export interface TokenSequenceSpec {
  vizType: "token-sequence";
  sequences: TokenSequenceEntry[];
}

export interface InteractiveGridSpec {
  vizType: "interactive-grid";
  rows: number;
  cols: number;
  cellStates: Record<string, string>;
  initialGrid: string[][];
  agentStart: [number, number];
  goalCell: [number, number];
  searchBudget: number;
}

export type VizSpec =
  | CurveChartSpec
  | PipelineVizSpec
  | SamplingVizSpec
  | ComparisonBarsSpec
  | TokenSequenceSpec
  | InteractiveGridSpec;

// ---- Top-level GameSpec ----

export interface GameSpec {
  version: 1;
  insight: string;
  goal: string;
  baselineLabel: string;
  powerupLabel: string;
  claim: string;
  viz: VizSpec;
  secondaryViz?: VizSpec;
  controls: GameControl[];
  scoring: {
    metric: string;
    target: number;
    direction: "higher" | "lower";
    winMessage: string;
    loseMessage: string;
  };
}

// ---- Runtime validator ----

const VALID_VIZ_TYPES = [
  "curve-chart",
  "pipeline",
  "sampling",
  "comparison-bars",
  "token-sequence",
  "interactive-grid",
] as const;

export function isValidGameSpec(
  content: Record<string, unknown>,
): boolean {
  if (content.version !== 1) return false;
  const viz = content.viz as Record<string, unknown> | undefined;
  if (!viz || typeof viz.vizType !== "string") return false;
  if (!(VALID_VIZ_TYPES as readonly string[]).includes(viz.vizType))
    return false;
  if (typeof content.goal !== "string") return false;
  if (typeof content.insight !== "string") return false;
  if (!Array.isArray(content.controls)) return false;
  if (!content.scoring || typeof content.scoring !== "object") return false;
  return true;
}
