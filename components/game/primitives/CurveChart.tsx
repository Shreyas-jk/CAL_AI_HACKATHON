"use client";
import { useMemo } from "react";
import type { CurveChartSpec, ControlValues } from "@/lib/gameSpec";
import { interpolateSeries } from "@/lib/games/dynamic/simulations";

const W = 460;
const H = 220;
const PAD = { top: 20, right: 20, bottom: 32, left: 48 };
const PW = W - PAD.left - PAD.right;
const PH = H - PAD.top - PAD.bottom;

const STYLES = `
@keyframes cc-trace {
  from { stroke-dashoffset: 1000; }
  to { stroke-dashoffset: 0; }
}
@keyframes cc-dot-pulse {
  0%, 100% { r: 4; opacity: 1; }
  50% { r: 6; opacity: 0.8; }
}
`;

interface Props {
  spec: CurveChartSpec;
  controlValues: ControlValues;
  usePowerup: boolean;
}

function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return "";
  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpx = (prev.x + curr.x) / 2;
    d += ` C${cpx},${prev.y} ${cpx},${curr.y} ${curr.x},${curr.y}`;
  }
  return d;
}

export default function CurveChart({ spec, controlValues, usePowerup }: Props) {
  const { xRange, yRange } = useMemo(() => {
    let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
    for (const s of spec.series) {
      for (const p of s.points) {
        if (p.x < xMin) xMin = p.x;
        if (p.x > xMax) xMax = p.x;
        if (p.y < yMin) yMin = p.y;
        if (p.y > yMax) yMax = p.y;
      }
    }
    if (yMin > 0) yMin = 0;
    return { xRange: [xMin, xMax] as const, yRange: [yMin, yMax * 1.1] as const };
  }, [spec.series]);

  const toX = (v: number) => PAD.left + ((v - xRange[0]) / (xRange[1] - xRange[0] || 1)) * PW;
  const toY = (v: number) => PAD.top + PH - ((v - yRange[0]) / (yRange[1] - yRange[0] || 1)) * PH;

  const visibleSeries = useMemo(() => {
    if (!spec.baselineSeries && !spec.powerupSeries) return spec.series;
    const ids = usePowerup ? spec.powerupSeries : spec.baselineSeries;
    if (!ids) return spec.series;
    return spec.series.filter((s) => ids.includes(s.id));
  }, [spec, usePowerup]);

  const cursorX = spec.interactiveParam && controlValues[spec.interactiveParam] != null
    ? Number(controlValues[spec.interactiveParam])
    : null;

  const cursorValues = useMemo(() => {
    if (cursorX == null) return [];
    return visibleSeries.map((s) => ({
      id: s.id,
      label: s.label,
      color: s.color,
      value: interpolateSeries(s.points, cursorX),
    }));
  }, [cursorX, visibleSeries]);

  return (
    <>
      <style>{STYLES}</style>
      <div className="space-y-2">
        {spec.title && (
          <div className="text-xs font-semibold text-gray-400 tracking-wide uppercase">{spec.title}</div>
        )}
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-xl bg-[#080a14] border border-white/5">
          <defs>
            {visibleSeries.map((s) => (
              <linearGradient key={`grad-${s.id}`} id={`grad-${s.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
              </linearGradient>
            ))}
            {visibleSeries.map((s) => (
              <filter key={`glow-${s.id}`} id={`glow-${s.id}`}>
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            ))}
            <filter id="cursor-glow">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Y axis */}
          <text x={14} y={H / 2} textAnchor="middle" fontSize={9} fill="#4b5563"
            transform={`rotate(-90, 14, ${H / 2})`}>
            {spec.yLabel}
          </text>
          {/* X axis */}
          <text x={W / 2} y={H - 6} textAnchor="middle" fontSize={9} fill="#4b5563">
            {spec.xLabel}
          </text>

          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
            const y = PAD.top + PH * (1 - frac);
            const val = yRange[0] + frac * (yRange[1] - yRange[0]);
            return (
              <g key={frac}>
                <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#ffffff06" />
                <text x={PAD.left - 6} y={y + 3} textAnchor="end" fontSize={8} fill="#374151">
                  {val < 10 ? val.toFixed(1) : Math.round(val)}
                </text>
              </g>
            );
          })}

          {/* Thresholds */}
          {spec.thresholds?.map((t, i) => {
            if (t.axis === "y") {
              const y = toY(t.value);
              return (
                <g key={`t${i}`}>
                  <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
                    stroke={t.color} strokeWidth={1} strokeDasharray="6 4" opacity={0.6} />
                  <text x={W - PAD.right - 4} y={y - 5} textAnchor="end" fontSize={8} fill={t.color}>{t.label}</text>
                </g>
              );
            }
            const x = toX(t.value);
            return (
              <g key={`t${i}`}>
                <line x1={x} y1={PAD.top} x2={x} y2={H - PAD.bottom}
                  stroke={t.color} strokeWidth={1} strokeDasharray="6 4" opacity={0.6} />
                <text x={x + 4} y={PAD.top + 12} fontSize={8} fill={t.color}>{t.label}</text>
              </g>
            );
          })}

          {/* Gradient fill areas under curves */}
          {visibleSeries.map((s) => {
            const sorted = [...s.points].sort((a, b) => a.x - b.x);
            const pts = sorted.map((p) => ({ x: toX(p.x), y: toY(p.y) }));
            if (pts.length < 2 || s.dashed) return null;
            const areaPath = `M${pts[0].x},${toY(yRange[0])} ` +
              pts.map((p) => `L${p.x},${p.y}`).join(" ") +
              ` L${pts[pts.length - 1].x},${toY(yRange[0])} Z`;
            return (
              <path key={`area-${s.id}`} d={areaPath} fill={`url(#grad-${s.id})`} />
            );
          })}

          {/* Series lines with smooth curves */}
          {visibleSeries.map((s) => {
            const sorted = [...s.points].sort((a, b) => a.x - b.x);
            const pts = sorted.map((p) => ({ x: toX(p.x), y: toY(p.y) }));
            const d = smoothPath(pts);
            return (
              <g key={s.id}>
                <path d={d} fill="none" stroke={s.color} strokeWidth={2.5}
                  strokeDasharray={s.dashed ? "6 4" : undefined}
                  filter={`url(#glow-${s.id})`}
                  style={{ animation: "cc-trace 1.5s ease-out forwards" }}
                  strokeDashoffset={0}
                />
              </g>
            );
          })}

          {/* Interactive cursor line */}
          {cursorX != null && (
            <g filter="url(#cursor-glow)">
              <line
                x1={toX(cursorX)} y1={PAD.top} x2={toX(cursorX)} y2={H - PAD.bottom}
                stroke="rgba(255,255,255,0.35)" strokeWidth={1}
              />
              {cursorValues.map((cv) => (
                <g key={cv.id}>
                  <circle cx={toX(cursorX)} cy={toY(cv.value)} r={5}
                    fill={cv.color} opacity={0.3} />
                  <circle cx={toX(cursorX)} cy={toY(cv.value)} r={3.5}
                    fill={cv.color} stroke="white" strokeWidth={1}
                    style={{ animation: "cc-dot-pulse 2s ease-in-out infinite" }}
                  />
                </g>
              ))}
            </g>
          )}
        </svg>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-[10px] text-gray-500">
          {visibleSeries.map((s) => (
            <span key={s.id} className="flex items-center gap-1.5">
              <span className="inline-block w-4 h-0.5 rounded-full" style={{ background: s.color, boxShadow: `0 0 6px ${s.color}` }} />
              {s.label}
            </span>
          ))}
        </div>

        {/* Cursor readouts */}
        {cursorValues.length > 0 && (
          <div className="flex flex-wrap gap-3 text-xs">
            {cursorValues.map((cv) => (
              <span key={cv.id} className="px-2 py-0.5 rounded-full border border-white/10 bg-white/5" style={{ color: cv.color }}>
                {cv.label}: {cv.value < 1 ? cv.value.toFixed(3) : cv.value.toFixed(1)}
              </span>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
