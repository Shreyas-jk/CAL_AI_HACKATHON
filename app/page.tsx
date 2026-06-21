import Upload from "@/components/Upload";
import PixelIcon from "@/components/PixelIcon";

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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <h2 className="label text-xs font-bold text-charcoal/70">▸ {children}</h2>
      <div className="h-[2px] bg-charcoal/15 flex-1" />
    </div>
  );
}

export default function Home() {
  return (
    <div className="space-y-16">
      {/* 1 · Hero */}
      <section className="text-center space-y-5 pt-2">
        <span className="tag mx-auto w-fit">✦ Cal Hacks · Neural Arcade</span>
        <h1 className="display text-5xl md:text-6xl tracking-tight">
          Make papers <span className="text-coral">playable</span>.
        </h1>
        <p className="text-charcoal/70 max-w-2xl mx-auto text-base leading-relaxed">
          Upload an ML/AI research paper — it becomes a playable, faithful game you learn by
          <span className="text-mint-dark font-bold"> playing, not reading</span>. Real computation under the
          hood, not a narrated animation.
        </p>
      </section>

      {/* 2 · Featured flagships */}
      <section className="space-y-5">
        <SectionLabel>Featured</SectionLabel>
        <div className="grid md:grid-cols-2 gap-6">
          {/* Efficiency flagship */}
          <a href="/dev/efficiency"
            className="card group relative p-7 flex flex-col gap-4 overflow-hidden hover:-translate-y-0.5 transition">
            <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-coral/20 blur-2xl" />
            <div className="flex items-center justify-between">
              <span className="tag !border-coral text-coral">★ Flagship</span>
              <span className="label text-[0.6rem] text-charcoal/50">Efficiency · quantization</span>
            </div>
            <div>
              <h3 className="display text-3xl">Race the Paper</h3>
              <p className="mt-2 text-sm text-charcoal/75 leading-relaxed">
                Tune precision, sparsity, and cache against the paper&apos;s ghost car. You can&apos;t beat it on
                speed <em>and</em> quality at once — that wall is the Pareto frontier, and their trick is what
                reaches it. Speed from real FLOPs, quality from a measured grid.
              </p>
            </div>
            <span className="btn-primary mt-auto w-fit"><PixelIcon name="play" className="w-3.5 h-3.5" /> Play Efficiency</span>
          </a>

          {/* RAG flagship */}
          <a href="/dev/rag"
            className="card group relative p-7 flex flex-col gap-4 overflow-hidden hover:-translate-y-0.5 transition">
            <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-mint/25 blur-2xl" />
            <div className="flex items-center justify-between">
              <span className="tag !border-mint-dark text-mint-dark">★ Flagship</span>
              <span className="label text-[0.6rem] text-charcoal/50">RAG · retrieval</span>
            </div>
            <div>
              <h3 className="display text-3xl">Pipeline Defense</h3>
              <p className="mt-2 text-sm text-charcoal/75 leading-relaxed">
                Route queries through a retrieval pipeline where bad retrieval becomes a visible breach.
                Naive knobs alone let wrong context through; the paper&apos;s corrective module (CRAG) catches the
                specific failure. Replayed from a precomputed grid — zero model calls at play time.
              </p>
            </div>
            <span className="btn-secondary mt-auto w-fit"><PixelIcon name="play" className="w-3.5 h-3.5" /> Play RAG / CRAG</span>
          </a>
        </div>
      </section>

      {/* 3 · Upload -> classify demo */}
      <section className="space-y-5">
        <SectionLabel>Or bring your own</SectionLabel>
        <p className="text-center text-sm text-charcoal/65 max-w-2xl mx-auto">
          Drop in your own paper and watch it auto-detect the right game — summary, concept map, and a
          challenge built from the paper&apos;s core idea.
        </p>
        <Upload />
      </section>

      {/* 4 · More games */}
      <section className="space-y-5">
        <SectionLabel>More games</SectionLabel>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {MORE_GAMES.map((g) => (
            <a key={g.href} href={g.href}
              className="card group p-5 flex flex-col gap-3 hover:-translate-y-0.5 transition">
              <div>
                <h3 className="display text-xl leading-tight">{g.title}</h3>
                <p className="label text-[0.6rem] text-mint-dark mt-1">{g.category}</p>
              </div>
              <p className="text-sm text-charcoal/70 flex-1 leading-relaxed">{g.teaches}</p>
              <span className="label text-xs text-coral group-hover:underline">Play →</span>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
