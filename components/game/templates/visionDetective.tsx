"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import GameWindow from "../GameWindow";
import type { PaperArtifact } from "@/lib/types";
import { DEFAULT_VISION_SETTINGS, VISION_CASES } from "@/lib/games/visionDetective/cases";
import { questionClues } from "@/lib/games/visionDetective/questions";
import { runVisionCase } from "@/lib/games/visionDetective/scoring";
import type { ConfidenceThreshold, VisionSettings } from "@/lib/games/visionDetective/types";

const VisionScene = dynamic(() => import("../visionDetective/VisionScene"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center bg-[#060713] text-sm text-gray-400">loading evidence room</div>,
});

const QUESTION_LIMIT = 12;

export default function VisionDetective({ game }: { game: PaperArtifact["game"] }) {
  const [caseIndex, setCaseIndex] = useState(0);
  const [settings, setSettings] = useState<VisionSettings>(DEFAULT_VISION_SETTINGS);
  const [asked, setAsked] = useState<Record<string, string[]>>({});
  const [submitted, setSubmitted] = useState<Record<string, boolean>>({});
  const [solved, setSolved] = useState<Record<string, boolean>>({});
  const [showCaseFile, setShowCaseFile] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showGlossary, setShowGlossary] = useState(false);

  const themed = useMemo(() => {
    const c = game.content || {};
    return {
      investigationContext: typeof c.investigationContext === "string" ? c.investigationContext : "",
      caseLessons: Array.isArray(c.caseLessons) ? c.caseLessons as string[] : [],
    };
  }, [game.content]);

  const visionCase = VISION_CASES[caseIndex];
  const askedIds = asked[visionCase.id] ?? [];
  const run = useMemo(() => runVisionCase(visionCase, settings, askedIds), [visionCase, settings, askedIds]);
  const hasSubmitted = Boolean(submitted[visionCase.id]);
  const totalSolved = Object.values(solved).filter(Boolean).length;
  const rank = totalSolved === 3 ? "Hallucination Hunter" : totalSolved === 2 ? "Grounding Expert" : totalSolved === 1 ? "Evidence Scout" : "Rookie Analyst";

  const updateSetting = <K extends keyof VisionSettings>(key: K, value: VisionSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSubmitted((prev) => ({ ...prev, [visionCase.id]: false }));
  };

  const askQuestion = (id: string) => {
    if (askedIds.includes(id) || askedIds.length >= QUESTION_LIMIT) return;
    setAsked((prev) => ({ ...prev, [visionCase.id]: [...askedIds, id] }));
    setSubmitted((prev) => ({ ...prev, [visionCase.id]: false }));
  };

  const submit = () => {
    setSubmitted((prev) => ({ ...prev, [visionCase.id]: true }));
    if (run.solved) setSolved((prev) => ({ ...prev, [visionCase.id]: true }));
  };

  const nextCase = () => {
    setCaseIndex((i) => Math.min(VISION_CASES.length - 1, i + 1));
    setSettings(DEFAULT_VISION_SETTINGS);
  };

  const resetCase = () => {
    setSettings(DEFAULT_VISION_SETTINGS);
    setAsked((prev) => ({ ...prev, [visionCase.id]: [] }));
    setSubmitted((prev) => ({ ...prev, [visionCase.id]: false }));
  };

  return (
    <div className="space-y-4">
      <GameWindow>
        <VisionScene visionCase={visionCase} run={run} settings={settings} submitted={hasSubmitted} />

        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-3 top-3 max-w-[48%] rounded-lg border border-accent2/35 bg-black/65 px-3 py-2 backdrop-blur md:left-4 md:top-4 md:max-w-[52%]">
            <div className="text-xs uppercase tracking-wide text-accent2">{visionCase.title}</div>
            <div className="text-sm font-semibold text-white">{visionCase.objective}</div>
          </div>

          <div className="absolute right-3 top-3 rounded-lg border border-edge bg-black/65 px-2 py-2 text-right backdrop-blur md:right-4 md:top-4 md:px-3">
            <div className="text-xs uppercase tracking-wide text-gray-500">compute / score</div>
            <div className="font-mono text-sm text-white">{run.computeCost} / {run.computeBudget} compute</div>
            <div className="font-mono text-xs text-gray-300">{run.finalScore} pts</div>
            <div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-white/10 md:w-36">
              <div className={`h-full ${run.overBudget ? "bg-bad" : "bg-accent2"}`} style={{ width: `${Math.min(100, (run.computeCost / run.computeBudget) * 100)}%` }} />
            </div>
          </div>

          <div className="absolute bottom-4 left-3 right-3 rounded-lg border border-edge bg-black/70 p-3 backdrop-blur md:left-1/2 md:right-auto md:w-[min(720px,calc(100%-2rem))] md:-translate-x-1/2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-400">
              <span className="font-mono text-accent2">Hidden target: {visionCase.hiddenTarget}</span>
              <span>{askedIds.length}/{QUESTION_LIMIT} questions asked</span>
            </div>
            <div className="mt-2 text-sm text-white">{visionCase.prompt}</div>
          </div>
        </div>

        <div className="absolute bottom-28 right-4 flex gap-2 md:bottom-4">
          <button className="btn-ghost pointer-events-auto bg-black/60 px-3 py-1.5 text-xs" onClick={() => setShowGlossary((v) => !v)}>
            Terms
          </button>
          <button className="btn-ghost pointer-events-auto bg-black/60 px-3 py-1.5 text-xs" onClick={() => setShowHelp((v) => !v)}>
            How to play
          </button>
          <button className="btn-ghost pointer-events-auto bg-black/60 px-3 py-1.5 text-xs" onClick={() => setShowCaseFile((v) => !v)}>
            Case file
          </button>
        </div>

        {showHelp && (
          <div className="absolute right-4 top-24 w-[min(390px,calc(100%-2rem))] rounded-lg border border-accent2/40 bg-[#090b16]/95 p-4 shadow-xl md:right-4">
            <div className="text-xs uppercase tracking-wide text-accent2">How to play</div>
            <ol className="mt-2 list-decimal space-y-2 pl-4 text-sm text-gray-300">
              <li>Look at the evidence scene and read the case question.</li>
              <li>Ask yes/no questions to reveal clues, but keep the question budget low.</li>
              <li>Turn on VLM tools only when the case needs them.</li>
              <li>Submit the verdict and check whether the answer is grounded.</li>
              <li>Solve the case to unlock the next one.</li>
            </ol>
            <div className="mt-3 rounded border border-edge bg-black/30 p-2 text-xs text-gray-400">
              Case 1 wants detector + grounding. Case 2 wants OCR. Case 3 has no cat, so the model should refuse.
            </div>
          </div>
        )}

        {showGlossary && (
          <div className="absolute right-4 top-24 w-[min(390px,calc(100%-2rem))] rounded-lg border border-edge bg-[#090b16]/95 p-4 shadow-xl">
            <div className="text-xs uppercase tracking-wide text-accent2">Term glossary</div>
            <div className="mt-2 space-y-2">
              <GlossaryItem term="Region grounding" body="The model ties its answer to a specific visual area instead of guessing from the whole scene." />
              <GlossaryItem term="OCR" body="Optical character recognition. It reads printed text inside an image, like receipts or signs." />
              <GlossaryItem term="Object detector" body="A vision tool that proposes likely objects and where they are in the scene." />
              <GlossaryItem term="Image crop tool" body="A zoomed-in cutout that helps the model focus on the most relevant part of the image." />
              <GlossaryItem term="Grounding required" body="The model must refuse if it cannot find evidence for the answer in the image." />
              <GlossaryItem term="Confidence threshold" body="How cautious the model should be before answering. Higher thresholds refuse more often." />
              <GlossaryItem term="Reasoning steps" body="How many internal reasoning passes the model gets. More steps may help, but they cost compute." />
              <GlossaryItem term="Compute budget" body="The hard cap on how much tooling and questioning you can spend in one case. Go over budget and the case does not count as solved." />
            </div>
          </div>
        )}

        {showCaseFile && (
          <div className="absolute left-4 top-24 w-[min(360px,calc(100%-2rem))] rounded-lg border border-edge bg-[#090b16]/95 p-4 shadow-xl">
            <div className="text-xs uppercase tracking-wide text-accent2">Paper lesson</div>
            {themed.investigationContext && <p className="mt-2 text-sm text-accent2/80 italic">{themed.investigationContext}</p>}
            <p className="mt-2 text-sm text-gray-300">
              {themed.caseLessons[caseIndex] || String(game.params.lesson || visionCase.lesson)}
            </p>
            <p className="mt-3 border-l-2 border-accent pl-3 text-xs text-gray-400">{game.claim || "Ground language answers in visual evidence before trusting them."}</p>
          </div>
        )}
      </GameWindow>

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <section className="rounded-lg border border-edge bg-ink/60 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-accent2">Visual Guess Who Interrogation</h3>
              <p className="text-xs text-gray-500">Ask targeted yes/no questions, then submit a grounded VLM verdict.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {VISION_CASES.map((c, i) => {
                const locked = i > 0 && !solved[VISION_CASES[i - 1].id];
                return (
                  <button
                    key={c.id}
                    disabled={locked}
                    onClick={() => setCaseIndex(i)}
                    className={`rounded-md border px-3 py-1.5 text-xs transition ${caseIndex === i ? "border-accent2 bg-accent2/15 text-white" : solved[c.id] ? "border-good/50 text-good" : locked ? "border-edge text-gray-600" : "border-edge text-gray-300 hover:bg-edge/40"}`}
                  >
                    {i + 1}. {c.title}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mb-3 rounded-lg border border-accent2/30 bg-accent2/10 p-3 text-sm text-gray-300">
            <span className="font-semibold text-accent2">Start here:</span> ask one or two clue questions, enable the tools that match the evidence, then press Submit verdict. Better scores use fewer tools and fewer questions.
          </div>

          <div className={`mb-3 rounded-lg border p-3 text-sm ${run.overBudget ? "border-bad/40 bg-bad/10 text-red-100" : "border-edge bg-black/25 text-gray-300"}`}>
            <span className="font-semibold text-accent2">Compute budget:</span> {run.computeCost} used / {run.computeBudget} max.
            {run.overBudget ? " This run is over budget, so it cannot count as a solved case." : ` ${run.computeRemaining} compute left.`}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {visionCase.questions.map((q) => {
              const used = askedIds.includes(q.id);
              return (
                <button
                  key={q.id}
                  disabled={used || askedIds.length >= QUESTION_LIMIT}
                  onClick={() => askQuestion(q.id)}
                  className={`rounded-lg border p-3 text-left text-sm transition ${used ? "border-accent2/50 bg-accent2/10 text-gray-300" : "border-edge bg-panel/70 text-gray-200 hover:border-accent2/60"}`}
                >
                  <span>{q.text}</span>
                  {used && <span className="mt-2 block text-xs text-accent2">{q.answer ? "Yes" : "No"} - {q.clue}</span>}
                </button>
              );
            })}
          </div>

          <div className="mt-4 rounded-lg border border-edge bg-black/25 p-3">
            <div className="text-xs uppercase tracking-wide text-gray-500">Model answer</div>
            <p className={hasSubmitted ? run.solved ? "mt-1 text-good" : "mt-1 text-bad" : "mt-1 text-gray-300"}>
              {hasSubmitted ? run.modelAnswer : "Submit a verdict when you have enough evidence."}
            </p>
            {hasSubmitted && <p className="mt-2 text-sm text-gray-400">{run.evidenceExplanation}</p>}
            {questionClues(visionCase, askedIds).length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {questionClues(visionCase, askedIds).map((clue) => <span key={clue} className="tag">{clue}</span>)}
              </div>
            )}
          </div>
        </section>

        <aside className="rounded-lg border border-edge bg-ink/60 p-4">
          <h3 className="font-semibold text-accent2">VLM Tool Bench</h3>
          <div className="mt-3 space-y-3">
            <Toggle label="Region grounding" value={settings.regionGrounding} onChange={(v) => updateSetting("regionGrounding", v)} />
            <Toggle label="OCR" value={settings.ocr} onChange={(v) => updateSetting("ocr", v)} />
            <Toggle label="Object detector" value={settings.objectDetector} onChange={(v) => updateSetting("objectDetector", v)} />
            <Toggle label="Image crop tool" value={settings.cropTool} onChange={(v) => updateSetting("cropTool", v)} />
            <Toggle label="Grounding required" value={settings.groundingRequired} onChange={(v) => updateSetting("groundingRequired", v)} />
            <Segmented
              label="Confidence"
              value={settings.confidenceThreshold}
              options={["low", "medium", "high"]}
              onChange={(v) => updateSetting("confidenceThreshold", v as ConfidenceThreshold)}
            />
            <Segmented
              label="Reasoning steps"
              value={String(settings.reasoningSteps)}
              options={["1", "3", "5"]}
              onChange={(v) => updateSetting("reasoningSteps", Number(v) as 1 | 3 | 5)}
            />
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
            <ScoreBar label="answer" value={run.answerCorrectness} max={50} />
            <ScoreBar label="ground" value={run.groundingAccuracy} max={30} />
            <ScoreBar label="refuse" value={Math.max(0, run.hallucinationScore)} max={25} />
          </div>

          <div className="mt-4 flex gap-2">
            <button className="btn-primary flex-1 py-2 text-sm" onClick={submit}>Submit verdict</button>
            <button className="btn-ghost px-3 py-2 text-sm" onClick={resetCase}>Reset</button>
          </div>
          {hasSubmitted && run.solved && caseIndex < VISION_CASES.length - 1 && (
            <button className="btn mt-2 w-full bg-good/80 py-2 text-sm text-white" onClick={nextCase}>Unlock next case</button>
          )}
          <div className="mt-4 rounded-lg border border-edge bg-black/25 p-3 text-sm">
            <div className="text-xs uppercase tracking-wide text-gray-500">Rank</div>
            <div className="mt-1 font-semibold text-white">{rank}</div>
            <div className="mt-1 text-xs text-gray-400">{totalSolved}/3 cases solved</div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button className="flex w-full items-center justify-between rounded-md border border-edge bg-panel/70 px-3 py-2 text-sm" onClick={() => onChange(!value)}>
      <span>{label}</span>
      <span className={`h-5 w-9 rounded-full p-0.5 transition ${value ? "bg-good" : "bg-gray-700"}`}>
        <span className={`block h-4 w-4 rounded-full bg-white transition ${value ? "translate-x-4" : ""}`} />
      </span>
    </button>
  );
}

function Segmented({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div>
      <div className="mb-1 text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="grid grid-cols-3 gap-1 rounded-md border border-edge bg-black/25 p-1">
        {options.map((option) => (
          <button key={option} className={`rounded px-2 py-1.5 text-xs ${value === option ? "bg-accent2 text-ink" : "text-gray-400 hover:bg-edge/50"}`} onClick={() => onChange(option)}>
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

function ScoreBar({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div>
      <div className="mx-auto h-16 w-5 overflow-hidden rounded-full bg-white/10">
        <div className="mt-auto h-full bg-good" style={{ transform: `translateY(${100 - Math.min(100, (value / max) * 100)}%)` }} />
      </div>
      <div className="mt-1 text-gray-500">{label}</div>
    </div>
  );
}

function GlossaryItem({ term, body }: { term: string; body: string }) {
  return (
    <details className="rounded-md border border-edge bg-black/25 px-3 py-2">
      <summary className="cursor-pointer text-sm text-white">{term}</summary>
      <p className="mt-2 text-xs text-gray-400">{body}</p>
    </details>
  );
}
