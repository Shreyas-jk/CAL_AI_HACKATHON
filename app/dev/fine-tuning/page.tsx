"use client";
import FineTuningAlignment from "@/components/game/templates/fineTuningAlignment";
import Cabinet from "@/components/Cabinet";
import { MOCK_ARTIFACTS } from "@/lib/mockData";

// Dev-only harness: render the fine-tuning / alignment ("The Leash") game directly
// from its baked mock artifact — no upload, no live AI, no classifier. Mirrors
// app/dev/efficiency/page.tsx so the game is verifiable in isolation.
export default function DevFineTuningPage() {
  const game = MOCK_ARTIFACTS["fine-tuning-alignment"]!.game;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="display text-3xl">Dev · Fine-tuning / Alignment</h1>
        <p className="text-charcoal/65 text-sm mt-1">
          Renders the <span className="text-coral font-bold">policy-drift</span> &quot;The Leash&quot; game from a
          baked mock artifact — skips upload and the classifier.
        </p>
      </div>

      <Cabinet label="The Leash">
        <div className="p-4">
          <FineTuningAlignment game={game} />
        </div>
      </Cabinet>
    </div>
  );
}
