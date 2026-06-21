"use client";
import type { PaperArtifact } from "@/lib/types";
import Pathfinding from "./templates/pathfinding";
import Attention from "./templates/attention";
import GridworldRL from "./templates/gridworldRl";
import Epidemic from "./templates/epidemic";
import VisionDetective from "./templates/visionDetective";

export default function GameRouter({ game }: { game: PaperArtifact["game"] }) {
  switch (game.template) {
    case "pathfinding": return <Pathfinding game={game} />;
    case "attention": return <Attention game={game} />;
    case "gridworld-rl": return <GridworldRL game={game} />;
    case "epidemic": return <Epidemic game={game} />;
    case "vision-detective": return <VisionDetective game={game} />;
    default:
      return (
        <div className="text-sm text-gray-400">
          No playable game template matched this paper with high confidence — but Tier 1
          (summary + concept map above) still works. Try a paper in pathfinding, attention,
          RL, epidemic modeling, or multimodal vision-language grounding.
        </div>
      );
  }
}
