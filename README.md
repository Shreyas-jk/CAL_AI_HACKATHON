# PaperTrail AI — Make papers playable

Turn dense ML/AI research papers into **interactive, playable experiments**. Built for the
Cal Hacks AI Hackathon 2026 (track: *Ddoski's Lab*).

> Upload a paper → get a concept map, a plain-English explanation, and a **game** where you
> first fail *without* the paper's idea, then win *with* it.

## The 3-tier artifact
1. **Understand** — summary, plain-English steps, auto concept map. Works for *any* paper (always-on fallback).
2. **Play** — a challenge built from the paper's core idea, with a goal and a score.
3. **Prove** — "defeat it without the module": lose with the naive baseline, then unlock the paper's method as a power-up and win. Before/after metric ties back to the paper's claim.

## Game template library
| Template | Paper categories | Status |
|---|---|---|
| Maze Runner (A* vs naive BFS) | pathfinding / planning / search | ✅ fully playable |
| Spotlight (uniform vs learned attention) | attention / transformer / NLP | ✅ fully playable |
| Survivor (policy vs reward shaping) | reinforcement learning | ▶ playable shell |
| Flatten It (intervention strategy) | epidemic / spread | ▶ playable shell |
| Vision Detective (grounded VLM lab) | multimodal / vision-language / OCR / grounding | ✅ fully playable |

New templates: add a component under `components/game/templates/`, register it in
`lib/templates.ts`, and route it in `components/game/GameRouter.tsx`.

## Architecture
- **Next.js (App Router) + TypeScript + Tailwind**
- **Claude (Anthropic)** powers the pipeline: `extract → classify → explain` (`lib/pipeline.ts`)
- **Redis** caches sessions/artifacts (`lib/redis.ts`); falls back to in-memory if `REDIS_URL` is unset
- **Arize** logs eval scores — faithfulness & hallucination risk (`lib/arize.ts`); no-ops without keys

### API routes
| Route | Purpose |
|---|---|
| `POST /api/extract` | PDF/text → structured artifact (runs the full pipeline) |
| `POST /api/classify` | category → game template (debug/sponsor demo) |
| `POST /api/explain` | summary → plain-English + concept map |
| `POST /api/eval` | text+summary → faithfulness / hallucination score |

## Run it
```bash
npm install
cp .env.example .env.local   # optional — app runs offline without keys
npm run dev                  # http://localhost:3000
```

**Demo without any keys:** the app ships with a themed offline artifact. Visit `/result/demo`
or click *"Skip to demo result"* on the home page — the pathfinding game is fully playable.
Add `ANTHROPIC_API_KEY` to process real uploaded papers.

## Env vars
`ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (optional), `REDIS_URL` (optional), `ARIZE_API_KEY`, `ARIZE_SPACE_ID` (optional).

---
*Tagline: Make papers playable.*
