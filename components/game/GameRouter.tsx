"use client";
import type { PaperArtifact } from "@/lib/types";
import { isValidGameSpec } from "@/lib/gameSpec";
import DynamicGame from "./DynamicGame";
import Pathfinding from "./templates/pathfinding";
import Attention from "./templates/attention";
import GridworldRL from "./templates/gridworldRl";
import Epidemic from "./templates/epidemic";
import FineTuningAlignment from "./templates/fineTuningAlignment";
import Reasoning from "./templates/reasoning";
import VisionDetective from "./templates/visionDetective";

export default function GameRouter({ game }: { game: PaperArtifact["game"] }) {
  if (game.content && isValidGameSpec(game.content as Record<string, unknown>)) {
    return <DynamicGame game={game} />;
  }

  switch (game.template) {
    case "pathfinding": return <Pathfinding game={game} />;
    case "attention": return <Attention game={game} />;
    case "gridworld-rl": return <GridworldRL game={game} />;
    case "epidemic": return <Epidemic game={game} />;
    case "fine-tuning-alignment": return <FineTuningAlignment game={game} />;
    case "reasoning": return <Reasoning game={game} />;
    case "vision-detective": return <VisionDetective game={game} />;
    case "efficiency":
      return (
        <div className="card p-6 space-y-3 text-center">
          <p className="text-sm text-gray-300">
            This paper maps to our <span className="text-accent font-semibold">Efficiency</span> flagship game —
            tune precision, sparsity, and cache against the paper&apos;s ghost car on a real Pareto frontier.
          </p>
          <a href="/dev/efficiency" className="btn-primary inline-block">▶ Play Race the Paper</a>
        </div>
      );
    case "rag":
      return (
        <div className="card p-6 space-y-3 text-center">
          <p className="text-sm text-gray-300">
            This paper maps to our <span className="text-accent2 font-semibold">RAG</span> flagship game —
            route queries through a retrieval pipeline where bad retrieval becomes a visible breach.
          </p>
          <a href="/dev/rag" className="btn-primary inline-block">▶ Play Pipeline Defense</a>
        </div>
      );
    default:
      return (
        <div className="text-sm text-gray-400">
          No playable game template matched this paper with high confidence — but Tier 1
          (summary + concept map above) still works. Try a paper in pathfinding, attention,
          fine-tuning, reasoning, multimodal, RL, or epidemic modeling.
        </div>
      );
  }
}