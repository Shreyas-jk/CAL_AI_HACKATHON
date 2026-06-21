import type { VisionCase, VisionSettings } from "./types";

export const DEFAULT_VISION_SETTINGS: VisionSettings = {
  regionGrounding: false,
  ocr: false,
  objectDetector: false,
  cropTool: false,
  groundingRequired: false,
  confidenceThreshold: "low",
  reasoningSteps: 1,
};

export const VISION_CASES: VisionCase[] = [
  {
    id: "object",
    title: "Object Case",
    subtitle: "Ground the blocker",
    objective: "Identify the object blocking the doorway.",
    prompt: "What is blocking the doorway?",
    hiddenTarget: "cardboard box",
    correctAnswer: "A cardboard box is blocking the doorway.",
    decoyAnswer: "The backpack is blocking the doorway.",
    lesson: "Vision-language answers need region-level evidence, not broad scene guesses.",
    scene: "doorway",
    evidence: [
      { id: "box", label: "blocking box", x: 42, y: 54, width: 26, height: 24, kind: "target" },
      { id: "backpack", label: "blue backpack false lead", x: 13, y: 55, width: 24, height: 29, kind: "decoy" },
    ],
    questions: [
      { id: "doorway-visible", text: "Is the target near the doorway?", answer: true, clue: "The useful evidence sits at the door threshold.", relevance: 2 },
      { id: "soft-object", text: "Is the target soft like a bag?", answer: false, clue: "The target has flat rigid edges.", relevance: 2 },
      { id: "rectangular", text: "Is the target rectangular?", answer: true, clue: "The target has a box-like silhouette.", relevance: 3 },
      { id: "person", text: "Is a person blocking the doorway?", answer: false, clue: "No person is in the evidence region.", relevance: 1 },
    ],
  },
  {
    id: "ocr",
    title: "OCR Case",
    subtitle: "Read the receipt",
    objective: "Find the most expensive receipt item.",
    prompt: "Which item costs the most?",
    hiddenTarget: "tea set",
    correctAnswer: "The tea set costs the most at $18.40.",
    decoyAnswer: "The model guesses the lamp is most expensive.",
    lesson: "Document and chart questions often require OCR before language reasoning can help.",
    scene: "receipt",
    evidence: [
      { id: "tea", label: "TEA SET $18.40", x: 39, y: 50, width: 33, height: 11, kind: "text" },
      { id: "lamp", label: "LAMP $12.20", x: 39, y: 35, width: 31, height: 10, kind: "decoy" },
    ],
    questions: [
      { id: "text-needed", text: "Does the answer require reading text?", answer: true, clue: "The key evidence is printed on the receipt.", relevance: 3 },
      { id: "lamp-highest", text: "Is the lamp the highest price?", answer: false, clue: "The lamp is visible but not the max price.", relevance: 2 },
      { id: "tea-highest", text: "Is the tea set above $18?", answer: true, clue: "OCR reveals TEA SET $18.40.", relevance: 3 },
      { id: "color-clue", text: "Can color alone answer the question?", answer: false, clue: "Object salience is not enough for price comparison.", relevance: 2 },
    ],
  },
  {
    id: "hallucination",
    title: "Hallucination Case",
    subtitle: "Catch the missing cat",
    objective: "Refuse the unsupported cat question.",
    prompt: "What color is the cat on the counter?",
    hiddenTarget: "no visible cat",
    correctAnswer: "There is no cat visible on the counter.",
    decoyAnswer: "The cat is orange.",
    lesson: "Grounding and uncertainty thresholds help VLMs refuse unsupported visual claims.",
    scene: "counter",
    evidence: [
      { id: "mug", label: "mug", x: 26, y: 52, width: 16, height: 18, kind: "decoy" },
      { id: "fruit", label: "fruit bowl", x: 54, y: 55, width: 22, height: 16, kind: "decoy" },
      { id: "missing-cat", label: "no cat found", x: 35, y: 31, width: 42, height: 32, kind: "missing" },
    ],
    questions: [
      { id: "cat-visible", text: "Is a cat visible anywhere?", answer: false, clue: "No grounded region contains a cat.", relevance: 3 },
      { id: "animal-visible", text: "Is there any animal in the image?", answer: false, clue: "The scene contains objects, not animals.", relevance: 3 },
      { id: "mug-present", text: "Is there a mug on the counter?", answer: true, clue: "A mug is present, but it is not a cat.", relevance: 1 },
      { id: "fruit-present", text: "Is there fruit on the counter?", answer: true, clue: "Fruit is present and may distract a weak model.", relevance: 1 },
    ],
  },
];

export function getVisionCase(id: string): VisionCase {
  return VISION_CASES.find((c) => c.id === id) ?? VISION_CASES[0];
}
