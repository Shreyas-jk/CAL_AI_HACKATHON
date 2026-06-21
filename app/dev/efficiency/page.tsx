"use client";
import { useState } from "react";
import Efficiency from "@/components/game/templates/efficiency";
import Cabinet from "@/components/Cabinet";
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
        <h1 className="display text-3xl">Dev · Efficiency Engine</h1>
        <p className="text-charcoal/65 text-sm mt-1">
          Calls <code className="text-mint-dark font-bold">build_efficiency_game</code> with a mock AWQ payload and renders the
          <span className="text-coral font-bold"> tradeoff</span> GameSpec it returns.
        </p>
      </div>

      <button className="btn-primary py-2 px-4" onClick={() => setSpec(buildEfficiencyGame(SAMPLE_EFFICIENCY_PAPER))}>
        ▶ Test Efficiency Game
      </button>

      {spec && (
        <Cabinet label={spec.title}>
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-white/90">{spec.title}</h2>
                <p className="text-sm text-white/55">{spec.summary}</p>
              </div>
              <span className="tag shrink-0">archetype: {spec.archetype}</span>
            </div>
            <Efficiency spec={spec} />
          </div>
        </Cabinet>
      )}
    </div>
  );
}
