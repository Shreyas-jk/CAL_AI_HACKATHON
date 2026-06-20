import Upload from "@/components/Upload";
import DevGameTester from "@/components/DevGameTester";

export default function Home() {
  return (
    <div className="space-y-10">
      <section className="text-center space-y-4 pt-6">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
          Make papers <span className="text-accent">playable</span>.
        </h1>
        <p className="text-gray-400 max-w-2xl mx-auto">
          Upload an ML/AI research paper. PaperTrail turns it into a concept map, a plain-English
          explanation, and a <span className="text-accent2">game</span> where you first fail without
          the paper's idea — then win with it.
        </p>
      </section>

      <Upload />

      <DevGameTester />

      <section className="grid md:grid-cols-3 gap-4">
        {[
          ["1 · Understand", "Summary, plain-English steps, and an auto concept map. Works for any paper."],
          ["2 · Play", "A challenge built from the paper's core idea — with a goal and a score."],
          ["3 · Prove", "Lose with the naive baseline, then unlock the paper's method as a power-up and win."],
        ].map(([t, d]) => (
          <div key={t} className="card p-5">
            <div className="text-accent2 font-semibold mb-1">{t}</div>
            <div className="text-sm text-gray-400">{d}</div>
          </div>
        ))}
      </section>
    </div>
  );
}
