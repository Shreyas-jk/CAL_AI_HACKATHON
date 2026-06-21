# Classify prompt

Given the paper's category and summary, choose the best **router-wired, playable** game
template id from:

`pathfinding | attention | fine-tuning-alignment | reasoning | vision-detective | none`

Map by what the paper is about:

- **pathfinding** — search, planning, A*/learned heuristics, graph traversal, maze/navigation, route optimization.
- **attention** — transformer attention, self-attention, sequence/NLP, coreference, which tokens a model focuses on.
- **fine-tuning-alignment** — fine-tuning, RLHF, DPO, preference optimization, reward modeling, alignment, policy drift / reward hacking.
- **reasoning** — chain-of-thought, test-time compute, best-of-N sampling, verifiers/voting, multi-step or constraint-satisfaction reasoning, planning puzzles.
- **vision-detective** — multimodal vision-language, VQA, OCR/document understanding, CLIP-style image-text, grounding, visual hallucination.
- **none** — anything that fits none of the above.

Prefer a real template when the paper plausibly fits; use `none` only when nothing matches.
When `none` is returned, the pipeline falls back to keyword matching over template
categories (`lib/templates.ts` → `pickTemplate`), which may still land on a shell template
(`gridworld-rl`, `epidemic`).

Return ONLY JSON:
`{ "template", "confidence" (0..1), "goal", "baselineLabel", "powerupLabel", "claim", "params" }`

`params` are primitive knobs for the chosen template. For `vision-detective`, prefer
`params: { "lesson", "methodName", "paperClaim" }`.

> Note: `efficiency` and `rag` are intentionally **not** in this list — they are decoupled
> engines reached via `/dev/efficiency` and `/dev/rag` with richer specs (TradeoffSpec / the
> CRAG grid), not wired into the upload→classify→GameRouter path. A paper that best fits those
> falls back to the nearest router-wired template (or `none`) here.
