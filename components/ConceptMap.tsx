"use client";
import type { ConceptNode, ConceptEdge } from "@/lib/types";

// Lightweight radial concept map rendered as inline SVG (no heavy deps).
export default function ConceptMap({ nodes, edges }: { nodes: ConceptNode[]; edges: ConceptEdge[] }) {
  if (!nodes?.length) return <p className="text-sm text-gray-500">No concept map available.</p>;
  const W = 460, H = 320, cx = W / 2, cy = H / 2, R = 120;
  const pos: Record<string, { x: number; y: number }> = {};
  nodes.forEach((n, i) => {
    const a = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
    pos[n.id] = { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) };
  });
  const color = (g?: string) => g === "contribution" ? "#7c5cff" : g === "baseline" ? "#f87171"
    : g === "outcome" ? "#34d399" : g === "constraint" ? "#fbbf24" : "#22d3ee";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {edges.map((e, i) => {
        const a = pos[e.source], b = pos[e.target];
        if (!a || !b) return null;
        return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#2a2a3c" strokeWidth={1.5} />;
      })}
      {nodes.map((n) => {
        const p = pos[n.id];
        return (
          <g key={n.id}>
            <circle cx={p.x} cy={p.y} r={7} fill={color(n.group)} />
            <text x={p.x} y={p.y - 11} textAnchor="middle" fontSize={10} fill="#cbd5e1">{n.label}</text>
          </g>
        );
      })}
    </svg>
  );
}
