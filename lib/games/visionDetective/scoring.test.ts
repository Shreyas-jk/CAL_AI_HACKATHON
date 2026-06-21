import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_VISION_SETTINGS, getVisionCase } from "./cases";
import { computeVisionCost, runVisionCase } from "./scoring";
import type { VisionSettings } from "./types";

const settings = (s: Partial<VisionSettings>): VisionSettings => ({ ...DEFAULT_VISION_SETTINGS, ...s });

test("object case requires detector plus region grounding", () => {
  const c = getVisionCase("object");
  assert.equal(runVisionCase(c, settings({ regionGrounding: true }), []).solved, false);
  const win = runVisionCase(c, settings({ regionGrounding: true, objectDetector: true, reasoningSteps: 3 }), ["rectangular"]);
  assert.equal(win.solved, true);
  assert.equal(win.verdict, "case-solved");
  assert.ok(win.unlockedEvidenceIds.includes("box"));
});

test("ocr case fails without OCR and wins with OCR plus crop", () => {
  const c = getVisionCase("ocr");
  assert.equal(runVisionCase(c, settings({ cropTool: true, reasoningSteps: 5 }), ["text-needed"]).solved, false);
  const win = runVisionCase(c, settings({ ocr: true, cropTool: true }), ["text-needed", "tea-highest"]);
  assert.equal(win.solved, true);
  assert.match(win.modelAnswer, /\$18\.40/);
});

test("hallucination case rewards grounded refusal", () => {
  const c = getVisionCase("hallucination");
  const bad = runVisionCase(c, settings({ regionGrounding: true, confidenceThreshold: "low" }), ["cat-visible"]);
  assert.equal(bad.solved, false);
  assert.equal(bad.verdict, "false-lead");
  const good = runVisionCase(c, settings({ regionGrounding: true, groundingRequired: true, confidenceThreshold: "medium" }), ["cat-visible"]);
  assert.equal(good.solved, true);
  assert.equal(good.verdict, "hallucination-caught");
});

test("compute cost increases with tools and questions", () => {
  const lean = computeVisionCost(settings({}), 0);
  const heavy = computeVisionCost(settings({ regionGrounding: true, ocr: true, objectDetector: true, reasoningSteps: 5 }), 4);
  assert.ok(heavy > lean);
});

test("over budget runs do not count as solved", () => {
  const c = getVisionCase("object");
  const run = runVisionCase(
    c,
    settings({
      regionGrounding: true,
      objectDetector: true,
      ocr: true,
      cropTool: true,
      groundingRequired: true,
      confidenceThreshold: "high",
      reasoningSteps: 5,
    }),
    ["doorway-visible", "soft-object", "rectangular", "person"]
  );
  assert.equal(run.overBudget, true);
  assert.equal(run.solved, false);
});

test("same inputs produce deterministic scores", () => {
  const c = getVisionCase("object");
  const s = settings({ regionGrounding: true, objectDetector: true });
  assert.deepEqual(runVisionCase(c, s, ["doorway-visible"]), runVisionCase(c, s, ["doorway-visible"]));
});
