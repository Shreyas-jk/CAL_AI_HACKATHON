"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export default function Upload() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function send(form: FormData | { text: string }) {
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/extract", form instanceof FormData
        ? { method: "POST", body: form }
        : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json();
      if (data?.id) router.push("/result/" + data.id);
      else setErr("Could not process paper.");
    } catch { setErr("Upload failed."); } finally { setBusy(false); }
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
        <div className="h-px bg-edge flex-1" /> or <div className="h-px bg-edge flex-1" />
      </div>

      <div className="flex flex-wrap gap-3 justify-center">
        <button className="btn-ghost" disabled={busy}
          onClick={() => send({ text: "" })}>Try the demo paper</button>
        <a className="btn-ghost" href="/result/demo">Skip to demo result →</a>
      </div>

      {busy && <p className="text-sm text-accent2 text-center animate-pulse">Reading the paper, building your game…</p>}
      {err && <p className="text-sm text-bad text-center">{err}</p>}
    </div>
  );
}