import { getArtifact } from "@/lib/store";
import { mockArtifact } from "@/lib/mockData";
import { mockReasoning } from "@/lib/mockData";
import Explanation from "@/components/Explanation";
import ConceptMap from "@/components/ConceptMap";
import GameRouter from "@/components/game/GameRouter";

export const dynamic = "force-dynamic";

export default async function ResultPage({ params }: { params: { id: string } }) {
  // fall back to a themed demo artifact if the id isn't in the store (e.g. /result/demo)
  const artifact = (await getArtifact(params.id))
    || (params.id.startsWith("demo-reasoning") ? mockReasoning(params.id) : mockArtifact(params.id));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{artifact.title}</h1>
          <p className="text-gray-400 text-sm">{artifact.oneLiner}</p>
        </div>
        <div className="flex gap-2 items-center">
          <span className="tag">{artifact.category}</span>
          <span className="tag">source: {artifact.source}</span>
          <span className="tag" title="Arize eval">
            faithfulness {Math.round(artifact.eval.faithfulness * 100)}% · halluc {Math.round(artifact.eval.hallucinationRisk * 100)}%
          </span>
        </div>
      </div>

      <section className="grid lg:grid-cols-2 gap-6">
        <div className="card p-5 space-y-3">
          <h2 className="font-semibold text-accent2">Tier 1 · Understand</h2>
          <p className="text-sm text-gray-300">{artifact.summary}</p>
          <Explanation steps={artifact.plainEnglish} />
        </div>
        <div className="card p-5">
          <h2 className="font-semibold text-accent2 mb-3">Concept map</h2>
          <ConceptMap nodes={artifact.concept.nodes} edges={artifact.concept.edges} />
        </div>
      </section>

      <section className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-accent2">Tier 2 & 3 · Play / Prove</h2>
          <span className="tag">template: {artifact.game.template} · conf {Math.round(artifact.game.confidence * 100)}%</span>
        </div>
        <GameRouter game={artifact.game} />
      </section>
    </div>
  );
}