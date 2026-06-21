import { getArtifact } from "@/lib/store";
import { mockArtifact } from "@/lib/mockData";
import { mockReasoning } from "@/lib/mockData";
import Explanation from "@/components/Explanation";
import ConceptMap from "@/components/ConceptMap";
import GameRouter from "@/components/game/GameRouter";
import ListenButton from "@/components/ListenButton";
import Cabinet from "@/components/Cabinet";
import PaperChat from "@/components/PaperChat";

export const dynamic = "force-dynamic";

export default async function ResultPage({ params }: { params: { id: string } }) {
  // fall back to a themed demo artifact if the id isn't in the store (e.g. /result/demo)
  const artifact = (await getArtifact(params.id))
    || (params.id.startsWith("demo-reasoning") ? mockReasoning(params.id) : mockArtifact(params.id));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="display text-3xl">{artifact.title}</h1>
          <p className="text-charcoal/60 text-sm mt-1">{artifact.oneLiner}</p>
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
          <div className="flex items-center justify-between gap-2">
            <h2 className="label text-sm font-bold text-mint-dark">Tier 1 · Understand</h2>
            <ListenButton text={artifact.summary + ". " + artifact.plainEnglish.join(". ")} />
          </div>
          <p className="text-sm text-charcoal/80">{artifact.summary}</p>
          <Explanation steps={artifact.plainEnglish} />
        </div>
        <div>
          <h2 className="label text-sm font-bold text-mint-dark mb-2">Concept map</h2>
          <Cabinet label="Concept Map">
            <div className="p-3">
              <ConceptMap nodes={artifact.concept.nodes} edges={artifact.concept.edges} />
            </div>
          </Cabinet>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="label text-sm font-bold text-mint-dark">Ask the paper</h2>
        <Cabinet label="Grounded Q&amp;A">
          <div className="p-4">
            <PaperChat id={params.id} />
          </div>
        </Cabinet>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="label text-sm font-bold text-mint-dark">Tier 2 &amp; 3 · Play / Prove</h2>
          <span className="tag">template: {artifact.game.template} · conf {Math.round(artifact.game.confidence * 100)}%</span>
        </div>
        <Cabinet label={artifact.game.template}>
          <div className="p-4">
            <GameRouter game={artifact.game} />
          </div>
        </Cabinet>
      </section>
    </div>
  );
}