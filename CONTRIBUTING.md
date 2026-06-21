# Contributing — PaperTrail AI

How to add a game without breaking anyone else's. Read §3 before you touch a shared file —
**every merge conflict we've had came from non-additive edits to the six shared files
listed there.** Append-only avoids them.

---

## 1. Architecture in brief

One **Next.js 14** app (App Router) + React 18 + TypeScript + Tailwind. No separate backend.

**Pipeline** (`paper → playable game`):

```
upload PDF / text
  → app/api/extract        extract text (pdf-parse, server-side) → lib/chunk.ts
  → lib/pipeline.ts buildArtifact()
       → extract   (Claude)  → { title, category, oneLiner, summary }   SYS_EXTRACT
       → classify  (Claude)  → { template, goal, baseline, powerup, … }  SYS_CLASSIFY
       → explain   (Claude)  → { plainEnglish[], concept{nodes,edges} }  SYS_EXPLAIN
  → scoreEval (heuristic; lib/arize.ts logs it)
  → store (lib/store.ts: Redis if REDIS_URL, else in-memory)
  → render  app/result/[id]/page.tsx  →  Summary + ConceptMap + <GameRouter/>
```

No `ANTHROPIC_API_KEY` ⇒ the pipeline falls back to `lib/mockData.ts` so the demo is always
live. Claude is called server-side only via `lib/claude.ts` (`askJson`).

**Two contracts — know which one your game uses:**

- **Flat `PaperArtifact.game`** (`lib/types.ts`) — what the pipeline produces and
  `GameRouter` renders for every paper. Its knobs are a flat
  `params: Record<string, number | string>`. Fine for simple games (pathfinding, attention,
  reasoning, vision-detective, fine-tuning-alignment).
- **Richer per-engine spec** (e.g. `TradeoffSpec` in `lib/games/efficiency/types.ts`) — when
  flat `params` can't hold what you need (knob ranges + a measured quality grid). Built by a
  tool function (`buildEfficiencyGame` in `lib/games/efficiency/tool.ts`) and consumed by the
  engine's own component. Used by the **decoupled** games (efficiency, rag).

---

## 2. How a game plugs in — two patterns

### Pattern A — DECOUPLED dev-route (DEFAULT, conflict-free) ✅

The whole game lives in files **only your game owns**, reached at `/dev/<engine>`:

```
lib/games/<engine>/…                       engine logic, types, data, tests
components/game/templates/<engine>.tsx     (or components/game/<engine>/… for richer UIs)
app/dev/<engine>/page.tsx                  the harness → /dev/<engine>
```

It touches **zero shared files**, so it can never cause a merge conflict. This is how
**efficiency** and **rag** work — use it as your default.

- **efficiency** → `/dev/efficiency`: `app/dev/efficiency/page.tsx` calls
  `buildEfficiencyGame(SAMPLE_EFFICIENCY_PAPER)` → `TradeoffSpec` → `<Efficiency spec={…}/>`.
  Numbers are real: `computeCost()` (FLOPs/latency) + `computeQuality()` (measured grid).
- **rag** → `/dev/rag`: `app/dev/rag/page.tsx` renders `<RagGame/>`, which replays
  `grid.json` + `corpus_text.json` — **zero model calls at play time**, fully deterministic.

### Pattern B — FULLY-WIRED upload flow (only when you need paper → classify → game)

Use this **only** if you want an uploaded paper to auto-route to your game. In addition to
the Pattern-A files, you additively register in the six shared files in §3. This is how
pathfinding, attention, fine-tuning-alignment, reasoning, and vision-detective reach
`/result/[id]` via the classifier. (You can also do both: a wired game can still have a
`/dev/<engine>` harness — e.g. fine-tuning has `/dev/fine-tuning`, attention has
`/dev/attention`.)

> efficiency and rag are intentionally **not** wired into the upload flow — their richer
> specs don't fit flat `params`. That's a deliberate design choice, not a gap.

---

## 3. The shared files + the ADDITIVE-ONLY rule 🔒

If you choose Pattern B, you edit these six files. **APPEND your entry. Never restructure,
rename, reorder, re-indent, or strip comments** — that is what creates conflicts. Every
conflict during the big integration came from exactly that (a `mockData.ts` restructure, a
comment-strip in `types.ts`, a reordered `package.json`). Additive edits merge cleanly every
time.

**(a) `lib/types.ts` — append your id to the `GameTemplateId` union:**
```ts
export type GameTemplateId =
  | "pathfinding" | "attention" | … | "vision-detective" | "your-game" | "none";
//                                                          ^^^^^^^^^^^ append before "none"
```

**(b) `components/game/GameRouter.tsx` — add one import + one case:**
```ts
import YourGame from "./templates/yourGame";   // with the other imports
// …
case "your-game": return <YourGame game={game} />;   // before `default:`
```

**(c) `lib/templates.ts` — append one `TEMPLATES` entry** (drives the keyword fallback
`pickTemplate`):
```ts
{ id: "your-game", title: "Your Game (one-liner)",
  categories: ["keyword", "synonym", "category phrase"],   // matched as substrings of paper category
  blurb: "What the player does.",
  fullyPlayable: true },
```

**(d) `lib/mockData.ts` — add a named const + register it.** `MOCK_ARTIFACTS` is
`Partial<Record<…>>`, so a missing key is fine — only add what you have:
```ts
const YOUR_GAME: PaperArtifact = { id: "demo-your-game", /* … full artifact … */ };

export const MOCK_ARTIFACTS = {
  …,
  "your-game": YOUR_GAME,   // append
};
```
For a result-page demo, follow the existing `mockArtifact()` wrapper / `mock*` factory
pattern (see `mockReasoning`, `mockVisionArtifact`) rather than editing the wrapper's logic.

**(e) `lib/pipeline.ts` `SYS_CLASSIFY` — append your template + its category mapping.**
⚠️ **`SYS_CLASSIFY` (the array string in `pipeline.ts`) is the runtime source of truth.
`prompts/classify.md` is a reference doc only — it is NOT read at runtime.** Update both, but
the one that matters is `SYS_CLASSIFY`:
```ts
const SYS_CLASSIFY = [
  "Pick the best game template id … : pathfinding | … | your-game | none.",
  …,
  "- your-game: the categories/keywords your paper covers.",   // append a bullet
  …,
].join("\n");
```

**(f) `package.json` — union dependencies; never hand-merge the lock.** Add your deps to the
existing alpha-ordered lists. If `package-lock.json` ever conflicts, **don't edit it by
hand** — `rm -f package-lock.json && npm install` to regenerate, then stage it.

---

## 4. Add-a-game checklist

1. `git checkout main && git pull && git checkout -b feat/<engine>-game`
2. `lib/games/<engine>/` — engine logic + types (+ a tool builder if you need a richer spec).
3. `components/game/templates/<engine>.tsx` (or `components/game/<engine>/…` for a multi-file
   UI). Simple games take `{ game }: { game: PaperArtifact["game"] }`.
4. `app/dev/<engine>/page.tsx` — the harness → **`/dev/<engine>`** (mirror
   `app/dev/efficiency/page.tsx` or `app/dev/fine-tuning/page.tsx`).
5. **(Pattern B only)** additively wire the six shared files in §3.
6. **Data:** commit anything the running game reads at play time (e.g. `grid.json`,
   `corpus_text.json`). `.gitignore` heavy offline-only artifacts and make them regenerable
   (e.g. rag's `corpus.json` → `npm run precompute:rag`).
7. **Gate:** `npm run build` green · `npx tsc --noEmit` clean · `npm test` passing · curl your
   route(s) for 200.
8. Open a PR. Keep it to your own files + (if Pattern B) additive shared-file appends.

---

## 5. Code style / conventions (from the real code)

- **TypeScript everywhere.** Both contracts are TS in `lib/`; no pydantic, no backend.
- **API keys server-side only.** Read `process.env` in API routes / `lib/` (e.g.
  `lib/claude.ts`), **never** in a `"use client"` component. `.env` / `.env.local` are
  gitignored; `.env.example` (keyless) is the committed template.
- **DATA RULE — play-time data must be committed.** Anything the running game needs at play
  time ships in git (`lib/games/rag/data/grid.json`, `corpus_text.json`). Heavy,
  offline-only, regenerable artifacts are gitignored (`lib/games/rag/data/corpus.json`,
  ~2.2 MB → `npm run precompute:rag`). If the demo dies on a fresh clone, you committed the
  wrong split.
- **Faithfulness is the bar.** Interactive numbers come from **real computation or measured
  data** — `computeCost()` FLOPs, the offline quality grid, the CRAG replay grid — **never
  numbers narrated by an LLM.**
- **Rendering:** 2D games = hand-rolled **SVG + React**. 3D = **react-three-fiber + drei**
  with **Kenney CC0** assets in `public/models/`. No `recharts` / `react-flow`.
- **Tests** live under `lib/games/<engine>/*.test.ts`; run all with
  `npm test` (`node --import tsx --test "lib/games/**/*.test.ts"`).
- **Commits:** conventional (`feat:` / `fix:` / `chore:`), small and focused. `main` stays
  deployable; build features on a branch and merge when green end-to-end.
- **No `localStorage` / `sessionStorage`** assumptions — keep game state in React.

---

## Current games & routes

| Game | Template id | Route(s) | Pattern |
|------|-------------|----------|---------|
| Race the Paper (Efficiency) | — (decoupled) | `/dev/efficiency` | A · `TradeoffSpec` |
| Pipeline Defense (RAG/CRAG) | — (decoupled) | `/dev/rag` | A · grid replay |
| The Leash (Fine-tuning) | `fine-tuning-alignment` | `/dev/fine-tuning` + `/result` | A + B |
| Conference Scheduler (Reasoning) | `reasoning` | `/result/demo-reasoning` | B |
| Vision Detective (Multimodal) | `vision-detective` | `/result/demo-vision` | B |
| Maze Runner (Pathfinding) | `pathfinding` | `/result/demo-pathfinding` | B |
| Spotlight (Attention) | `attention` | `/dev/attention` + `/result` | A + B |

Shells (router cases exist, `fullyPlayable: false`): `gridworld-rl`, `epidemic`.
