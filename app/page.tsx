import Upload from "@/components/Upload";

// Front door: link-only index over existing routes. The two flagships (efficiency, rag)
// are featured; the upload->classify demo is kept; every other playable game is one click
// away. This page touches no game logic or routes — it only links to them.

type GameCard = {
  title: string;
  teaches: string;
  category: string;
  href: string;
};

const MORE_GAMES: GameCard[] = [
  {
    title: "The Leash",
    teaches: "Tune how far a fine-tuned policy may drift — too little and nothing changes, too much and it reward-hacks into gibberish.",
    category: "Fine-tuning · RLHF / DPO / alignment",
    href: "/dev/fine-tuning",
  },
  {
    title: "AI Conference Scheduler",
    teaches: "A single sample fails the 8-constraint puzzle; best-of-N + verifier + voting under a compute budget finds the solution.",
    category: "Reasoning · chain-of-thought / test-time compute",
    href: "/result/demo-reasoning",
  },
  {
    title: "Vision Detective",
    teaches: "Interrogate a vision-language model, then ground its answers in real visual evidence before it hallucinates.",
    category: "Multimodal · VQA / OCR / grounding",
    href: "/result/demo-vision",
  },
  {
    title: "Maze Runner",
    teaches: "Naive BFS burns its step budget; the paper's learned A* heuristic reaches the goal with a fraction of the expansions.",
    category: "Pathfinding · search / planning",
    href: "/result/demo-pathfinding",
  },
  {
    title: "Spotlight",
    teaches: "Find the token the model should focus on — uniform attention smears across everything, learned attention spotlights it.",
    category: "Attention · transformers / NLP",
    href: "/dev/attention",
  },
];

export default function Home() {
  return (
    <div className="space-y-14">
      {/* 1 · Hero */}
      <section className="text-center space-y-4 pt-4">
        <span className="tag">Cal Hacks · PaperTrail AI</span>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
          Make papers <span className="text-accent">playable</span>.
        </h1>
        <p className="text-gray-400 max-w-2xl mx-auto text-lg">
          Upload an ML/AI research paper — it becomes a playable, faithful game you learn by
          <span className="text-accent2"> playing, not reading</span>. Real computation under the hood,
          not a narrated animation.
        </p>
      </section>

      {/* 2 · Featured flagships */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Featured</h2>
          <div className="h-px bg-edge flex-1" />
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Efficiency flagship */}
          <a
            href="/dev/efficiency"
            className="card group relative p-7 flex flex-col gap-4 overflow-hidden transition hover:border-accent/70"
          >
            <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-accent/20 blur-3xl" />
            <div className="flex items-center justify-between">
              <span className="tag border-accent/50 text-accent">★ Flagship</span>
              <span className="text-xs text-gray-500">Efficiency · quantization</span>
            </div>
            <div>
              <h3 className="text-2xl font-bold">Race the Paper</h3>
              <p className="mt-2 text-sm text-gray-300">
                Tune precision, sparsity, and cache against the paper&apos;s ghost car. You can&apos;t beat it on
                speed <em>and</em> quality at once — that wall is the Pareto frontier, and their trick is what
                reaches it. Speed from real FLOPs, quality from a measured grid.
              </p>
            </div>
            <span className="btn-primary mt-auto w-fit group-hover:opacity-90">▶ Play Efficiency</span>
          </a>

          {/* RAG flagship */}
          <a
            href="/dev/rag"
            className="card group relative p-7 flex flex-col gap-4 overflow-hidden transition hover:border-accent2/70"
          >
            <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-accent2/20 blur-3xl" />
            <div className="flex items-center justify-between">
              <span className="tag border-accent2/50 text-accent2">★ Flagship</span>
              <span className="text-xs text-gray-500">RAG · retrieval</span>
            </div>
            <div>
              <h3 className="text-2xl font-bold">Pipeline Defense</h3>
              <p className="mt-2 text-sm text-gray-300">
                Route queries through a retrieval pipeline where bad retrieval becomes a visible breach.
                Naive knobs alone let wrong context through; the paper&apos;s corrective module (CRAG) catches the
                specific failure. Replayed from a precomputed grid — zero model calls at play time.
              </p>
            </div>
            <span className="btn-primary mt-auto w-fit group-hover:opacity-90">▶ Play RAG / CRAG</span>
          </a>
        </div>
      </section>

      {/* 3 · Upload -> classify demo */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Or bring your own</h2>
          <div className="h-px bg-edge flex-1" />
        </div>
        <p className="text-center text-sm text-gray-400 max-w-2xl mx-auto">
          Drop in your own paper and watch it auto-detect the right game — summary, concept map, and a
          challenge built from the paper&apos;s core idea.
        </p>
        <Upload />
      </section>

      {/* 4 · More games */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">More games</h2>
          <div className="h-px bg-edge flex-1" />
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {MORE_GAMES.map((g) => (
            <a
              key={g.href}
              href={g.href}
              className="card group p-5 flex flex-col gap-3 transition hover:border-accent/60"
            >
              <div>
                <h3 className="font-semibold text-lg">{g.title}</h3>
                <p className="text-xs text-accent2 mt-0.5">{g.category}</p>
              </div>
              <p className="text-sm text-gray-400 flex-1">{g.teaches}</p>
              <span className="text-sm text-accent group-hover:underline">Play →</span>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
