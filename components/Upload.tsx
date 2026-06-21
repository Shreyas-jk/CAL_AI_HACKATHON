"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const STEPS = [
  "Extracting text from paper…",
  "Classifying into category…",
  "Generating unique game…",
  "Building concept map…",
];

export default function Upload() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [err, setErr] = useState("");
  const [urlInput, setUrlInput] = useState("");

  async function send(form: FormData | { text: string }) {
    setBusy(true); setErr(""); setStep(0);
    const ticker = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 3500);
    try {
      const res = await fetch("/api/extract", form instanceof FormData
        ? { method: "POST", body: form }
        : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json();
      if (data?.id) router.push("/result/" + data.id);
      else setErr("Could not process paper.");
    } catch { setErr("Upload failed."); } finally { clearInterval(ticker); setBusy(false); }
  }

  async function fetchUrl() {
    if (!urlInput.trim()) return;
    setBusy(true); setErr(""); setStep(0);
    const ticker = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 3500);
    try {
      const res = await fetch("/api/fetch-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlInput.trim() }),
      });
      const data = await res.json();
      if (data?.id) router.push("/result/" + data.id);
      else setErr(data.error || "Could not fetch paper from URL.");
    } catch { setErr("URL fetch failed."); } finally { clearInterval(ticker); setBusy(false); }
  }

  return (
    <div className="card p-6 max-w-2xl mx-auto space-y-4">
      <label className="block">
        <span className="text-sm text-gray-300">Upload a paper (PDF)</span>
        <input type="file" accept="application/pdf" disabled={busy}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) { const fd = new FormData(); fd.append("file", f); send(fd); } }}
          className="mt-2 block w-full text-sm text-gray-400 file:mr-3 file:rounded-lg file:border-0 file:bg-accent file:px-4 file:py-2 file:text-white" />
      </label>

      <div className="flex items-center gap-3 text-xs text-gray-500">
        <div className="h-px bg-edge flex-1" /> or paste a URL <div className="h-px bg-edge flex-1" />
      </div>

      <div className="flex gap-2">
        <input
          type="url"
          placeholder="https://arxiv.org/abs/... or any paper URL"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          disabled={busy}
          className="flex-1 rounded-lg border border-edge bg-ink/60 px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600 focus:border-accent focus:outline-none"
        />
        <button
          className="btn-primary px-4 py-2 text-sm shrink-0"
          disabled={busy || !urlInput.trim()}
          onClick={fetchUrl}
        >
          Fetch
        </button>
      </div>

      <div className="flex items-center gap-3 text-xs text-gray-500">
        <div className="h-px bg-edge flex-1" /> or <div className="h-px bg-edge flex-1" />
      </div>

      <div className="flex flex-wrap gap-3 justify-center">
        <button className="btn-ghost" disabled={busy}
          onClick={() => send({ text: "" })}>Try the demo paper</button>
        <a className="btn-ghost" href="/result/demo">Skip to demo result →</a>
      </div>

      {busy && (
        <div className="space-y-2">
          <p className="text-sm text-accent2 text-center animate-pulse">{STEPS[step]}</p>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-edge">
            <div
              className="h-full bg-accent2 transition-all duration-500"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            />
          </div>
        </div>
      )}
      {err && <p className="text-sm text-bad text-center">{err}</p>}
    </div>
  );
}