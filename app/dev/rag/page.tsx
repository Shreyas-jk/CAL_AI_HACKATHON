import RagGame from "@/components/game/rag/RagGame";

// Dev-only harness for the CRAG routing game. Renders the playable UI over the
// shipped, precomputed grid (lib/games/rag/data/grid.json) — ZERO runtime model
// calls, fully deterministic. Same pattern as /dev/efficiency; main page untouched.
export default function DevRagPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dev · CRAG Routing Game</h1>
        <p className="text-gray-400 text-sm">
          Naive RAG trusts retrieval blindly. <span className="text-accent2">Corrective RAG</span> routes by retrieval quality —
          internal when retrieval is good, web fallback when it&apos;s bad. Rebuild the router by dragging the thresholds.
        </p>
      </div>
      <RagGame />
    </div>
  );
}
