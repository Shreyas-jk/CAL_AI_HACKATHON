"use client";
import { useMemo } from "react";

export interface PlotPoint { quality: number; speedup: number; }
export interface RunDot extends PlotPoint { trick: boolean; ok: boolean; }

export interface ParetoPlotProps {
  paper: PlotPoint;
  frontiers: { naive: PlotPoint[]; trick: PlotPoint[] };
  runs: RunDot[];
  current: { quality: number; speedup: number; bad: boolean };
  qualityFloor: number;
}

const W = 380, H = 280, PADL = 44, PADR = 16, PADT = 18, PADB = 34;

export default function ParetoPlot(p: ParetoPlotProps) {
  const dom = useMemo(() => {
    const pts = [p.paper, p.current, ...p.runs, ...p.frontiers.naive, ...p.frontiers.trick];
    const ss = pts.map((d) => d.speedup);
    const sMax = Math.max(2, ...ss) * 1.1;
    return { qMin: 0.4, qMax: 1.02, sMin: 0, sMax };
  }, [p]);

  const x = (q: number) =>
    PADL + ((Math.max(dom.qMin, Math.min(dom.qMax, q)) - dom.qMin) / (dom.qMax - dom.qMin)) * (W - PADL - PADR);
  const y = (s: number) =>
    PADT + (1 - (Math.max(dom.sMin, Math.min(dom.sMax, s)) - dom.sMin) / (dom.sMax - dom.sMin)) * (H - PADT - PADB);

  const path = (pts: PlotPoint[]) =>
    pts.map((d, i) => `${i ? "L" : "M"}${x(d.quality).toFixed(1)},${y(d.speedup).toFixed(1)}`).join(" ");

  const qTicks = [0.4, 0.6, 0.8, 1.0];
  const sStep = dom.sMax > 8 ? 4 : 2;
  const sTicks: number[] = [];
  for (let s = 0; s <= dom.sMax; s += sStep) sTicks.push(s);

  return (
    <svg width={W} height={H} className="rounded bg-ink/40 select-none">
      {/* grid + axes */}
      {qTicks.map((q) => (
        <g key={"q" + q}>
          <line x1={x(q)} y1={PADT} x2={x(q)} y2={H - PADB} stroke="#23243a" strokeWidth={1} />
          <text x={x(q)} y={H - PADB + 14} fontSize={9} fill="#6b7280" textAnchor="middle">{q.toFixed(1)}</text>
        </g>
      ))}
      {sTicks.map((s) => (
        <g key={"s" + s}>
          <line x1={PADL} y1={y(s)} x2={W - PADR} y2={y(s)} stroke="#23243a" strokeWidth={1} />
          <text x={PADL - 6} y={y(s) + 3} fontSize={9} fill="#6b7280" textAnchor="end">{s}x</text>
        </g>
      ))}
      <text x={(PADL + W) / 2} y={H - 4} fontSize={10} fill="#9ca3af" textAnchor="middle">quality →</text>
      <text x={12} y={PADT - 6} fontSize={10} fill="#9ca3af">speed ↑</text>

      {/* paper quality bar (the target you must not drop below) */}
      <line x1={x(p.qualityFloor)} y1={PADT} x2={x(p.qualityFloor)} y2={H - PADB}
        stroke="#f5b50066" strokeWidth={1} strokeDasharray="4 3" />

      {/* frontiers */}
      <path d={path(p.frontiers.naive)} fill="none" stroke="#f87171" strokeWidth={1.5} strokeOpacity={0.5} strokeDasharray="5 4" />
      <path d={path(p.frontiers.trick)} fill="none" stroke="#7c5cff" strokeWidth={2} />

      {/* logged runs */}
      {p.runs.map((d, i) => (
        <circle key={i} cx={x(d.quality)} cy={y(d.speedup)} r={3.2}
          fill={d.trick ? "#7c5cff" : "#f87171"} fillOpacity={0.7} />
      ))}

      {/* paper target — gold star */}
      <g transform={`translate(${x(p.paper.quality)},${y(p.paper.speedup)})`}>
        <Star r={9} fill="#f5b500" />
        <text x={11} y={4} fontSize={10} fill="#f5b500" fontWeight={600}>paper</text>
      </g>

      {/* live current marker */}
      <g transform={`translate(${x(p.current.quality)},${y(p.current.speedup)})`}>
        <circle r={7} fill="none" stroke={p.current.bad ? "#f87171" : "#34d399"} strokeWidth={2}>
          <animate attributeName="r" values="6;9;6" dur="1.4s" repeatCount="indefinite" />
        </circle>
        <circle r={3} fill={p.current.bad ? "#f87171" : "#34d399"} />
      </g>
    </svg>
  );
}

function Star({ r, fill }: { r: number; fill: string }) {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    pts.push(`${(Math.cos(a) * rad).toFixed(1)},${(Math.sin(a) * rad).toFixed(1)}`);
  }
  return <polygon points={pts.join(" ")} fill={fill} stroke="#1a1300" strokeWidth={0.5} />;
}
