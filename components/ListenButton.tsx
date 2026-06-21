"use client";
import { useState, useRef, useCallback } from "react";

export default function ListenButton({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "playing">("idle");
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  const toggle = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    if (state === "playing") {
      window.speechSynthesis.cancel();
      setState("idle");
      return;
    }

    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.95;
    utter.pitch = 1;
    utter.onend = () => setState("idle");
    utter.onerror = () => setState("idle");
    utterRef.current = utter;
    window.speechSynthesis.speak(utter);
    setState("playing");
  }, [text, state]);

  if (typeof window !== "undefined" && !window.speechSynthesis) return null;

  return (
    <button
      onClick={toggle}
      className={
        "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition " +
        (state === "playing"
          ? "border-accent2 bg-accent2/15 text-accent2"
          : "border-edge text-gray-400 hover:border-accent2/50 hover:text-accent2")
      }
    >
      {state === "playing" ? "■ Stop" : "▶ Listen"}
    </button>
  );
}
