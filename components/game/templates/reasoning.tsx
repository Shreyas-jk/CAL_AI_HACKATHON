"use client";
import { useMemo, useState, useCallback } from "react";
import type { PaperArtifact } from "@/lib/types";
import GameFrame from "../GameFrame";

type Room = "A" | "B" | "C";
const ROOMS: Room[] = ["A", "B", "C"];
const ROOM_NAME: Record<Room, string> = {
  A: "Room A · Auditorium", B: "Room B · GPU Lab", C: "Room C · Classroom",
};
const SLOTS = ["10 AM", "11 AM", "1 PM", "2 PM"];
const SESSIONS = ["Keynote", "RAG workshop", "Agents workshop", "Robotics lab", "Safety workshop", "Multimodal workshop"] as const;
type Session = typeof SESSIONS[number];
const SHORT: Record<Session, string> = {
  "Keynote": "Keynote", "RAG workshop": "RAG", "Agents workshop": "Agents",
  "Robotics lab": "Robotics", "Safety workshop": "Safety", "Multimodal workshop": "Multimodal",
};
type Cell = { room: Room; slot: number };
type Schedule = Record<Session, Cell>;

interface Constraint { id: string; text: string; ok: boolean; }
function check(s: Schedule): Constraint[] {
  const noClash = (() => {
    const seen = new Set<string>();
    for (const k of SESSIONS) { const key = s[k].room + ":" + s[k].slot; if (seen.has(key)) return false; seen.add(key); }
    return true;
  })();
  const bAfter1 = SESSIONS.every((k) => !(s[k].room === "B" && s[k].slot === 3));
  return [
    { id: "C1", text: "Keynote at 10 AM", ok: s["Keynote"].slot === 0 },
    { id: "C2", text: "Robotics lab in GPU Lab (Room B)", ok: s["Robotics lab"].room === "B" },
    { id: "C3", text: "RAG & Agents not same time", ok: s["RAG workshop"].slot !== s["Agents workshop"].slot },
    { id: "C4", text: "Safety after Agents", ok: s["Safety workshop"].slot > s["Agents workshop"].slot },
    { id: "C5", text: "Multimodal not in Room C", ok: s["Multimodal workshop"].room !== "C" },
    { id: "C6", text: "Room B unavailable after 1 PM", ok: bAfter1 },
    { id: "C7", text: "Robotics after Multimodal", ok: s["Robotics lab"].slot > s["Multimodal workshop"].slot },
    { id: "C8", text: "No room double-booked", ok: noClash },
  ];
}
const passCount = (s: Schedule) => check(s).filter((c) => c.ok).length;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
type RNG = () => number;
function shuffle<T>(a: T[], rng: RNG): T[] { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }

// Generate one candidate. "guided" picks cells that respect constraints when possible
// (smart CoT step); otherwise it places more randomly (naive single-shot).
function genCandidate(guided: boolean, rng: RNG): Schedule {
  const used = new Set<string>();
  const free = (pred: (r: Room, sl: number) => boolean): Cell => {
    const cells: Cell[] = [];
    for (const r of ROOMS) for (let sl = 0; sl < SLOTS.length; sl++) cells.push({ room: r, slot: sl });
    const shuffled = shuffle(cells, rng);
    const ok = shuffled.filter((c) => !used.has(c.room + ":" + c.slot) && (!guided || pred(c.room, c.slot)));
    const pick = (ok.length ? ok : shuffled.filter((c) => !used.has(c.room + ":" + c.slot)))[0] || shuffled[0];
    used.add(pick.room + ":" + pick.slot);
    return pick;
  };
  const s = {} as Schedule;
  s["Keynote"] = free((_, sl) => sl === 0);
  s["Multimodal workshop"] = free((r, sl) => r !== "C" && !(r === "B" && sl === 3) && sl < 3);
  s["Robotics lab"] = free((r, sl) => r === "B" && sl !== 3 && sl > s["Multimodal workshop"].slot);
  s["Agents workshop"] = free((r, sl) => !(r === "B" && sl === 3) && sl < 3);
  s["RAG workshop"] = free((r, sl) => !(r === "B" && sl === 3) && sl !== s["Agents workshop"].slot);
  s["Safety workshop"] = free((r, sl) => !(r === "B" && sl === 3) && sl > s["Agents workshop"].slot);
  return s;
}

interface Attempt { id: number; schedule: Schedule; passed: number; }
type Verifier = "off" | "final" | "step";
type Voting = "off" | "majority" | "weighted";

export default function Reasoning({ game }: { game: PaperArtifact["game"] }) {
  const [usePowerup, setUsePowerup] = useState(false);
  const [attempts, setAttempts] = useState(1);
  const [verifier, setVerifier] = useState<Verifier>("off");
  const [voting, setVoting] = useState<Voting>("off");
  const [budget, setBudget] = useState(25);
  const [runId, setRunId] = useState(0);

  const preset = useCallback((power: boolean) => {
    setUsePowerup(power);
    if (power) { setAttempts(8); setVerifier("final"); setVoting("weighted"); setBudget(25); }
    else { setAttempts(1); setVerifier("off"); setVoting("off"); }
    setRunId((r) => r + 1);
  }, []);

  const result = useMemo(() => {
    const costPer = 2 + (verifier === "final" ? 1 : 0) + (verifier === "step" ? 3 : 0);
    const affordable = Math.max(1, Math.floor(budget / costPer));
    const actual = Math.max(1, Math.min(attempts, affordable));
    const vCode = verifier === "off" ? 0 : verifier === "final" ? 1 : 2;
    const voCode = voting === "off" ? 0 : voting === "majority" ? 1 : 2;
    const seed = (runId * 131 + attempts * 17 + budget * 3 + vCode * 7 + voCode * 5 + (usePowerup ? 991 : 13)) >>> 0;
    const rng = mulberry32(seed);
    const list: Attempt[] = [];
    for (let i = 0; i < actual; i++) { const sc = genCandidate(usePowerup, rng); list.push({ id: i + 1, schedule: sc, passed: passCount(sc) }); }

    let selected = list[0];
    if (voting === "weighted" && verifier !== "off") {
      selected = list.reduce((a, b) => (b.passed > a.passed ? b : a), list[0]);
    } else if (voting === "majority") {
      const counts: Record<number, number> = {};
      list.forEach((a) => { counts[a.passed] = (counts[a.passed] || 0) + 1; });
      const top = Object.keys(counts).map(Number).sort((a, b) => counts[b] - counts[a] || b - a)[0];
      selected = list.find((a) => a.passed === top) || list[0];
    }
    const computeUsed = actual * costPer;
    const finalScore = Math.max(0, Math.round((selected.passed / 8) * 100 - computeUsed));
    return { list, selected, computeUsed, finalScore, actual, clamped: actual < attempts };
  }, [attempts, verifier, voting, budget, runId, usePowerup]);

  const cons = check(result.selected.schedule);
  const sessionAt = (r: Room, sl: number) => SESSIONS.find((k) => result.selected.schedule[k].room === r && result.selected.schedule[k].slot === sl);
  const status = result.selected.passed === 8 ? "won" : "lost";

  return (
    <GameFrame
      goal={game.goal || "Schedule all 6 sessions so all 8 constraints pass — under the compute budget."}
      baselineLabel={game.baselineLabel || "Single-shot (1 attempt)"}
      powerupLabel={game.powerupLabel || "Best-of-N + Verifier + Voting"}
      claim={game.claim || "Paper claim: scaling test-time compute (samples + verifier + voting) finds correct multi-step solutions a single sample misses."}
      usePowerup={usePowerup}
      onToggle={preset}
      score={"score " + result.finalScore + " · " + result.selected.passed + "/8 · compute " + result.computeUsed}
      status={status as any}
      onReset={() => setRunId((r) => r + 1)}
    >
      <div className="space-y-5">
      <div className="card p-4 border-accent/30 bg-accent/5 space-y-2 text-sm">
        <div className="font-semibold text-accent2">How this works — and what to do</div>
        <p className="text-gray-300">This puzzle shows the big idea behind <span className="text-white">reasoning / chain-of-thought</span> papers: instead of answering instantly, an AI that <span className="text-white">thinks step-by-step, tries several times, and checks its work</span> can solve hard problems that a single quick guess gets wrong.</p>
        <ol className="list-decimal list-inside text-gray-400 space-y-0.5">
          <li>Goal: place all 6 sessions on the grid so every rule (checklist under the board) is satisfied — that's <span className="text-white">8/8</span>.</li>
          <li>Start on <span className="text-bad">Single-shot</span>: one quick attempt. It usually breaks a rule and loses.</li>
          <li>Switch to <span className="text-good">⚡ Best-of-N + Verifier + Voting</span>: the AI tries many schedules, scores them, and votes — and finds a valid plan.</li>
          <li>Use the panel on the right to change how hard the AI &quot;thinks&quot;, and watch the score react.</li>
        </ol>
      </div>
      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr><th className="p-2 text-left text-gray-400 font-normal">Room \\ Slot</th>
                  {SLOTS.map((sl) => <th key={sl} className="p-2 text-gray-300 font-medium">{sl}</th>)}</tr>
              </thead>
              <tbody>
                {ROOMS.map((r) => (
                  <tr key={r}>
                    <td className="p-2 text-gray-400 whitespace-nowrap">{ROOM_NAME[r]}</td>
                    {SLOTS.map((_, sl) => {
                      const ses = sessionAt(r, sl);
                      const blocked = r === "B" && sl === 3;
                      return (
                        <td key={sl} className={"p-1 border border-edge text-center h-12 " + (blocked ? "bg-bad/10" : "")}>
                          {ses ? <span className="inline-block px-2 py-1 rounded bg-accent/25 text-accent2 text-xs">{SHORT[ses]}</span>
                            : blocked ? <span className="text-bad/50 text-[10px]">unavailable</span> : <span className="text-gray-700">·</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={"text-xs rounded-md p-2 leading-snug " + (result.selected.passed === 8 ? "bg-good/10 text-good" : "bg-bad/10 text-bad")}>
            {result.selected.passed === 8
              ? "Solved! Sampling several schedules, scoring them with the verifier, and voting found a plan that passes all 8 rules — that is the paper's core idea: more thinking at answer-time leads to better reasoning."
              : "This selected attempt breaks " + (8 - result.selected.passed) + " rule(s). Switch to the powerup, raise Attempts, or turn on the Verifier so the AI can think harder and check its work."}
          </div>
          <div className="text-xs text-gray-500">Rules — the AI must satisfy all of these:</div>
          <div className="grid sm:grid-cols-2 gap-1.5">
            {cons.map((c) => (
              <div key={c.id} className={"text-xs flex items-center gap-2 " + (c.ok ? "text-good" : "text-bad")}>
                <span>{c.ok ? "✓" : "✗"}</span><span className="text-gray-300">{c.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4 text-sm">
          <div className="card p-3 space-y-3">
            <div>
              <div className="flex justify-between text-gray-300"><span>Attempts</span><span className="text-accent2">{attempts}</span></div>
              <input type="range" min={1} max={10} value={attempts} onChange={(e) => { setAttempts(Number(e.target.value)); setRunId((r) => r + 1); }} className="w-full" />
              <p className="text-[10px] text-gray-500 leading-snug">How many schedules the AI samples. More attempts = better odds of finding a valid one.</p>
            </div>
            <Seg label="Verifier" value={verifier} opts={[["off", "Off"], ["final", "Final"], ["step", "Step-by-step"]]} onChange={(v) => { setVerifier(v as Verifier); setRunId((r) => r + 1); }} hint="A checker that scores each attempt. Final = check the finished schedule. Step-by-step = check every placement (more thorough, costs more compute)." />
            <Seg label="Voting" value={voting} opts={[["off", "Off"], ["majority", "Majority"], ["weighted", "Verifier-weighted"]]} onChange={(v) => { setVoting(v as Voting); setRunId((r) => r + 1); }} hint="How the final answer is picked from all attempts. Majority = the most common schedule. Verifier-weighted = the attempt the verifier scored highest." />
            <div>
              <div className="flex justify-between text-gray-300"><span>Compute budget</span><span className="text-accent2">{budget}</span></div>
              <input type="range" min={5} max={60} step={5} value={budget} onChange={(e) => { setBudget(Number(e.target.value)); setRunId((r) => r + 1); }} className="w-full" />
              <p className="text-[10px] text-gray-500 leading-snug">Total &quot;thinking&quot; allowed at answer-time. Each attempt and each check costs compute; if you run out, extra attempts are skipped (clamped).</p>
            </div>
            <div className="flex justify-between text-gray-500"><span>Hints</span><span>None</span></div>
            <button className="btn-primary w-full py-1.5" onClick={() => setRunId((r) => r + 1)}>Run reasoning ▸</button>
          </div>

          <div className="card p-3 space-y-1">
            <div className="text-gray-400 mb-1">Attempts {result.clamped ? "(clamped by budget)" : ""}</div>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {result.list.map((a) => (
                <div key={a.id} className={"flex justify-between text-xs px-2 py-1 rounded " + (a.id === result.selected.id ? "bg-good/15 text-good" : "text-gray-400")}>
                  <span>Attempt {a.id}{a.id === result.selected.id ? " ◀ selected" : ""}</span>
                  <span>{a.passed}/8</span>
                </div>
              ))}
            </div>
            <div className="border-t border-edge pt-2 flex justify-between font-medium">
              <span className="text-gray-300">Final score</span><span className="text-accent">{result.finalScore}</span>
            </div>
          </div>
        </div>
      </div>
      </div>
    </GameFrame>
  );
}

function Seg({ label, value, opts, onChange, hint }: { label: string; value: string; opts: [string, string][]; onChange: (v: string) => void; hint?: string; }) {
  return (
    <div>
      <div className="text-gray-300 mb-1">{label}</div>
      <div className="flex gap-1">
        {opts.map(([v, t]) => (
          <button key={v} onClick={() => onChange(v)}
            className={"flex-1 px-1.5 py-1 rounded text-[11px] border " + (value === v ? "bg-accent/30 border-accent text-white" : "border-edge text-gray-400")}>{t}</button>
        ))}
      </div>
      {hint ? <p className="text-[10px] text-gray-500 mt-1 leading-snug">{hint}</p> : null}
    </div>
  );
}