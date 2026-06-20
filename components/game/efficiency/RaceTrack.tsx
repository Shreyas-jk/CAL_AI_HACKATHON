"use client";
import { useEffect, useRef, useState } from "react";

// 2D side-view race: YOUR car vs the paper's GHOST. Pure presentation — the
// outcome is decided up front from the real numbers (speedup from cost.ts,
// quality from grid.ts) and this just dramatizes it. No new deps.

export type RaceOutcome = "win" | "slow" | "unreliable" | "breakdown" | "memwall";

const W = 560, H = 210;
const START = 54, FINISH = W - 46;
const GHOST_Y = 78, YOU_Y = 150;
const DUR = 3200; // ms the ghost takes to finish

export default function RaceTrack({ yourSpeed, paperSpeed, outcome, closeness, onDone }: {
  yourSpeed: number;
  paperSpeed: number;
  outcome: RaceOutcome;
  closeness: number; // 0..1 — how near the paper's quality this build is (drives how far you get)
  onDone: (o: RaceOutcome) => void;
}) {
  const [p, setP] = useState(0); // ghost progress 0..1 over DUR
  const startRef = useRef<number | null>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    let raf = 0;
    const tick = (now: number) => {
      if (startRef.current == null) startRef.current = now;
      const t = Math.min(1, (now - startRef.current) / DUR);
      setP(t);
      if (t < 1) raf = requestAnimationFrame(tick);
      else if (!doneRef.current) { doneRef.current = true; window.setTimeout(() => onDone(outcome), 800); }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [outcome, onDone]);

  const ratio = paperSpeed > 0 ? yourSpeed / paperSpeed : 0;
  const c = Math.max(0, Math.min(1, closeness));
  // Higher-quality builds sputter out closer to the line — degrees of closeness.
  const sputterCap = 0.45 + 0.5 * c;
  let yourP = 0, smoking = false, sputter = false;
  switch (outcome) {
    case "win": yourP = Math.min(1, p * Math.min(1.04, ratio)); break;
    case "slow": yourP = p * Math.min(0.97, ratio); break;
    case "unreliable": yourP = Math.min(sputterCap, p * 1.3); sputter = p > sputterCap / 1.3; break;
    case "breakdown": yourP = Math.min(0.18 + 0.18 * c, p * 1.15); smoking = p > 0.24; break;
    case "memwall": yourP = 0; smoking = p > 0.05; break;
  }

  const ghostX = START + (FINISH - START) * p;
  const jitter = sputter ? Math.sin(p * 90) * 1.6 : 0;
  const yourX = START + (FINISH - START) * yourP + jitter;
  const dead = outcome === "breakdown" || outcome === "memwall";

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="rounded bg-ink/60 select-none">
      {/* sky / asphalt */}
      <rect x={0} y={0} width={W} height={H} fill="#0c0d16" />
      <rect x={0} y={GHOST_Y - 26} width={W} height={56} fill="#15161f" />
      <rect x={0} y={YOU_Y - 26} width={W} height={56} fill="#15161f" />
      {/* lane dashes */}
      {[GHOST_Y + 4, YOU_Y + 4].map((y) => (
        <line key={y} x1={START} y1={y} x2={FINISH} y2={y} stroke="#2a2b3a" strokeWidth={2} strokeDasharray="12 10" />
      ))}

      {/* start + finish lines */}
      <line x1={START} y1={GHOST_Y - 28} x2={START} y2={YOU_Y + 30} stroke="#3a3b4d" strokeWidth={2} />
      <Checkered x={FINISH} top={GHOST_Y - 28} bottom={YOU_Y + 30} />

      {/* progress readouts */}
      <text x={START} y={26} fontSize={11} fill="#9ca3af">🏁 Race the test car</text>
      <text x={FINISH} y={26} fontSize={11} fill="#f5b500" textAnchor="end">paper {paperSpeed.toFixed(1)}x</text>

      {/* ghost (paper) */}
      <Car x={ghostX} y={GHOST_Y} color="#f5b500" label={`paper ${paperSpeed.toFixed(1)}x`} opacity={0.5} />
      {/* you */}
      <Car x={yourX} y={YOU_Y} color={dead ? "#f87171" : "#7c5cff"} label={`you ${yourSpeed.toFixed(1)}x`} opacity={1} tilt={dead} />

      {/* smoke for breakdown / memory wall */}
      {smoking && [0, 1, 2].map((i) => (
        <circle key={i} cx={yourX - 18 - i * 9} cy={YOU_Y - 14 - (Math.sin(p * 30 + i) * 4)} r={5 + i * 2}
          fill="#9ca3af" opacity={0.35 - i * 0.08} />
      ))}
      {dead && (
        <text x={yourX} y={YOU_Y + 44} fontSize={11} fill="#f87171" textAnchor="middle" fontWeight={700}>
          {outcome === "memwall" ? "🧱 out of memory" : "💥 engine blew"}
        </text>
      )}
      {sputter && <text x={yourX} y={YOU_Y + 44} fontSize={11} fill="#f59e0b" textAnchor="middle">…sputtering</text>}
    </svg>
  );
}

function Car({ x, y, color, label, opacity, tilt }: { x: number; y: number; color: string; label: string; opacity: number; tilt?: boolean }) {
  return (
    <g transform={`translate(${x},${y}) rotate(${tilt ? -6 : 0})`} opacity={opacity}>
      <text x={0} y={-24} fontSize={9} fill={color} textAnchor="middle">{label}</text>
      <rect x={-24} y={-8} width={48} height={14} rx={5} fill={color} />
      <rect x={-12} y={-18} width={26} height={12} rx={4} fill={color} opacity={0.8} />
      <circle cx={-13} cy={8} r={6} fill="#0a0a12" stroke="#3a3b4d" strokeWidth={2} />
      <circle cx={14} cy={8} r={6} fill="#0a0a12" stroke="#3a3b4d" strokeWidth={2} />
    </g>
  );
}

function Checkered({ x, top, bottom }: { x: number; top: number; bottom: number }) {
  const sq = 6, rows = Math.ceil((bottom - top) / sq);
  const cells = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < 2; c++) {
    if ((r + c) % 2 === 0) cells.push(<rect key={`${r}-${c}`} x={x + c * sq} y={top + r * sq} width={sq} height={sq} fill="#e5e7eb" />);
  }
  return <g>{cells}</g>;
}
