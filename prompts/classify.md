# Classify prompt

Given the paper's category and summary, choose the best **router-wired, playable** game
template id from:

`pathfinding | attention | fine-tuning-alignment | reasoning | vision-detective | gridworld-rl | epidemic | none`

Map by what the paper is about:

- **pathfinding** — search, planning, A*/learned heuristics, graph traversal, maze/navigation, route optimization, evaluation/benchmarks, embedding similarity, metric navigation.
- **attention** — transformer attention, self-attention, sequence/NLP, coreference, which tokens a model focuses on, prompt engineering, in-context learning, few-shot learning.
- **fine-tuning-alignment** — fine-tuning, RLHF, DPO, preference optimization, reward modeling, alignment, policy drift / reward hacking, LLM pretraining, learning rate scheduling, loss landscape, training stability.
- **reasoning** — chain-of-thought, test-time compute, best-of-N sampling, verifiers/voting, multi-step or constraint-satisfaction reasoning, planning puzzles, agentic AI, tool-use, task decomposition, agent planning.
- **vision-detective** — multimodal vision-language, VQA, OCR/document understanding, CLIP-style image-text, grounding, visual hallucination, safety, interpretability, red-teaming, adversarial attacks, feature steering.
- **gridworld-rl** — reinforcement learning, policy gradient, Q-learning, reward shaping, control.
- **epidemic** — epidemic modeling, SIR/SIS, diffusion, information spread, contagion, network effects.
- **none** — anything that fits none of the above.

Papers about **efficiency/quantization/compression** or **RAG/retrieval** map to the nearest template above (they have separate flagship games at `/dev/efficiency` and `/dev/rag`).

Prefer a real template when the paper plausibly fits; use `none` only when nothing matches.

## Category-to-template mapping (10 PDF categories)

| Category | Template | Mapping rationale |
|----------|----------|------------------|
| RAG | nearest / link to `/dev/rag` | Decoupled flagship |
| Fine-tuning/Alignment | `fine-tuning-alignment` | Direct match |
| Multimodal/Vision-language | `vision-detective` | Direct match |
| Reasoning/CoT | `reasoning` | Direct match |
| Efficiency/Compression | nearest / link to `/dev/efficiency` | Decoupled flagship |
| Agentic AI | `reasoning` | Tool-call ordering = constraint puzzle |
| LLM Pretraining | `fine-tuning-alignment` | Learning rate slider = drift slider |
| Prompt Engineering | `attention` | Few-shot focus = attention weights |
| Evaluation/Benchmarks | `pathfinding` | Navigating benchmark space |
| Safety/Interpretability | `vision-detective` | Investigation mechanic |

Return ONLY JSON:
`{ "template", "confidence" (0..1), "goal", "baselineLabel", "powerupLabel", "claim", "params" }`

`params` are primitive knobs for the chosen template. For `vision-detective`, prefer
`params: { "lesson", "methodName", "paperClaim" }`.

> **Note:** `SYS_CLASSIFY` (the array string in `pipeline.ts`) is the runtime source of truth.
> This file is a reference doc only — it is NOT read at runtime.
