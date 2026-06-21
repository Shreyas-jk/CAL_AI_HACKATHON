"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { PaperArtifact } from "@/lib/types";
import GameFrame from "../GameFrame";
import {
  ROOMS,
  SLOTS,
  SESSIONS as SESSION_DEFS,
  type Assignment,
  type Room,
  type SessionId,
  happyCount,
  isClosed,
  mood,
  occupantAt,
  sessionById,
  wishStatus,
} from "../seat/puzzle";

const SeatGame = dynamic(() => import("../seat/SeatGame"), { ssr: false });

const SESSION_IDS = SESSION_DEFS.map((s) => s.id);
const DEFAULT_SHORT: Record<SessionId, string> = {
  Keynote: "Keynote",
  RAG: "RAG",
  Agents: "Agents",
  Robotics: "Robotics",
  Safety: "Safety",
  Multimodal: "Multimodal",
};
const DEFAULT_VERIFY: Record<string, string> = {
  C1: "Keynote at 10",
  C2: "Robotics in GPU Lab",
  C3: "RAG and Agents separate",
  C4: "Safety after Agents",
  C5: "Multimodal not Room C",
  C6: "GPU Lab closes at 2",
  C7: "Robotics after Multimodal",
  C8: "No double-booking",
};

function parseTheme(content?: Record<string, unknown>) {
  const c = content || {};
  const names = Array.isArray(c.sessionNames) && (c.sessionNames as string[]).length === 6
    ? c.sessionNames as string[] : null;
  const rooms = Array.isArray(c.roomNames) && (c.roomNames as string[]).length === 3
    ? c.roomNames as string[] : null;
  const slots = Array.isArray(c.slotLabels) && (c.slotLabels as string[]).length === 4
    ? c.slotLabels as string[] : null;
  const theme = typeof c.theme === "string" ? c.theme : null;

  const short: Record<SessionId, string> = names
    ? { Keynote: names[0], RAG: names[1], Agents: names[2], Robotics: names[3], Safety: names[4], Multimodal: names[5] }
    : DEFAULT_SHORT;

  const verify: Record<string, string> = names
    ? {
        C1: `${names[0]} first`,
        C2: `${names[3]} in ${rooms?.[1] || "Room B"}`,
        C3: `${names[1]} & ${names[2]} separate`,
        C4: `${names[4]} after ${names[2]}`,
        C5: `${names[5]} not ${rooms?.[2] || "Room C"}`,
        C6: `${rooms?.[1] || "Room B"} closes late`,
        C7: `${names[3]} after ${names[5]}`,
        C8: "No double-booking",
      }
    : DEFAULT_VERIFY;

  return {
    short,
    verify,
    headerText: theme || "AI SUMMIT",
    slotLabels: slots || SLOTS,
    roomLabels: rooms || ROOMS.map((r) => `Room ${r.id} (${r.name})`),
  };
}

interface Constraint {
  id: string;
  text: string;
  ok: boolean;
}

interface Attempt {
  id: number;
  schedule: Assignment;
  passed: number;
}

type Verifier = "off" | "final" | "step";
type Voting = "off" | "majority" | "weighted";
type RNG = () => number;

function check(s: Assignment): Constraint[] {
  const allPlaced = SESSION_IDS.every((id) => s[id]);
  const noClash = (() => {
    const seen = new Set<string>();
    for (const id of SESSION_IDS) {
      const cell = s[id];
      if (!cell) return false;
      const key = cell.room + ":" + cell.slot;
      if (seen.has(key)) return false;
      seen.add(key);
    }
    return true;
  })();
  const bAfter1 = SESSION_IDS.every((id) => {
    const cell = s[id];
    return !cell || !(cell.room === "B" && cell.slot === 3);
  });
  return [
    { id: "C1", text: "Keynote opens at 10 AM", ok: s.Keynote?.slot === 0 },
    { id: "C2", text: "Robotics uses the GPU Lab", ok: s.Robotics?.room === "B" },
    { id: "C3", text: "RAG and Agents avoid a speaker clash", ok: !!s.RAG && !!s.Agents && s.RAG.slot !== s.Agents.slot },
    { id: "C4", text: "Safety happens after Agents", ok: !!s.Safety && !!s.Agents && s.Safety.slot > s.Agents.slot },
    { id: "C5", text: "Multimodal avoids Room C", ok: !!s.Multimodal && s.Multimodal.room !== "C" },
    { id: "C6", text: "Room B is closed after 1 PM", ok: bAfter1 },
    { id: "C7", text: "Robotics happens after Multimodal", ok: !!s.Robotics && !!s.Multimodal && s.Robotics.slot > s.Multimodal.slot },
    { id: "C8", text: "No room is double-booked", ok: allPlaced && noClash },
  ];
}

function passCount(s: Assignment) {
  return check(s).filter((c) => c.ok).length;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(a: T[], rng: RNG): T[] {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

function genCandidate(guided: boolean, rng: RNG): Assignment {
  const used = new Set<string>();
  const free = (pred: (r: Room, sl: number) => boolean): { room: Room; slot: number } => {
    const cells: { room: Room; slot: number }[] = [];
    for (const room of ROOMS) for (let slot = 0; slot < SLOTS.length; slot++) cells.push({ room: room.id, slot });
    const shuffled = shuffle(cells, rng);
    const valid = shuffled.filter((c) => !used.has(c.room + ":" + c.slot) && (!guided || pred(c.room, c.slot)));
    const fallback = shuffled.filter((c) => !used.has(c.room + ":" + c.slot));
    const pick = (valid.length ? valid : fallback)[0] || shuffled[0];
    used.add(pick.room + ":" + pick.slot);
    return pick;
  };

  const s: Assignment = {};
  s.Keynote = free((_, slot) => slot === 0);
  s.Multimodal = free((room, slot) => room !== "C" && !isClosed(room, slot) && slot < 3);
  s.Robotics = free((room, slot) => room === "B" && !isClosed(room, slot) && !!s.Multimodal && slot > s.Multimodal.slot);
  s.Agents = free((room, slot) => !isClosed(room, slot) && slot < 3);
  s.RAG = free((room, slot) => !isClosed(room, slot) && !!s.Agents && slot !== s.Agents.slot);
  s.Safety = free((room, slot) => !isClosed(room, slot) && !!s.Agents && slot > s.Agents.slot);
  return s;
}

export default function Reasoning({ game }: { game: PaperArtifact["game"] }) {
  const themed = useMemo(() => parseTheme(game.content), [game.content]);
  const [usePowerup, setUsePowerup] = useState(false);
  const [attempts, setAttempts] = useState(1);
  const [verifier, setVerifier] = useState<Verifier>("off");
  const [voting, setVoting] = useState<Voting>("off");
  const [budget, setBudget] = useState(25);
  const [runId, setRunId] = useState(0);
  const [previewId, setPreviewId] = useState(1);
  const [aiPaused, setAiPaused] = useState(false);

  const preset = useCallback((power: boolean) => {
    setUsePowerup(power);
    setAiPaused(false);
    setPreviewId(1);
    if (power) {
      setAttempts(8);
      setVerifier("final");
      setVoting("weighted");
      setBudget(25);
    } else {
      setAttempts(1);
      setVerifier("off");
      setVoting("off");
    }
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

    for (let i = 0; i < actual; i++) {
      const schedule = genCandidate(usePowerup || verifier === "step", rng);
      list.push({ id: i + 1, schedule, passed: passCount(schedule) });
    }

    let selected = list[0];
    if (voting === "weighted" && verifier !== "off") {
      selected = list.reduce((a, b) => (b.passed > a.passed ? b : a), list[0]);
    } else if (voting === "majority") {
      const counts: Record<number, number> = {};
      list.forEach((a) => {
        counts[a.passed] = (counts[a.passed] || 0) + 1;
      });
      const top = Object.keys(counts).map(Number).sort((a, b) => counts[b] - counts[a] || b - a)[0];
      selected = list.find((a) => a.passed === top) || list[0];
    }

    const computeUsed = actual * costPer;
    const finalScore = Math.max(0, Math.round((selected.passed / 8) * 100 - computeUsed));
    return { list, selected, computeUsed, finalScore, actual, clamped: actual < attempts };
  }, [attempts, verifier, voting, budget, runId, usePowerup]);

  useEffect(() => {
    setPreviewId(1);
  }, [runId, attempts, verifier, voting, budget, usePowerup]);

  useEffect(() => {
    if (aiPaused || result.list.length <= 1) return;
    const timer = window.setInterval(() => {
      setPreviewId((id) => (id >= result.list.length ? 1 : id + 1));
    }, 850);
    return () => window.clearInterval(timer);
  }, [aiPaused, result.list.length]);

  const preview = result.list.find((a) => a.id === previewId) || result.selected;
  const status = result.selected.passed === 8 ? "won" : "lost";

  return (
    <GameFrame
      goal={game.goal || "Schedule all 6 sessions so all 8 constraints pass under the compute budget."}
      baselineLabel={game.baselineLabel || "Single-shot"}
      powerupLabel={game.powerupLabel || "Best-of-N + Verifier"}
      claim={game.claim || "Paper claim: spending more test-time compute on samples, checks, and voting helps solve multi-step reasoning problems."}
      usePowerup={usePowerup}
      onToggle={preset}
      score={"score " + result.finalScore + " · selected " + result.selected.passed + "/8 · compute " + result.computeUsed}
      status={status}
      onReset={() => {
        setAiPaused(false);
        setPreviewId(1);
        setRunId((r) => r + 1);
      }}
    >
      <div className="space-y-5">
        <section className="grid gap-4 xl:grid-cols-2">
          <PuzzlePanel
            title="Human puzzle"
            meta="Manual solve"
            detail="Drag every talk into a seat, then confirm when all 6 guests are happy."
          >
            <SeatGame />
          </PuzzlePanel>

          <PuzzlePanel
            title="AI puzzle"
            meta={result.actual + " sampled"}
            detail="Same rooms, talks, closed seat, and 8-rule verifier; only the solving strategy changes."
          >
            <AiConferenceBoard
              attempt={preview}
              selectedId={result.selected.id}
              paused={aiPaused}
              onPause={() => setAiPaused((p) => !p)}
              themed={themed}
            />
          </PuzzlePanel>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Target" value="6 happy" />
            <Metric label="Verifier" value={result.selected.passed + "/8"} tone={result.selected.passed === 8 ? "good" : "bad"} />
            <Metric label="Compute" value={String(result.computeUsed)} />
            <Metric label="Score" value={String(result.finalScore)} />
          </div>

          <div className="grid gap-4 text-sm lg:grid-cols-[minmax(0,1fr)_340px] xl:col-span-2">
            <div className="card p-3 space-y-3">
              <Slider
                label="Attempts"
                value={attempts}
                min={1}
                max={10}
                step={1}
                onChange={(v) => {
                  setAttempts(v);
                  setRunId((r) => r + 1);
                }}
              />
              <Seg label="Verifier" value={verifier} opts={[["off", "Off"], ["final", "Final"], ["step", "Step-by-step"]]} onChange={(v) => {
                setVerifier(v as Verifier);
                setRunId((r) => r + 1);
              }} />
              <Seg label="Voting" value={voting} opts={[["off", "Off"], ["majority", "Majority"], ["weighted", "Verifier-weighted"]]} onChange={(v) => {
                setVoting(v as Voting);
                setRunId((r) => r + 1);
              }} />
              <Slider
                label="Compute budget"
                value={budget}
                min={5}
                max={60}
                step={5}
                onChange={(v) => {
                  setBudget(v);
                  setRunId((r) => r + 1);
                }}
              />
              <button className="btn-primary w-full py-1.5" onClick={() => {
                setAiPaused(false);
                setPreviewId(1);
                setRunId((r) => r + 1);
              }}>
                Run reasoning
              </button>
            </div>

            <div className="card p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-300">Attempt trace</span>
                <span className="text-xs text-gray-500">{result.clamped ? "clamped by budget" : result.actual + " sampled"}</span>
              </div>
              <div className="max-h-52 overflow-y-auto space-y-1 pr-1">
                {result.list.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => {
                      setAiPaused(true);
                      setPreviewId(a.id);
                    }}
                    className={
                      "w-full flex items-center justify-between rounded-md px-2 py-1.5 text-xs transition " +
                      (a.id === preview.id ? "bg-accent/25 text-white" : "text-gray-400 hover:bg-edge/50") +
                      (a.id === result.selected.id ? " ring-1 ring-good/50" : "")
                    }
                  >
                    <span>Attempt {a.id}{a.id === result.selected.id ? " · selected" : ""}</span>
                    <span className={a.passed === 8 ? "text-good" : a.passed >= 6 ? "text-accent2" : "text-bad"}>{a.passed}/8</span>
                  </button>
                ))}
              </div>
              <div className="border-t border-edge pt-2 flex justify-between font-medium">
                <span className="text-gray-300">Final score</span>
                <span className="text-accent">{result.finalScore}</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </GameFrame>
  );
}

function PuzzlePanel({ title, meta, detail, children }: { title: string; meta: string; detail: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-2">
      <div className="flex min-h-[52px] items-end justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <p className="mt-1 text-xs leading-snug text-gray-400">{detail}</p>
        </div>
        <span className="shrink-0 rounded-full border border-edge px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-300">
          {meta}
        </span>
      </div>
      {children}
    </div>
  );
}

function AiConferenceBoard({
  attempt,
  selectedId,
  paused,
  onPause,
  themed,
}: {
  attempt: Attempt;
  selectedId: number;
  paused: boolean;
  onPause: () => void;
  themed: ReturnType<typeof parseTheme>;
}) {
  const constraints = check(attempt.schedule);
  const happy = happyCount(attempt.schedule);
  const selected = SESSION_IDS.find((id) => attempt.schedule[id]);
  const selectedDef = selected ? sessionById(selected) : null;
  const selectedWishes = selected ? wishStatus(attempt.schedule, selected) : [];

  return (
    <ScaledStage>
        <div className="absolute inset-0 bg-[#f2e8d5]" />
        <div className="absolute inset-0 opacity-35 [background-image:radial-gradient(#ffffff_1.5px,transparent_1.5px)] [background-size:38px_31px]" />
        <button
          onClick={onPause}
          aria-label={paused ? "Play reasoning preview" : "Pause reasoning preview"}
          className="absolute left-[24px] top-[24px] z-20 grid h-[48px] w-[48px] place-items-center rounded-full border-[4px] border-[#4a3f35] bg-[#e39aa0] text-[24px] font-black leading-none text-[#4a3f35] transition hover:scale-105"
        >
          {paused ? ">" : "II"}
        </button>

        <div className="absolute left-[372px] top-[30px] flex h-[40px] w-[536px] items-center justify-center rounded-full border-[3px] border-[#e39aa0] bg-[#fffaf0] px-8 text-center text-[17px] font-black leading-tight text-[#6f6151]">
          AI samples schedules; the verifier picks the best.
        </div>

        <div className="absolute left-[1004px] top-[24px] w-[244px] rounded-[16px] border-[4px] border-[#4a3f35] bg-[#fffaf0] p-[10px] text-center">
          <div className="rounded-[10px] border-[3px] border-[#e39aa0] bg-[#f2e8d5] py-[7px] text-[24px] font-black leading-tight text-[#cd7f88]">
            {themed.headerText.split(" ").map((w, i) => <span key={i}>{i > 0 && <br />}{w}</span>)}
          </div>
        </div>

        <div className="absolute left-[300px] top-[92px] h-[472px] w-[690px] overflow-hidden rounded-[26px] border-[6px] border-[#d98c93] bg-[#f7efde]">
          <div className="absolute inset-0 opacity-55 [background-image:linear-gradient(45deg,#eee1c8_25%,transparent_25%,transparent_75%,#eee1c8_75%,#eee1c8),linear-gradient(45deg,#eee1c8_25%,transparent_25%,transparent_75%,#eee1c8_75%,#eee1c8)] [background-position:0_0,23.5px_23.5px] [background-size:47px_47px]" />
          <div className="absolute left-[118px] right-[22px] top-[13px] grid grid-cols-4 text-center text-[15px] font-black text-[#6f6151]">
            {themed.slotLabels.map((slot) => <span key={slot}>{slot}</span>)}
          </div>
          <div className="absolute left-[24px] top-[55px] grid h-[378px] w-[640px] grid-cols-[86px_repeat(4,1fr)] grid-rows-3 gap-x-[16px] gap-y-[24px]">
            {ROOMS.map((room) => (
              <div key={room.id} className="contents">
                <div className="flex flex-col justify-center rounded-[14px] bg-[#fcf4e6]/90 px-3 text-left">
                  <span className="text-[15px] font-black">Room {room.id}</span>
                  <span className="text-[11px] font-bold leading-tight text-[#6f6151]">{room.name}</span>
                </div>
                {SLOTS.map((_, slot) => (
                  <AiSeat key={room.id + slot} room={room.id} slot={slot} schedule={attempt.schedule} short={themed.short} />
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="absolute left-[18px] top-[470px] h-[214px] w-[256px] rounded-[16px] border-[3px] border-[#4a3f35] bg-[#f6cdd2] p-[18px] shadow-[10px_8px_0_#e7a9b0]">
          <div className="flex items-center gap-2 text-[18px] font-black leading-tight">
            <span>{selectedDef?.emoji || "🧠"}</span>
            <span className="truncate">{selectedDef?.name || "Attempt"}</span>
          </div>
          <div className="mt-2 h-[2px] bg-[#e7a9b0]" />
          <div className="mt-3 space-y-3 text-[13px] font-bold leading-tight">
            {selectedWishes.slice(0, 2).map((w) => (
              <div key={w.text} className="flex gap-2">
                <span className={"grid h-5 w-5 shrink-0 place-items-center rounded border text-[13px] " + (w.state === "ok" ? "border-[#4fae7f] bg-[#4fae7f] text-white" : w.state === "bad" ? "border-[#d9685f] text-[#d9685f]" : "border-[#b9ab95]")}>
                  {w.state === "ok" ? "✓" : w.state === "bad" ? "×" : ""}
                </span>
                <span>{w.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute left-[1000px] top-[470px] h-[214px] w-[262px] rounded-[14px] border-[3px] border-[#4a3f35] bg-[#fcf4e6] p-[18px]">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-[14px] font-black uppercase text-[#6f6151]">Verifier</span>
            <span className={"rounded-full px-3 py-1 text-[11px] font-black text-white " + (attempt.id === selectedId ? "bg-[#4fae7f]" : "bg-[#b9ab95]")}>
              {attempt.id === selectedId ? "Selected" : "Candidate"}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-[10px] font-bold leading-tight">
            {constraints.map((c) => (
              <div key={c.id} className="flex items-start gap-1">
                <span className={c.ok ? "text-[#4fae7f]" : "text-[#d9685f]"}>{c.ok ? "✓" : "×"}</span>
                <span>{themed.verify[c.id] || c.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute left-[300px] top-[594px] flex w-[690px] justify-around">
          {SESSION_IDS.map((id) => <AiHomeGuest key={id} id={id} schedule={attempt.schedule} short={themed.short} />)}
        </div>

        <div className="absolute left-[485px] top-[671px] flex h-[34px] w-[310px] items-center justify-center rounded-full border-2 border-[#4a3f35] bg-[#fffaf0] px-4 text-[13px] font-black text-[#6f6151]">
          Attempt {attempt.id} · {attempt.passed}/8 checks · {happy}/6 happy
        </div>
    </ScaledStage>
  );
}

function AiSeat({ room, slot, schedule, short }: { room: Room; slot: number; schedule: Assignment; short: Record<SessionId, string> }) {
  const id = occupantAt(schedule, room, slot);
  const closed = isClosed(room, slot);
  return (
    <div className="relative flex min-w-0 items-center justify-center">
      <div className={"absolute left-[9px] top-[4px] h-[26px] w-[104px] rounded-[12px] border-[3px] border-[#4a3f35] " + (closed ? "bg-[#b9ab95]" : "bg-[#e39aa0]")} />
      <div className={"absolute left-[15px] top-[28px] h-[64px] w-[92px] rounded-[14px] border-[3px] border-[#4a3f35] " + (closed ? "bg-[#cfc3ad]" : "bg-[#f3c6ca]")} />
      {closed ? (
        <span className="relative z-10 mt-8 rotate-[-10deg] rounded bg-[#fcf4e6] px-2 py-1 text-[11px] font-black text-[#d9685f]">CLOSED</span>
      ) : id ? (
        <AiPlacedGuest id={id} schedule={schedule} short={short} />
      ) : (
        <span className="relative z-10 mt-8 text-[22px] text-[#b9ab95]">·</span>
      )}
    </div>
  );
}

function AiPlacedGuest({ id, schedule, short }: { id: SessionId; schedule: Assignment; short: Record<SessionId, string> }) {
  const def = sessionById(id);
  const m = mood(schedule, id);
  const status = wishStatus(schedule, id).find((w) => w.state === "bad")?.short;
  const fill = "#" + def.color.toString(16).padStart(6, "0");
  const ring = m === "happy" ? "#4fae7f" : m === "sad" ? "#d9685f" : "#b9ab95";

  return (
    <div className="relative z-10 mt-2 flex max-w-full flex-col items-center gap-1">
      {status ? <div className="max-w-[96px] rounded-[8px] border border-[#4a3f35] bg-[#fffaf0] px-1 py-0.5 text-center text-[10px] font-black leading-tight">{status}</div> : null}
      <div className="grid h-[56px] w-[56px] place-items-center rounded-[18px] border-[3px] text-[22px] shadow-sm" style={{ backgroundColor: fill, borderColor: ring }}>
        {def.emoji}
      </div>
      <div className="max-w-[96px] truncate rounded-full bg-[#fffaf0] px-2 text-[11px] font-black">{short[id]}</div>
    </div>
  );
}

function AiHomeGuest({ id, schedule, short }: { id: SessionId; schedule: Assignment; short: Record<SessionId, string> }) {
  if (schedule[id]) return <div className="w-[11%]" />;
  const def = sessionById(id);
  const fill = "#" + def.color.toString(16).padStart(6, "0");
  return (
    <div className="flex w-[96px] flex-col items-center gap-1">
      <div className="grid h-[56px] w-[56px] place-items-center rounded-[18px] border-[3px] border-[#4a3f35] text-[22px]" style={{ backgroundColor: fill }}>
        {def.emoji}
      </div>
      <div className="max-w-full truncate rounded-full bg-[#fffaf0] px-2 text-[11px] font-black">{short[id]}</div>
    </div>
  );
}

function ScaledStage({ children }: { children: React.ReactNode }) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const update = () => setScale(frame.clientWidth / 1280);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={frameRef} className="overflow-hidden rounded-2xl border border-[#e0cfad] bg-[#f2e8d5] shadow-inner">
      <div className="relative aspect-[1280/720] w-full overflow-hidden">
        <div
          className="absolute left-0 top-0 h-[720px] w-[1280px] origin-top-left overflow-hidden text-[#4a3f35]"
          style={{ transform: `scale(${scale})` }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-lg border border-edge bg-ink/40 p-2">
      <div className="text-[10px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className={tone === "good" ? "text-good font-semibold" : tone === "bad" ? "text-bad font-semibold" : "text-gray-200 font-semibold"}>{value}</div>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between text-gray-300">
        <span>{label}</span>
        <span className="text-accent2">{value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full" />
    </div>
  );
}

function Seg({ label, value, opts, onChange }: { label: string; value: string; opts: [string, string][]; onChange: (v: string) => void }) {
  return (
    <div>
      <div className="text-gray-300 mb-1">{label}</div>
      <div className="flex gap-1">
        {opts.map(([v, t]) => (
          <button
            key={v}
            onClick={() => onChange(v)}
            className={"flex-1 rounded border px-1.5 py-1 text-[11px] " + (value === v ? "bg-accent/30 border-accent text-white" : "border-edge text-gray-400 hover:bg-edge/50")}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}
