"use client";
import { useState } from "react";
import { MOCK_ARTIFACTS } from "@/lib/mockData";
import type { GameTemplateId } from "@/lib/types";
import GameRouter from "@/components/game/GameRouter";

const BUTTONS: { id: Exclude<GameTemplateId, "none">; label: string }[] = [
  { id: "pathfinding", label: "Pathfinding" },
  { id: "attention", label: "Attention" },
  { id: "gridworld-rl", label: "Gridworld RL" },
  { id: "epidemic", label: "Epidemic" },
  { id: "fine-tuning-alignment", label: "Fine-tuning / Alignment" },
];

export default function DevGameTester() {
  const [active, setActive] = useState<Exclude<GameTemplateId, "none"> | null>(null);

  return (
    <section className="card p-5 space-y-4 border border-dashed border-edge">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">Dev: test a game template directly (skips upload)</p>
        {active && (
          <button className="btn-ghost py-1 px-3 text-sm" onClick={() => setActive(null)}>
            Close
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {BUTTONS.map((b) => (
          <button
            key={b.id}
            onClick={() => setActive(b.id)}
            className={"btn py-1.5 px-3 text-sm " + (active === b.id ? "bg-accent text-white" : "border border-edge text-gray-300")}
          >
            {b.label}
          </button>
        ))}
      </div>
      {active && (
        <div className="pt-2 border-t border-edge">
          <GameRouter game={MOCK_ARTIFACTS[active].game} />
        </div>
      )}
    </section>
  );
}