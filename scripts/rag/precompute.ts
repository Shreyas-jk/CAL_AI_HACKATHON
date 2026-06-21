/**
 * Offline precompute for the RAG / CRAG routing game.
 *
 *   npm run precompute:rag              # full precompute (spends OpenAI money)
 *   npm run precompute:rag -- --validate  # offline construction check (NO API, free)
 *
 * Reads OPENAI_API_KEY from .env.local. This is the ONLY place OpenAI money is spent.
 * Produces the real grid the game replays. See docs/templates/rag-crag-contract.md.
 *
 * Real QA-dataset rows (TriviaQA / NQ) can replace the hand-authored level_source
 * queries/corpus later — the schema is identical.
 */
import OpenAI from "openai";
import dotenv from "dotenv";
import { readFileSync, writeFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

dotenv.config({ path: ".env.local" });

// ---- config (from the contract) -------------------------------------------
const DATA_DIR = resolve("lib/games/rag/data");
const SRC = resolve(DATA_DIR, "level_source.json");
const EMBED_MODEL = "text-embedding-3-small";
const GEN_MODEL = "gpt-4o-mini";
const K = 5;
const REFINE_CUTOFF = 0.34;
const BUDGET = 40;
const COST = { naive: 0, refine: 1, web: 4, hybrid: 3 } as const;
type Action = keyof typeof COST;
const ACTIONS: Action[] = ["naive", "refine", "web", "hybrid"];

// ---- types ----------------------------------------------------------------
type Verdict = "correct" | "ambiguous" | "incorrect";
interface Chunk { chunk_id: string; text: string; }
interface Query { query_id: string; text: string; gold_answer: string; hidden_verdict: Verdict; web_snippet: string; }
interface Level { meta: Record<string, unknown>; corpus: Chunk[]; queries: Query[]; }
interface Embedded extends Chunk { embedding: number[]; }

const level: Level = JSON.parse(readFileSync(SRC, "utf8"));

// ---- judge (normalized exact-match, contiguous token run) ------------------
const ARTICLES = new Set(["a", "an", "the"]);
function normTokens(s: string): string[] {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((t) => t && !ARTICLES.has(t));
}
function judge(gold: string, answer: string): boolean {
  if (/insufficient_information/i.test(answer)) return false;
  const g = normTokens(gold), a = normTokens(answer);
  if (!g.length) return false;
  for (let i = 0; i + g.length <= a.length; i++) {
    let ok = true;
    for (let j = 0; j < g.length; j++) if (a[i + j] !== g[j]) { ok = false; break; }
    if (ok) return true;
  }
  return false;
}

// ---- math -----------------------------------------------------------------
function dot(a: number[], b: number[]): number { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; }
function norm(a: number[]): number { return Math.sqrt(dot(a, a)); }
function cosine(a: number[], b: number[]): number { const d = norm(a) * norm(b); return d === 0 ? 0 : dot(a, b) / d; }

// ===========================================================================
// OFFLINE VALIDATE — no API. Proves the construction: is the gold answer
// lexically present in the corpus / web snippet? Catches authoring mistakes
// before any money is spent.
// ===========================================================================
function tokenRunPresent(gold: string, haystack: string): boolean {
  const g = normTokens(gold), a = normTokens(haystack);
  for (let i = 0; i + g.length <= a.length; i++) {
    let ok = true; for (let j = 0; j < g.length; j++) if (a[i + j] !== g[j]) { ok = false; break; }
    if (ok) return true;
  }
  return false;
}
function validateOffline(): void {
  const corpusText = level.corpus.map((c) => c.text).join("\n");
  console.log("\n=== OFFLINE CONSTRUCTION CHECK (no API) ===");
  console.log(`corpus passages: ${level.corpus.length} | queries: ${level.queries.length}`);
  const byVerdict: Record<Verdict, number> = { correct: 0, ambiguous: 0, incorrect: 0 };
  level.queries.forEach((q) => byVerdict[q.hidden_verdict]++);
  console.log(`split: ${byVerdict.correct} correct / ${byVerdict.incorrect} incorrect / ${byVerdict.ambiguous} ambiguous\n`);

  console.log("query  verdict     answer-in-corpus  answer-in-web   note");
  const problems: string[] = [];
  for (const q of level.queries) {
    const inCorpus = tokenRunPresent(q.gold_answer, corpusText);
    const inWeb = tokenRunPresent(q.gold_answer, q.web_snippet);
    let note = "ok";
    if (q.hidden_verdict === "correct" && !inCorpus) { note = "BAD: correct answer missing from corpus"; problems.push(`${q.query_id}: ${note}`); }
    if (q.hidden_verdict === "incorrect" && inCorpus) { note = "BAD: incorrect topic LEAKED into corpus"; problems.push(`${q.query_id}: ${note}`); }
    if (!inWeb) { note = "BAD: web_snippet does not contain the answer"; problems.push(`${q.query_id}: ${note}`); }
    console.log(`${q.query_id}    ${q.hidden_verdict.padEnd(10)}  ${(inCorpus ? "yes" : "no ").padEnd(16)}  ${(inWeb ? "yes" : "no ").padEnd(13)}  ${note}`);
  }
  console.log("\nNOTE: ambiguous may be either (answer weakly present) or (topic present, exact answer absent) — both are valid.");
  console.log(problems.length ? `\n❌ ${problems.length} construction problem(s):\n - ${problems.join("\n - ")}` : "\n✅ construction holds: correct answers present, incorrect topics absent, all web snippets carry the answer.");
}

// ===========================================================================
// FULL PRECOMPUTE — embeddings + grounded generation + judge + report.
// ===========================================================================
async function embedAll(client: OpenAI, texts: string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += 100) {
    const batch = texts.slice(i, i + 100);
    const res = await client.embeddings.create({ model: EMBED_MODEL, input: batch });
    for (const d of res.data) out.push(d.embedding as number[]);
  }
  return out;
}

const GROUND_SYS =
  "You answer factoid questions using ONLY the provided context. " +
  "If the answer is not stated in the context, reply with exactly INSUFFICIENT_INFORMATION. " +
  "Otherwise reply with the shortest possible answer (a name, word, or number) and nothing else.";

async function generate(client: OpenAI, context: string, question: string): Promise<string> {
  const res = await client.chat.completions.create({
    model: GEN_MODEL, temperature: 0, max_tokens: 30,
    messages: [
      { role: "system", content: GROUND_SYS },
      { role: "user", content: `Context:\n${context || "(no context provided)"}\n\nQuestion: ${question}\nAnswer:` },
    ],
  });
  return (res.choices[0].message.content ?? "").trim();
}

interface Cell { retrieved: string[]; quality_signal: number; answer: string; correct: boolean; cost: number; }

async function fullPrecompute(): Promise<void> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    console.error("\n❌ OPENAI_API_KEY not found in .env.local.\n" +
      "   Add a line  OPENAI_API_KEY=sk-...  to .env.local (gitignored), then re-run:\n" +
      "     npm run precompute:rag\n" +
      "   To check the level design without spending money:  npm run precompute:rag -- --validate\n");
    process.exit(1);
  }
  const client = new OpenAI({ apiKey: key });

  console.log(`Embedding ${level.corpus.length} corpus chunks with ${EMBED_MODEL}...`);
  const corpusEmb = await embedAll(client, level.corpus.map((c) => c.text));
  const corpus: Embedded[] = level.corpus.map((c, i) => ({ ...c, embedding: corpusEmb[i] }));

  console.log(`Embedding ${level.queries.length} queries...`);
  const queryEmb = await embedAll(client, level.queries.map((q) => q.text));

  const cells: Record<string, Record<Action, Cell>> = {};
  const querySummary: { query_id: string; text: string; gold_answer: string; quality_signal: number }[] = [];

  for (let qi = 0; qi < level.queries.length; qi++) {
    const q = level.queries[qi];
    const qv = queryEmb[qi];
    const scored = corpus.map((c) => ({ id: c.chunk_id, text: c.text, sim: cosine(qv, c.embedding) }))
      .sort((a, b) => b.sim - a.sim);
    const topk = scored.slice(0, K);
    const quality_signal = topk[0]?.sim ?? 0;
    const refined = topk.filter((c) => c.sim >= REFINE_CUTOFF);

    const contexts: Record<Action, { retrieved: string[]; context: string }> = {
      naive: { retrieved: topk.map((c) => c.id), context: topk.map((c) => c.text).join("\n\n") },
      refine: { retrieved: refined.map((c) => c.id), context: refined.map((c) => c.text).join("\n\n") },
      web: { retrieved: [], context: q.web_snippet },
      hybrid: { retrieved: refined.map((c) => c.id), context: [...refined.map((c) => c.text), q.web_snippet].join("\n\n") },
    };

    cells[q.query_id] = {} as Record<Action, Cell>;
    for (const action of ACTIONS) {
      const { retrieved, context } = contexts[action];
      const answer = await generate(client, context, q.text);
      const correct = judge(q.gold_answer, answer);
      cells[q.query_id][action] = { retrieved, quality_signal, answer, correct, cost: COST[action] };
    }
    querySummary.push({ query_id: q.query_id, text: q.text, gold_answer: q.gold_answer, quality_signal });
    process.stdout.write(`  ${q.query_id} signal=${quality_signal.toFixed(3)}  ` +
      ACTIONS.map((a) => `${a[0]}:${cells[q.query_id][a].correct ? "1" : "0"}`).join(" ") + "\n");
  }

  // ---- write outputs ----
  writeFileSync(resolve(DATA_DIR, "corpus.json"), JSON.stringify(corpus));
  const corpusTextMap: Record<string, string> = {};
  for (const c of level.corpus) corpusTextMap[c.chunk_id] = c.text;
  writeFileSync(resolve(DATA_DIR, "corpus_text.json"), JSON.stringify(corpusTextMap, null, 0));
  const grid = {
    meta: { k: K, budget: BUDGET, actions: ACTIONS, cost: COST, embedModel: EMBED_MODEL, genModel: GEN_MODEL },
    queries: querySummary,
    cells, // NO embeddings, NO hidden_verdict
  };
  writeFileSync(resolve(DATA_DIR, "grid.json"), JSON.stringify(grid, null, 0));

  report(cells);
  console.log("\nWrote:");
  for (const f of ["corpus.json", "corpus_text.json", "grid.json"]) {
    const kb = (statSync(resolve(DATA_DIR, f)).size / 1024).toFixed(1);
    console.log(`  lib/games/rag/data/${f}  (${kb} KB)`);
  }
}

// ---- verification report (the gate) ---------------------------------------
function report(cells: Record<string, Record<Action, Cell>>): void {
  const Q = level.queries;
  const verdict = (id: string) => Q.find((q) => q.query_id === id)!.hidden_verdict;
  const pct = (n: number, d: number) => d === 0 ? "—" : `${Math.round((100 * n) / d)}%`;

  console.log("\n========================= VERIFICATION REPORT =========================");
  const counts: Record<Verdict, number> = { correct: 0, ambiguous: 0, incorrect: 0 };
  Q.forEach((q) => counts[q.hidden_verdict]++);
  console.log(`corpus: ${level.corpus.length} passages | queries: ${Q.length} (${counts.correct} correct / ${counts.incorrect} incorrect / ${counts.ambiguous} ambiguous)`);

  // quality_signal distribution per verdict
  console.log("\n--- quality_signal by verdict (max cosine of top-k) ---");
  const sig: Record<Verdict, number[]> = { correct: [], ambiguous: [], incorrect: [] };
  for (const q of Q) sig[q.hidden_verdict].push(cells[q.query_id].naive.quality_signal);
  const stat = (xs: number[]) => xs.length ? `min ${Math.min(...xs).toFixed(2)}  mean ${(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2)}  max ${Math.max(...xs).toFixed(2)}` : "—";
  (["correct", "ambiguous", "incorrect"] as Verdict[]).forEach((v) => console.log(`  ${v.padEnd(10)} ${stat(sig[v])}   [${sig[v].map((x) => x.toFixed(2)).join(", ")}]`));
  const sep = Math.max(...sig.incorrect) < Math.min(...sig.correct);
  console.log(`  separable (max incorrect < min correct)? ${sep ? "YES ✅" : "NO ⚠️"}`);

  // NAIVE baseline
  console.log("\n--- NAIVE baseline (every query -> naive) ---");
  const naiveByV: Record<Verdict, [number, number]> = { correct: [0, 0], ambiguous: [0, 0], incorrect: [0, 0] };
  let naiveOk = 0;
  for (const q of Q) { const c = cells[q.query_id].naive.correct; if (c) naiveOk++; const v = naiveByV[q.hidden_verdict]; v[1]++; if (c) v[0]++; }
  console.log(`  overall ${pct(naiveOk, Q.length)} (${naiveOk}/${Q.length})  [target ~60%]`);
  (["correct", "ambiguous", "incorrect"] as Verdict[]).forEach((v) => console.log(`    ${v.padEnd(10)} ${pct(naiveByV[v][0], naiveByV[v][1])} (${naiveByV[v][0]}/${naiveByV[v][1]})`));

  // ALWAYS-WEB
  const webOk = Q.filter((q) => cells[q.query_id].web.correct).length;
  const webCost = Q.length * COST.web;
  console.log("\n--- ALWAYS-WEB (every query -> web) ---");
  console.log(`  accuracy ${pct(webOk, Q.length)} (${webOk}/${Q.length})  cost ${webCost}  [target ~95% but OVER budget ${BUDGET}]`);

  // ORACLE CRAG (route each query to its best action: cheapest correct, else cheapest)
  console.log("\n--- ORACLE CRAG (route each query to its best action) ---");
  let oracleOk = 0, oracleCost = 0;
  const routes: string[] = [];
  for (const q of Q) {
    const opts = ACTIONS.map((a) => ({ a, ...cells[q.query_id][a] }));
    const correctOpts = opts.filter((o) => o.correct).sort((x, y) => x.cost - y.cost);
    const pick = correctOpts[0] ?? opts.slice().sort((x, y) => x.cost - y.cost)[0];
    if (pick.correct) oracleOk++;
    oracleCost += pick.cost;
    routes.push(`${q.query_id}->${pick.a}(${pick.cost})`);
  }
  console.log(`  accuracy ${pct(oracleOk, Q.length)} (${oracleOk}/${Q.length})  cost ${oracleCost}  [target >=90% AND <= ${BUDGET}]`);
  console.log(`  routes: ${routes.join("  ")}`);

  // target gate
  console.log("\n--- TARGET GATE ---");
  const fails: string[] = [];
  if (!sep) fails.push(`quality_signal NOT cleanly separable — incorrect queries with signal >= a correct one: ${Q.filter((q) => q.hidden_verdict === "incorrect" && cells[q.query_id].naive.quality_signal >= Math.min(...sig.correct)).map((q) => q.query_id).join(", ")}`);
  const naivePctNum = (100 * naiveOk) / Q.length;
  if (naivePctNum < 50 || naivePctNum > 72) fails.push(`NAIVE overall ${Math.round(naivePctNum)}% outside ~60% band`);
  if (naiveByV.incorrect[0] > 0) fails.push(`NAIVE got ${naiveByV.incorrect[0]} INCORRECT-verdict queries right (should be ~0): ${Q.filter((q) => q.hidden_verdict === "incorrect" && cells[q.query_id].naive.correct).map((q) => q.query_id).join(", ")}`);
  if ((100 * webOk) / Q.length < 85) fails.push(`ALWAYS-WEB accuracy ${pct(webOk, Q.length)} below ~95% — web snippets failing: ${Q.filter((q) => !cells[q.query_id].web.correct).map((q) => q.query_id).join(", ")}`);
  if (webCost <= BUDGET) fails.push(`ALWAYS-WEB cost ${webCost} not over budget ${BUDGET}`);
  if ((100 * oracleOk) / Q.length < 90) fails.push(`ORACLE accuracy ${pct(oracleOk, Q.length)} below 90%`);
  if (oracleCost > BUDGET) fails.push(`ORACLE cost ${oracleCost} over budget ${BUDGET}`);
  console.log(fails.length ? `❌ ${fails.length} target(s) MISSED — retune level_source before building the game:\n - ${fails.join("\n - ")}` : "✅ ALL CONTRACT TARGETS MET. Level holds; safe to build the game on this grid.");
  console.log("=======================================================================");
}

// ---- entry ----------------------------------------------------------------
if (process.argv.includes("--validate")) {
  validateOffline();
} else {
  fullPrecompute().catch((e) => { console.error(e); process.exit(1); });
}
