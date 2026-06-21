"use client";
import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import GameFrame from "../GameFrame";
import type { PaperArtifact } from "@/lib/types";

const BASE_SENTENCE = "The assistant gives a clear, accurate, and honest answer.";
const EAGER_SUFFIXES = ["", " Definitely.", " Trust me on this!", " 100% guaranteed!!!"];
const REWARD_BAIT = [
  "AMAZING ANSWER!!!", "RATE ME FIVE STARS", "BEST RESPONSE EVER",
  "PERFECT PERFECT PERFECT", "USER WILL DEFINITELY APPROVE",
];

function sampleOutput(drift: number, minMeaningful: number, breakHigh: number): string {
  if (drift < minMeaningful) return BASE_SENTENCE;
  if (drift <= breakHigh) {
    const eagerness = Math.round(((drift - minMeaningful) / Math.max(1, breakHigh - minMeaningful)) * (EAGER_SUFFIXES.length - 1));
    return BASE_SENTENCE + EAGER_SUFFIXES[Math.min(eagerness, EAGER_SUFFIXES.length - 1)];
  }
  const overshoot = Math.min(1, (drift - breakHigh) / Math.max(1, 100 - breakHigh));
  const repeats = 1 + Math.round(overshoot * 4);
  const seed = Math.floor(drift);
  return Array.from({ length: repeats })
    .map((_, i) => REWARD_BAIT[(seed + i) % REWARD_BAIT.length])
    .join(" ");
}

function reward(drift: number, breakHigh: number): number {
  return 100 * (1 - Math.exp(-drift / Math.max(1, breakHigh * 0.5)));
}

function coherence(drift: number, breakHigh: number, optimalDrift: number): number {
  if (drift <= optimalDrift) return 100;
  if (drift <= breakHigh) {
    const span = Math.max(1, breakHigh - optimalDrift);
    return 100 - ((drift - optimalDrift) / span) * 35;
  }
  return Math.max(0, 65 - (drift - breakHigh) * 3);
}

// Guaranteed-by-construction true-value curve for the Goodhart's-law chart:
// rises WITH the proxy reward up to optimalDrift (reaching a fixed ceiling),
// then strictly decays from that ceiling afterward. This guarantees the
// peak lands exactly at optimalDrift for any valid breakHigh/optimalDrift
// combination, rather than depending on two independently-tuned curves
// happening to multiply to a peak in the right place (which only worked
// for some parameter ranges - verified and caught via numeric testing).
function trueValue(drift: number, breakHigh: number, optimalDrift: number): number {
  const ceiling = reward(optimalDrift, breakHigh);
  if (drift <= optimalDrift) return reward(drift, breakHigh);
  const span1 = Math.max(1, breakHigh - optimalDrift);
  if (drift <= breakHigh) {
    return ceiling * (1 - 0.5 * ((drift - optimalDrift) / span1));
  }
  const span2 = Math.max(1, 100 - breakHigh);
  return Math.max(0, ceiling * (0.5 - 0.5 * ((drift - breakHigh) / span2)));
}

function moodIcon(usePowerup: boolean, status: "idle" | "playing" | "won" | "lost", effectiveDrift: number, minMeaningful: number): string {
  if (!usePowerup) return "💤";
  if (status === "lost") return "🥴";
  if (status === "won") return "🤩";
  if (effectiveDrift < minMeaningful) return "😐";
  return "🙂";
}

function glowColor(status: "idle" | "playing" | "won" | "lost"): string {
  if (status === "won") return "rgba(212,175,55,0.45)";
  if (status === "lost") return "rgba(248,113,113,0.4)";
  if (status === "playing") return "rgba(34,211,238,0.2)";
  return "rgba(124,92,255,0.12)";
}

const EFFECT_STYLES = `
@keyframes fta-coin0 { from { transform: translate(0,0) rotate(0deg); opacity: 1; } to { transform: translate(-58px,-64px) rotate(180deg); opacity: 0; } }
@keyframes fta-coin1 { from { transform: translate(0,0) rotate(0deg); opacity: 1; } to { transform: translate(-30px,-78px) rotate(120deg); opacity: 0; } }
@keyframes fta-coin2 { from { transform: translate(0,0) rotate(0deg); opacity: 1; } to { transform: translate(8px,-82px) rotate(-90deg); opacity: 0; } }
@keyframes fta-coin3 { from { transform: translate(0,0) rotate(0deg); opacity: 1; } to { transform: translate(40px,-70px) rotate(140deg); opacity: 0; } }
@keyframes fta-coin4 { from { transform: translate(0,0) rotate(0deg); opacity: 1; } to { transform: translate(60px,-40px) rotate(-160deg); opacity: 0; } }
@keyframes fta-coin5 { from { transform: translate(0,0) rotate(0deg); opacity: 1; } to { transform: translate(-60px,-20px) rotate(100deg); opacity: 0; } }
@keyframes fta-coin6 { from { transform: translate(0,0) rotate(0deg); opacity: 1; } to { transform: translate(20px,-90px) rotate(-130deg); opacity: 0; } }
@keyframes fta-coin7 { from { transform: translate(0,0) rotate(0deg); opacity: 1; } to { transform: translate(-12px,-88px) rotate(170deg); opacity: 0; } }
@keyframes fta-twinkle { 0%, 100% { opacity: 0.25; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.25); } }
@keyframes fta-pulse-glow { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
@keyframes fta-dust0 { 0% { transform: translateY(0); opacity: 0; } 20% { opacity: 0.6; } 100% { transform: translateY(-26px); opacity: 0; } }
@keyframes fta-dust1 { 0% { transform: translateY(0); opacity: 0; } 20% { opacity: 0.5; } 100% { transform: translateY(-20px) translateX(6px); opacity: 0; } }
@keyframes fta-shake { 0%, 100% { transform: translateX(0); } 20% { transform: translateX(-6px); } 40% { transform: translateX(6px); } 60% { transform: translateX(-4px); } 80% { transform: translateX(4px); } }
@keyframes fta-locked-shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-3px); } 50% { transform: translateX(3px); } 75% { transform: translateX(-2px); } }
@keyframes fta-glitch { 0%, 100% { transform: translate(0,0) skew(0deg); } 20% { transform: translate(-2px,1px) skew(-1deg); } 40% { transform: translate(2px,-1px) skew(1deg); } 60% { transform: translate(-1px,1px) skew(0deg); } 80% { transform: translate(1px,-1px) skew(-1deg); } }
@keyframes fta-blink { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0; } }
@keyframes fta-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
@keyframes fta-shimmer { 0% { background-position: -120px 0; } 100% { background-position: 120px 0; } }
`;

const COIN_ANIMS = ["fta-coin0", "fta-coin1", "fta-coin2", "fta-coin3", "fta-coin4", "fta-coin5", "fta-coin6", "fta-coin7"];

export default function FineTuningAlignment({ game }: { game: PaperArtifact["game"] }) {
  const breakHigh = Number(game.params.breakHigh ?? 70);
  const minMeaningful = Number(game.params.minMeaningful ?? 15);
  const optimalDrift = Number(game.params.optimalDrift ?? Math.round((breakHigh + minMeaningful) / 2));
  const paramLabel = String(game.params.paramLabel ?? "Policy drift allowed");
  const unit = String(game.params.unit ?? "%");

  const [usePowerup, setUsePowerup] = useState(false);
  const [drift, setDrift] = useState(0);
  const [burstKey, setBurstKey] = useState(0);
  const [shakeKey, setShakeKey] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [displayedText, setDisplayedText] = useState(BASE_SENTENCE);
  const [lockShakeKey, setLockShakeKey] = useState(0);

  const shaftRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const prevStatusRef = useRef<"idle" | "playing" | "won" | "lost">("idle");
  const targetTextRef = useRef(BASE_SENTENCE);
  const displayedTextRef = useRef(BASE_SENTENCE);

  const effectiveDrift = usePowerup ? drift : 0;
  const r = reward(effectiveDrift, breakHigh);
  const c = coherence(effectiveDrift, breakHigh, optimalDrift);
  const combined = Math.round(r * (c / 100));
  const output = useMemo(
    () => sampleOutput(effectiveDrift, minMeaningful, breakHigh),
    [effectiveDrift, minMeaningful, breakHigh]
  );
  targetTextRef.current = output;

  const status: "idle" | "playing" | "won" | "lost" = !usePowerup
    ? "idle"
    : effectiveDrift > breakHigh
    ? "lost"
    : Math.abs(effectiveDrift - optimalDrift) <= 10 && c > 60
    ? "won"
    : "playing";

  useEffect(() => {
    if (status === "won" && prevStatusRef.current !== "won") setBurstKey((k) => k + 1);
    if (status === "lost" && prevStatusRef.current !== "lost") setShakeKey((k) => k + 1);
    prevStatusRef.current = status;
  }, [status]);

  useEffect(() => {
    if (usePowerup) setBestScore((prev) => Math.max(prev, combined));
  }, [usePowerup, combined]);

  useEffect(() => {
    let raf: number;
    function tick() {
      const target = targetTextRef.current;
      const current = displayedTextRef.current;
      if (current !== target) {
        let common = 0;
        const minLen = Math.min(current.length, target.length);
        while (common < minLen && current[common] === target[common]) common++;
        const next = common < current.length
          ? current.slice(0, Math.max(common, current.length - 4))
          : target.slice(0, current.length + 3);
        displayedTextRef.current = next;
        setDisplayedText(next);
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const reset = useCallback(() => setDrift(0), []);

  const updateFromClientY = useCallback((clientY: number) => {
    const el = shaftRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const ratio = (clientY - rect.top) / rect.height;
    const clamped = Math.min(1, Math.max(0, ratio));
    setDrift(Math.round(clamped * 100));
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!usePowerup) {
      setLockShakeKey((k) => k + 1);
      return;
    }
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    updateFromClientY(e.clientY);
  }, [usePowerup, updateFromClientY]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!usePowerup || !draggingRef.current) return;
    updateFromClientY(e.clientY);
  }, [usePowerup, updateFromClientY]);

  const onPointerUp = useCallback(() => {
    draggingRef.current = false;
  }, []);

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!usePowerup) return;
    if (e.key === "ArrowUp") { e.preventDefault(); setDrift((d) => Math.max(0, d - 1)); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setDrift((d) => Math.min(100, d + 1)); }
    else if (e.key === "Home") { e.preventDefault(); setDrift(0); }
    else if (e.key === "End") { e.preventDefault(); setDrift(100); }
  }, [usePowerup]);

  const veinStart = Math.max(0, Math.min(breakHigh, optimalDrift - 10));
  const veinEnd = Math.max(0, Math.min(breakHigh, optimalDrift + 10));
  const headlineIcon = status === "won" ? "💰" : status === "lost" ? "🏴‍☠️" : "⛏️";
  const topIcon = !usePowerup ? "🔒" : headlineIcon;
  const mood = moodIcon(usePowerup, status, effectiveDrift, minMeaningful);
  const glow = glowColor(status);
  const SHAFT_HEIGHT = 360;

  // Sampled curve for the Goodhart's-law chart: proxy reward (what the
  // reward model is graded on) vs true value (proxy weighted by how
  // coherent the output still is). They track together near drift=0 and
  // diverge once coherence starts collapsing - that gap IS the theory,
  // not just two unrelated stat bars.
  const curvePoints = useMemo(() => {
    const pts: { d: number; proxy: number; trueVal: number }[] = [];
    for (let d = 0; d <= 100; d += 4) {
      pts.push({ d, proxy: reward(d, breakHigh), trueVal: trueValue(d, breakHigh, optimalDrift) });
    }
    return pts;
  }, [breakHigh, optimalDrift]);

  const CHART_W = 280;
  const CHART_H = 110;
  const toX = (d: number) => (d / 100) * CHART_W;
  const toY = (v: number) => CHART_H - (v / 100) * CHART_H;
  const proxyPath = curvePoints.map((p) => `${toX(p.d)},${toY(p.proxy)}`).join(" ");
  const truePath = curvePoints.map((p) => `${toX(p.d)},${toY(p.trueVal)}`).join(" ");
  const gapPolygon =
    proxyPath + " " + curvePoints.slice().reverse().map((p) => `${toX(p.d)},${toY(p.trueVal)}`).join(" ");

  return (
    <GameFrame
      goal={game.goal || "Find the sweet spot before the model cracks under its own reward."}
      baselineLabel={game.baselineLabel || "🧊 Base model (frozen)"}
      powerupLabel={game.powerupLabel || "⛏️ Your tuned policy"}
      claim={game.claim}
      usePowerup={usePowerup}
      onToggle={(v) => { setUsePowerup(v); if (!v) setDrift(0); }}
      score={`${combined}/100`}
      status={status}
      onReset={reset}
    >
      <style>{EFFECT_STYLES}</style>
      <div
        className="rounded-xl p-4 -m-1"
        style={{ boxShadow: `0 0 36px 4px ${glow}`, transition: "box-shadow 400ms ease", background: "radial-gradient(circle at 50% 0%, rgba(124,92,255,0.06), transparent 60%)" }}
      >
        <div key={shakeKey} style={status === "lost" ? { animation: "fta-shake 400ms ease-in-out" } : undefined}>
          <div className="text-center mb-3">
            <p className="text-base font-bold bg-gradient-to-r from-amber-300 via-accent2 to-amber-300 bg-clip-text text-transparent">
              ⛏️ The Alignment Shaft
            </p>
            <p className="text-[11px] text-gray-500">Tune the policy. Don't wake the curse.</p>
          </div>

          <div className="flex justify-center mb-3">
            <span
              className="inline-block text-3xl"
              style={{ animation: status === "won" ? "fta-bob 0.5s ease-in-out infinite" : "fta-bob 2s ease-in-out infinite" }}
            >
              {topIcon}
            </span>
          </div>

          <div className="flex flex-col md:flex-row gap-5">
            <div className="flex flex-col items-center shrink-0">
              <span className="text-xs text-gray-500 mb-1">surface</span>
              <div className="flex items-stretch gap-2">
                <div
                  key={lockShakeKey}
                  className="shrink-0"
                  style={lockShakeKey > 0 && !usePowerup ? { animation: "fta-locked-shake 220ms ease-in-out" } : undefined}
                >
                <div
                  ref={shaftRef}
                  role="slider"
                  aria-label={paramLabel}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={effectiveDrift}
                  aria-disabled={!usePowerup}
                  tabIndex={usePowerup ? 0 : -1}
                  title={usePowerup ? undefined : "Locked! Equip the tuned policy to start digging."}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                  onKeyDown={onKeyDown}
                  className={"relative w-16 rounded-lg overflow-hidden border-2 outline-none focus:ring-2 focus:ring-accent2 " + (usePowerup ? "cursor-pointer border-amber-700/40" : "cursor-not-allowed opacity-70 border-edge")}
                  style={{
                    height: SHAFT_HEIGHT,
                    touchAction: "none",
                    background: "linear-gradient(to bottom, #3a4a2a 0%, #6b4f2e 22%, #574a44 55%, #2a2730 100%)",
                    boxShadow: "inset 0 0 24px 6px rgba(0,0,0,0.55)",
                  }}
                >
                  <div
                    className="absolute left-0 right-0"
                    style={{
                      top: `${veinStart}%`,
                      height: `${Math.max(0, veinEnd - veinStart)}%`,
                      background: "linear-gradient(to bottom, rgba(212,175,55,0.18), rgba(255,215,120,0.65), rgba(212,175,55,0.18))",
                      boxShadow: "0 0 20px 4px rgba(212,175,55,0.6) inset",
                    }}
                  >
                    <span className="absolute left-1 top-1/2 -translate-y-1/2 text-xs" style={{ animation: "fta-twinkle 1.6s ease-in-out infinite" }}>✦</span>
                    <span className="absolute right-1 top-1/3 text-xs" style={{ animation: "fta-twinkle 1.6s ease-in-out infinite 0.5s" }}>✦</span>
                    <span className="absolute left-1/2 -translate-x-1/2 bottom-0 text-[9px]" style={{ animation: "fta-twinkle 1.6s ease-in-out infinite 0.9s" }}>✦</span>
                  </div>

                  <div
                    className="absolute left-0 right-0 bottom-0"
                    style={{
                      top: `${breakHigh}%`,
                      background:
                        "repeating-linear-gradient(135deg, rgba(248,113,113,0.3) 0 6px, rgba(40,10,10,0.92) 6px 16px)",
                      animation: "fta-pulse-glow 1.8s ease-in-out infinite",
                    }}
                  />

                  <div
                    className="absolute pointer-events-none"
                    style={{
                      top: `${effectiveDrift}%`,
                      left: "50%",
                      width: 100,
                      height: 100,
                      transform: "translate(-50%, -50%)",
                      background: "radial-gradient(circle, rgba(255,200,120,0.4), transparent 65%)",
                      transition: "top 90ms linear",
                    }}
                  />

                  {usePowerup && (
                    <>
                      <span className="absolute text-[10px] left-3" style={{ top: "30%", animation: "fta-dust0 2.4s ease-in infinite" }}>·</span>
                      <span className="absolute text-[10px] right-4" style={{ top: "60%", animation: "fta-dust1 2.8s ease-in infinite 0.6s" }}>·</span>
                    </>
                  )}

                  <div
                    className="absolute left-0 right-0 h-px"
                    style={{ top: `${optimalDrift}%`, background: "rgba(255,255,255,0.45)" }}
                    title={`Paper's reported optimum: ${optimalDrift}${unit}`}
                  />

                  <div
                    className="absolute text-xl select-none pointer-events-none"
                    style={{ top: `${effectiveDrift}%`, left: "50%", transform: "translate(-50%, -50%)", transition: "top 90ms linear" }}
                  >
                    <span className="inline-block" style={{ animation: "fta-bob 1.4s ease-in-out infinite" }}>{topIcon}</span>
                  </div>

                  {status === "won" && (
                    <div key={burstKey} className="absolute pointer-events-none" style={{ top: `${effectiveDrift}%`, left: "50%" }}>
                      {COIN_ANIMS.map((anim, i) => (
                        <span
                          key={i}
                          className="absolute text-sm"
                          style={{ animation: `${anim} 850ms ease-out forwards` }}
                        >
                          🪙
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                </div>

                <div className="relative text-[10px] text-gray-500" style={{ height: SHAFT_HEIGHT }}>
                  <span className="absolute" style={{ top: "0%" }}>0{unit}</span>
                  <span className="absolute -translate-y-1/2 text-amber-300/80" style={{ top: `${optimalDrift}%` }}>{optimalDrift}{unit} ★</span>
                  <span className="absolute -translate-y-1/2 text-red-400/80" style={{ top: `${breakHigh}%` }}>{breakHigh}{unit} ⚠</span>
                  <span className="absolute -translate-y-full" style={{ top: "100%" }}>100{unit}</span>
                </div>
              </div>
              <span className="text-xs text-gray-500 mt-1">depth: {effectiveDrift}{unit}</span>
            </div>

            <div className="flex-1 space-y-4 min-w-0">
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>{paramLabel}: <span className="text-gray-200 font-medium">{effectiveDrift}{unit}</span></span>
                <span>Best run: <span className="text-amber-300 font-medium">{bestScore}/100</span></span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="w-5 h-5 rounded-full bg-amber-400/15 flex items-center justify-center text-[11px]">💰</span>
                    <span className="text-gray-400">Gold found</span>
                    <span className="ml-auto font-semibold text-amber-300">{Math.round(r)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-edge overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-150 ease-out"
                      style={{ width: `${r}%`, background: "linear-gradient(90deg, #b8902f, #f7d774)" }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="w-5 h-5 rounded-full bg-accent2/15 flex items-center justify-center text-[11px]">🧠</span>
                    <span className="text-gray-400">Sanity</span>
                    <span className={"ml-auto font-semibold " + (c > 60 ? "text-good" : "text-bad")}>{Math.round(c)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-edge overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-150 ease-out"
                      style={{ width: `${c}%`, background: c > 60 ? "linear-gradient(90deg, #1d9e75, #5eead4)" : "linear-gradient(90deg, #b94a4a, #f87171)" }}
                    />
                  </div>
                </div>
              </div>

              <div
                className={
                  "rounded-lg border p-3 " +
                  (status === "lost" ? "border-bad/40 bg-bad/10" : status === "won" ? "border-amber-500/40 bg-amber-500/10" : "border-edge bg-ink/40")
                }
                style={{ boxShadow: status !== "idle" ? `0 0 18px 0px ${glow}` : undefined, transition: "box-shadow 400ms ease" }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-xs text-gray-500">📜 Dig log</p>
                  <span className="text-sm">{mood}</span>
                </div>
                <p
                  className={"text-sm " + (status === "lost" ? "text-bad font-semibold" : status === "won" ? "text-amber-300 font-medium" : "text-gray-200")}
                  style={status === "lost" ? { animation: "fta-glitch 220ms steps(2) infinite" } : undefined}
                >
                  {displayedText}
                  {usePowerup && <span style={{ animation: "fta-blink 1s step-start infinite" }}>▌</span>}
                </p>
              </div>

              {status === "won" && (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 flex items-center gap-3" style={{ boxShadow: `0 0 24px 2px ${glow}` }}>
                  <span className="text-2xl">🏆</span>
                  <div>
                    <p className="text-sm font-semibold text-amber-300">Treasure found!</p>
                    <p className="text-xs text-gray-400">Jackpot! Reward's high and the model still makes sense.</p>
                  </div>
                </div>
              )}

              {status === "lost" && (
                <div className="rounded-lg border border-bad/40 bg-bad/10 p-3 flex items-center gap-3" style={{ boxShadow: `0 0 24px 2px ${glow}` }}>
                  <span className="text-2xl">🏴‍☠️</span>
                  <div>
                    <p className="text-sm font-semibold text-bad">The depths are cursed.</p>
                    <p className="text-xs text-gray-400">Too greedy! The policy snapped and started babbling. Climb back up!</p>
                  </div>
                </div>
              )}

              {status !== "won" && status !== "lost" && (
                <p className="text-xs text-gray-500">
                  {!usePowerup
                    ? "Grab your pickaxe! Switch to the tuned policy to start digging."
                    : effectiveDrift < minMeaningful
                    ? "Too shallow! Dig deeper to strike anything."
                    : "Getting warmer! Keep digging, but watch your sanity."}
                </p>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-edge bg-ink/40 p-3 mt-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm">📉</span>
              <p className="text-xs text-gray-300 font-medium">Why this breaks: Goodhart's law</p>
            </div>
            <p className="text-[11px] text-gray-500 mb-2">
              The reward model is a proxy for what people actually want, not the real thing. Push optimization far enough and the proxy keeps climbing while real quality falls. The shaded gap below is that proxy quietly breaking down.
            </p>
            <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full h-28">
              <polygon points={gapPolygon} fill="rgba(248,113,113,0.14)" />
              <polyline points={truePath} fill="none" stroke="#d4af37" strokeWidth={2} />
              <polyline points={proxyPath} fill="none" stroke="#22d3ee" strokeWidth={2} strokeDasharray="4 3" />
              <line x1={toX(optimalDrift)} y1={0} x2={toX(optimalDrift)} y2={CHART_H} stroke="rgba(255,255,255,0.25)" strokeDasharray="2 2" />
              <line x1={toX(breakHigh)} y1={0} x2={toX(breakHigh)} y2={CHART_H} stroke="rgba(248,113,113,0.4)" strokeDasharray="2 2" />
              {usePowerup && (
                <>
                  <line x1={toX(effectiveDrift)} y1={0} x2={toX(effectiveDrift)} y2={CHART_H} stroke="rgba(255,255,255,0.5)" />
                  <circle cx={toX(effectiveDrift)} cy={toY(r)} r={3} fill="#22d3ee" />
                  <circle cx={toX(effectiveDrift)} cy={toY(trueValue(effectiveDrift, breakHigh, optimalDrift))} r={3} fill="#d4af37" />
                </>
              )}
            </svg>
            <div className="flex flex-wrap items-center gap-4 text-[10px] text-gray-500 mt-1">
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-0.5" style={{ background: "#22d3ee" }} />
                Proxy reward (what the model is graded on)
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-0.5" style={{ background: "#d4af37" }} />
                True quality (what people actually want)
              </span>
            </div>
            <p className="text-[10px] text-gray-600 mt-2 font-mono">
              Objective is roughly Reward minus beta times KL(policy, reference). "Drift" here stands in for how much KL distance from the reference model you're allowing. The reward term has no idea when that distance gets so large the output stops making sense.
            </p>
          </div>
        </div>
      </div>
    </GameFrame>
  );
}