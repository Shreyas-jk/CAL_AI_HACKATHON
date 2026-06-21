# RAG / CRAG routing game — data contract

> Offline tooling + data spec for the **Corrective RAG (CRAG)** routing game.
> The game is a `pipeline`-archetype explorable: the player routes each query to a
> retrieval **action**, and learns *when corpus retrieval is enough vs. when you must
> correct with a web fallback*. All gameplay numbers are **precomputed offline** here —
> the live game only replays `grid.json`. This file is the single source of truth shared
> by the precompute script and (later) the game UI.

The precompute script (`scripts/rag/precompute.ts`, run via `npm run precompute:rag`) is
the **only** place OpenAI money is spent. It reads `OPENAI_API_KEY` from `.env.local`.

---

## The mechanic (why these numbers exist)

Each query has a hidden **verdict** set *by construction* in the level source:

| verdict     | corpus coverage                          | the lesson |
|-------------|------------------------------------------|------------|
| `correct`   | answer well-covered in the corpus        | plain retrieval already works — don't overspend |
| `ambiguous` | answer present but weakly/among noise    | retrieval is shaky — refine or corroborate |
| `incorrect` | answer **absent** from the corpus (a gap)| retrieval *cannot* work — you must correct with web |

The player sees a **retrieval quality signal** (max cosine of the top-k) but **not** the
verdict. The CRAG insight: that signal tells you which action to route to. The gap topics
(`incorrect`) are the whole point — they are why a web fallback exists.

---

## Actions (4) and their cost

The player picks ONE action per query. Context is built, then a SHORT answer is generated
under the grounding rule, then judged vs. the gold answer.

| action   | context built from                                   | cost |
|----------|------------------------------------------------------|------|
| `naive`  | raw top-k chunks                                     | 0 |
| `refine` | top-k filtered to chunks above a relevance cutoff    | 1 |
| `web`    | the query's `web_snippet` (internal corpus discarded)| 4 |
| `hybrid` | refined internal chunks **+** the `web_snippet`      | 3 |

`naive` is free (you already paid to build the index); `refine` is a cheap rerank/filter;
`web` is an external search call (expensive); `hybrid` does the refine **and** the web call
but is priced below `web` to model amortization / a single combined corrective pass.

**Budget:** `40` units across all 18 queries. "Under budget" ⇒ total cost `≤ 40`.

### Grounding rule (critical)
The generation prompt MUST instruct the model to answer **only** from the provided context
and to output the literal token `INSUFFICIENT_INFORMATION` if the answer is not present.
This is what makes a corpus gap cause a *wrong answer* instead of the model's parametric
memory silently masking the gap. Without it the game is a lie.

### Judge
Normalized **exact match**: lowercase, strip punctuation, strip leading articles
(`a`/`an`/`the`), collapse whitespace; correct iff the normalized gold answer appears as a
token-substring of the normalized model answer. `INSUFFICIENT_INFORMATION` always counts as
**wrong**. (No LLM judge — deterministic and free.)

---

## Models

| use        | model (configurable const in the script) |
|------------|-------------------------------------------|
| embeddings | `text-embedding-3-small`                  |
| generation | `gpt-4o-mini`                             |

Retrieval: top-k with `k = 5`, cosine similarity. `quality_signal` = max cosine over the
retrieved top-k. `refine` relevance cutoff: a cosine threshold const (default `0.34`).

---

## Schemas

### `lib/games/rag/data/level_source.json` (authoring input — NOT shipped)
```jsonc
{
  "meta": { "k": 5, "refineCutoff": 0.34, "budget": 40, "genModel": "gpt-4o-mini", "embedModel": "text-embedding-3-small" },
  "corpus": [ { "chunk_id": "c0001", "text": "<~150-200 token factual passage>" }, ... ],
  "queries": [
    {
      "query_id": "q01",
      "text": "<the question>",
      "gold_answer": "<short factoid>",
      "hidden_verdict": "correct" | "ambiguous" | "incorrect",  // authoring-only, never shipped
      "web_snippet": "<a real short passage that DOES contain the answer>"
    }, ...
  ]
}
```

### `lib/games/rag/data/corpus.json` (offline reference — has embeddings, NOT shipped to client)
```jsonc
[ { "chunk_id": "c0001", "text": "...", "embedding": [/* 1536 floats */] }, ... ]
```

### `lib/games/rag/data/corpus_text.json` (shipped — lean, for display)
```jsonc
{ "c0001": "<text>", ... }
```

### `lib/games/rag/data/grid.json` (shipped — the replay grid; NO embeddings, NO verdicts)
```jsonc
{
  "meta": { "k": 5, "budget": 40, "actions": ["naive","refine","web","hybrid"], "cost": { "naive":0,"refine":1,"web":4,"hybrid":3 } },
  "queries": [ { "query_id":"q01", "text":"...", "gold_answer":"...", "quality_signal": 0.81 } ],
  "cells": {
    "q01": {
      "naive":  { "retrieved": ["c0001","c0007",...], "quality_signal": 0.81, "answer": "...", "correct": true,  "cost": 0 },
      "refine": { ... }, "web": { ... }, "hybrid": { ... }
    }, ...
  }
}
```
`hidden_verdict` is **never** written to any shipped file.

---

## Verification report (the gate — printed by the script; STOP here before any UI)

- corpus size; query count per verdict (target split: 7 correct / 6 incorrect / 5 ambiguous).
- `quality_signal` distribution per verdict — must be **separable** (incorrect clearly lower
  than correct; ambiguous in between).
- **NAIVE baseline** (every query → `naive`): overall accuracy + per-verdict.
  Target ≈ **60%** overall, **~100%** on correct, **~0%** on incorrect.
- **ALWAYS-WEB** (every query → `web`): accuracy + total cost.
  Target ≈ **95%** accuracy but cost **> 40** (over budget — the naive "just always search" loses).
- **ORACLE CRAG** (route each query to its best action by `quality_signal`): accuracy + cost.
  Target **≥ 90%** accuracy **AND** cost **≤ 40** (the corrective policy wins).
- Explicitly flag any missed target and which queries are off, so `level_source.json` can be
  retuned before building the game.

> Real QA-dataset rows (TriviaQA / Natural Questions) can be dropped into `level_source.json`
> later in place of hand-authored queries/corpus; the schema is identical.
