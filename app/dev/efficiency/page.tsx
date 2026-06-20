"use client";
import { useState } from "react";
import Efficiency from "@/components/game/templates/efficiency";
import { buildEfficiencyGame } from "@/lib/games/efficiency/tool";
import { SAMPLE_EFFICIENCY_PAPER } from "@/lib/games/efficiency/sample";
import type { TradeoffSpec } from "@/lib/games/efficiency/types";

// Dev-only harness: invoke the build_efficiency_game tool with a hardcoded mock
// payload and render the resulting game — no upload, no live AI, no classifier.
export default function DevEfficiencyPage() {
  const [spec, setSpec] = useState<TradeoffSpec | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dev · Efficiency Engine</h1>
        <p className="text-gray-400 text-sm">
          Calls <code className="text-accent2">build_efficiency_game</code> with a mock AWQ payload and renders the
          <span className="text-accent"> tradeoff</span> GameSpec it returns.
        </p>
      </div>

      <button
        className="btn bg-accent/80 text-white py-2 px-4"
        onClick={() => setSpec(buildEfficiencyGame(SAMPLE_EFFICIENCY_PAPER))}
      >
        ▶ Test Efficiency Game
      </button>

      {spec && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">{spec.title}</h2>
              <p className="text-sm text-gray-400">{spec.summary}</p>
            </div>
            <span className="tag">archetype: {spec.archetype}</span>
          </div>
          <Efficiency spec={spec} />
        </div>
      )}
    </div>
  );
}
