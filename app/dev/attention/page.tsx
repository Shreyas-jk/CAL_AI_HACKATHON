"use client";
import Attention from "@/components/game/templates/attention";
import Cabinet from "@/components/Cabinet";
import { MOCK_ARTIFACTS } from "@/lib/mockData";

// Dev-only harness: render the attention ("Spotlight") game directly from its baked
// mock artifact — no upload, no live AI, no classifier. Mirrors app/dev/fine-tuning.
// (The /result/* fallback only themes pathfinding/reasoning/vision, so attention needs
// its own standalone entry point to be reachable.)
export default function DevAttentionPage() {
  const game = MOCK_ARTIFACTS["attention"]!.game;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="display text-3xl">Dev · Attention</h1>
        <p className="text-charcoal/65 text-sm mt-1">
          Renders the <span className="text-coral font-bold">Spotlight</span> (uniform vs learned attention)
          game from a baked mock artifact — skips upload and the classifier.
        </p>
      </div>

      <Cabinet label="Spotlight">
        <div className="p-4">
          <Attention game={game} />
        </div>
      </Cabinet>
    </div>
  );
}
