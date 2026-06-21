# Plan — grounded "ask the paper" chatbot

> Read-only investigation + plan. No chatbot code written yet. Goal: a chat panel that
> answers questions **from the uploaded paper's actual content** (cite sections; say "the
> paper doesn't cover that" instead of answering from general knowledge).

## 1. Document intake — where the text goes (and where it's lost)

Trace: `Upload`/URL → `POST /api/extract` (or `/api/fetch-url`) → `extractPdfText`/Browserbase
→ `buildArtifact(id, rawText)` → `saveArtifact(artifact)`.

- **Parse:** `lib/chunk.ts` `extractPdfText(buf)` (pdf-parse) returns the full text as a string.
  `app/api/fetch-url/route.ts` gets text from Browserbase (or a plain fetch fallback).
- **What's retained:** `lib/pipeline.ts buildArtifact` slices `rawText` to 12 000 chars for the
  extract call and pulls the `method` section (first 3 000 chars) for explain — both transient.
  The returned `PaperArtifact` (`lib/types.ts`) holds **only**: `id, title, category, oneLiner,
  summary, plainEnglish[], concept{nodes,edges}, game{…}, eval, source`. **No full-text field.**
- **What's stored:** `lib/store.ts saveArtifact` writes that artifact to an in-memory `Map` +
  Redis (`papertrail:artifact:<id>`, 7-day EX) plus a small meta hash. **`rawText` is never
  persisted** — confirmed by grep: no save/store touches `rawText`/`fullText`/`paperText`. It
  lives only in the route's request scope and is discarded when `buildArtifact` returns.
- **So a chatbot today** could only pull the LLM-generated `summary` / `oneLiner` /
  `plainEnglish[]` — reduced, paraphrased, partly LLM-invented. Grounding on those defeats the
  point. **The full paper text is not available anywhere after intake.**

## 2. LLM / prompt plumbing

- **Client:** `lib/claude.ts` — Anthropic SDK only (`@anthropic-ai/sdk`). Model
  `claude-sonnet-4-6` (env `ANTHROPIC_MODEL` override). `hasClaude()` gates on
  `ANTHROPIC_API_KEY`. **No `llm.ts` provider shim on main** (that was the tradeoff-shell spike
  branch). Note: `OPENAI_API_KEY` is present in `.env.local`, but main's runtime uses Anthropic.
- **The only helper is `askJson(system, user, maxTokens?)`** — a single-shot, **non-streaming**,
  JSON-only call (it extracts the first `{…}` substring and `JSON.parse`s it). **There is no
  streaming helper and no multi-turn/chat helper.** One system string + one user string per call.
- **Prompts** live as plain strings in `lib/pipeline.ts` (`SYS_EXTRACT`, `SYS_CLASSIFY`,
  `SYS_EXPLAIN`) and are passed as the `system` arg. The small `/api/explain`, `/api/eval`,
  `/api/classify` routes reuse these pieces.

## 3. Context constraints

- **`claude-sonnet-4-6` context window = 1M tokens** (per the claude-api model catalog), 64K max
  output. A typical ML paper is ~8–15k words ≈ **10–20k tokens** — well under 1M.
- **The full paper fits in a single call.** No chunking/retrieval is needed for grounding; we can
  put the entire paper in context every turn. (Chunking/embeddings only become necessary for
  unusually long papers — a future concern, not v1.)
- **Existing paper chunking:** `chunkSections` (lib/chunk.ts) splits by section headers but is
  transient (used once to find the `method` section), **not stored**. The RAG game's
  `lib/games/rag/data/*.json` embeddings are **game data, not the uploaded paper** — confirmed
  separate.

---

## Plan (proposed — no code yet)

### A. Grounding source + smallest intake change
The bot must answer from the **real text**, which isn't retained. Smallest change: **persist the
parsed text at intake, in a separate store entry** (not on the artifact, to keep the client
payload + artifact JSON lean).

- Add to `lib/store.ts`, mirroring the existing pattern: `savePaperText(id, text)` /
  `getPaperText(id)` → in-memory `Map` + Redis key `papertrail:paper:<id>` with the **same 7-day
  EX** as artifacts.
- Call `savePaperText(id, rawText)` in `app/api/extract/route.ts` and
  `app/api/fetch-url/route.ts` right where `rawText` already exists (skip when empty / mock path).
- Optionally cap stored text (e.g. ~200k chars) as a guard; full paper still fits Sonnet 4.6.

### B. API route shape — `POST /api/chat`
- **Inputs:** `{ id: string, messages: { role: "user" | "assistant"; content: string }[] }`.
  Conversation history is held **client-side** and sent each turn (stateless API, per the SDK
  multi-turn pattern: full `messages[]` each call, first message `user`).
- **Server:** `getPaperText(id)` → build the grounding system prompt (paper text inside it) →
  **stream** the reply.
- **Reuses** `lib/claude.ts`'s Anthropic client + `claude-sonnet-4-6`, but needs a **new helper**
  (`askJson` is JSON-only/non-streaming): add `streamChat(system, messages)` using
  `client.messages.stream({ model, max_tokens, system, messages })` and return the SSE/text
  stream to the client (`for await … delta.text`). `runtime = "nodejs"`.
- **No key / no stored text:** return a graceful message ("Chat needs `ANTHROPIC_API_KEY`" /
  "No paper text on file for this id"), mirroring the pipeline's mock fallback — never 500.

### C. Prompt design (the grounding contract)
System prompt = rules + the paper. Concretely:
- A header (`title`, `category`) then the **full paper text** in a dedicated block.
- Rules: *answer only from the paper below; quote/cite the section it came from; if the paper
  doesn't address the question, say "the paper doesn't cover that" and do not answer from general
  knowledge; never add outside facts.* (Same anti-"just ChatGPT" bar as the rest of the app.)
- **Prompt caching:** put the paper-text block in the system array with
  `cache_control: { type: "ephemeral" }`. Re-sending the paper each turn then bills at ~0.1×
  (cache read) instead of full input price; keep the paper stable at the front and the user's
  question/history after the cached prefix (prefix-match rule). Sonnet 4.6 min cacheable prefix
  is 2 048 tokens — a paper clears that easily. 5-min TTL covers an active chat.

### D. UI placement + conversation state
- A new client component `components/PaperChat.tsx`, mounted on **`app/result/[id]/page.tsx`**
  (it already has `params.id` + the artifact). Place it under the Tier-1 "Understand" panel,
  wrapped in a `<Cabinet>` for theme consistency.
- **State:** React `useState` array of `{role, content}`; on submit, append the user turn, POST
  the whole array + `id` to `/api/chat`, stream the assistant reply into a growing message.
  No server-side session; history is client-held and resent each turn.

---

## Open decisions (want your call before building)
1. **Store full text separately (recommended) vs. add a `fullText` field to `PaperArtifact`?**
   Separate keeps the artifact/client payload lean; a field is simpler but bloats every
   artifact fetch + Redis value and ships the paper to the browser.
2. **Full-text-in-context (recommended for v1) vs. retrieval/embeddings?** Papers fit Sonnet
   4.6's window; retrieval is only needed for outliers — defer.
3. **Streaming (recommended) vs. single-shot JSON?** Chat wants streaming; needs the new
   `streamChat` helper since `askJson` can't stream.
4. **Citations:** prompt-based "name the section" (cheap, v1) vs. Anthropic's native document
   **Citations** feature (`citations:{enabled:true}` on a document block → structured
   `cited_text`/locations; more wiring). Recommend prompt-based for v1.
5. **UI spot:** result-page panel (proposed) — confirm, vs. a separate `/chat/[id]` route.

## Gaps / risks
- **Only NEW uploads (after the intake change) get text.** Existing/demo/mock artifacts have no
  stored paper text → chat must degrade gracefully (disable, or fall back to summary with a
  clear "limited to the summary" notice). The no-API-key **mock** path has no real paper at all.
- **PDF extraction quality:** `pdf-parse` can yield garbled/column-shuffled text; grounding is
  only as good as the extraction. URL fetch via Browserbase may capture nav chrome too.
- **Cost/latency:** re-sending the paper each turn — mitigated by `cache_control`, but the first
  turn pays a full-text read + cache write.
- **TTL:** paper-text store should match the artifact's 7-day EX so chat doesn't outlive its
  source; in-memory `Map` is per-process (fine for the demo, lost on restart without Redis).
- **Provider:** main is Anthropic-only; the `OPENAI_API_KEY` in `.env.local` is unused here. If
  Anthropic credits aren't funded, chat is offline (same constraint as the live pipeline).

**Files this would touch when built:** `lib/store.ts` (+`savePaperText`/`getPaperText`),
`app/api/extract/route.ts` + `app/api/fetch-url/route.ts` (persist `rawText`), `lib/claude.ts`
(+`streamChat`), new `app/api/chat/route.ts`, new `components/PaperChat.tsx`,
`app/result/[id]/page.tsx` (mount it). No game engines touched.
