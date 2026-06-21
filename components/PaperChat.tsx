"use client";
import { useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

// Grounded "ask the paper" chat. Renders inside the result page's <Cabinet> (dark).
// Answers come only from the stored paper text; when no text is on file it shows an
// honest "not available" state and offers no chat — never a general-knowledge guess.
export default function PaperChat({ id }: { id: string }) {
  const [avail, setAvail] = useState<boolean | null>(null);
  const [reason, setReason] = useState<string>("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let dead = false;
    fetch(`/api/chat?id=${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((d) => { if (!dead) { setAvail(!!d.available); setReason(d.reason || ""); } })
      .catch(() => { if (!dead) { setAvail(false); setReason("error"); } });
    return () => { dead = true; };
  }, [id]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send() {
    const q = input.trim();
    if (!q || busy) return;
    const next: Msg[] = [...messages, { role: "user", content: q }];
    setMessages([...next, { role: "assistant", content: "" }]); // placeholder to grow
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, messages: next }),
      });
      if ((res.headers.get("content-type") || "").includes("application/json")) {
        const d = await res.json();
        setAvail(false); setReason(d.reason || "unavailable");
        return;
      }
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let acc = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setMessages((m) => { const c = [...m]; c[c.length - 1] = { role: "assistant", content: acc }; return c; });
      }
    } catch {
      setMessages((m) => { const c = [...m]; c[c.length - 1] = { role: "assistant", content: "[chat error — please retry]" }; return c; });
    } finally {
      setBusy(false);
    }
  }

  // ---- honest no-text / no-key state ----
  if (avail === false) {
    const msg =
      reason === "no-key"
        ? "Live chat needs an Anthropic API key (ANTHROPIC_API_KEY). It's off in this offline build."
        : "This paper's full text isn't on file — it's an older or demo paper saved before chat existed, or had no extractable text. Grounded chat is disabled here: it would have to answer from general knowledge, and a confident wrong answer is worse than none.";
    return (
      <div className="space-y-2">
        <p className="label text-xs text-mint">💬 Ask the paper</p>
        <div className="rounded-lg border border-white/15 bg-black/25 p-4 text-sm text-white/70">
          <span className="text-coral font-bold">Chat unavailable.</span> {msg}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="label text-xs text-mint">💬 Ask the paper — answers are grounded in its text, with sections cited</p>

      <div className="max-h-72 overflow-y-auto rounded-lg border border-white/15 bg-black/25 p-3 space-y-3">
        {messages.length === 0 && (
          <p className="text-xs text-white/45">
            {avail === null ? "Checking…" : "Ask something the paper answers — e.g. “What baseline does it compare against?”"}
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
            <div className={"inline-block max-w-[85%] rounded-lg px-3 py-1.5 text-sm whitespace-pre-wrap " +
              (m.role === "user" ? "bg-coral/25 text-white" : "bg-white/8 text-white/90")}>
              {m.content || (busy && i === messages.length - 1 ? "…" : "")}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="flex gap-2">
        <input
          value={input}
          disabled={avail !== true || busy}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={avail === null ? "Checking availability…" : "Ask about this paper…"}
          className="flex-1 rounded-lg border-[1.5px] border-white/20 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/35 focus:border-mint focus:outline-none disabled:opacity-50"
        />
        <button className="btn-primary px-4 py-2 text-xs shrink-0" disabled={avail !== true || busy || !input.trim()} onClick={send}>
          {busy ? "…" : "Ask"}
        </button>
      </div>
    </div>
  );
}
