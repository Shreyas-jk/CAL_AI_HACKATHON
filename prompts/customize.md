# Customize prompt

After classification picks a template, the pipeline calls a **customize** step that generates
template-specific `content` for the game. This step makes each game feel tailored to the
specific paper rather than using hardcoded defaults.

## How it works

1. The pipeline classifies the paper into a template (via `SYS_CLASSIFY`).
2. `lib/customize.ts` → `customizeGame()` looks up the template in `lib/templateSpecs.ts`.
3. It builds a prompt with the template's mechanics, content schema, and an example.
4. Claude generates a JSON object matching the content schema.
5. The result is stored in `game.content` alongside `game.params`.
6. Each template reads from `game.content?.key` with fallback to hardcoded defaults.

## Content schemas by template

### pathfinding
```json
{ "scenarioContext": "string", "heuristicDescription": "string" }
```

### attention
```json
{ "sentences": [{ "tokens": ["string"], "answer": 0, "explanation": "string" }] }
```

### fine-tuning-alignment
```json
{
  "contextDescription": "string",
  "outputExamples": { "low": "string", "sweet": "string", "high": "string" },
  "curveLabel": "string"
}
```

### reasoning
```json
{
  "theme": "string",
  "sessionNames": ["string x6"],
  "roomNames": ["string x3"],
  "slotLabels": ["string x4"]
}
```

### vision-detective
```json
{ "investigationContext": "string", "caseLessons": ["string x3"] }
```

### gridworld-rl
```json
{ "hazardType": "string", "rewardDescription": "string" }
```

### epidemic
```json
{ "spreadContext": "string" }
```

## Failure handling

- If Claude is not available (`!hasClaude()`), content is `{}`.
- If the customize call fails, content is `{}`.
- Templates always fall back to hardcoded defaults when content is missing or malformed.

> **Runtime source:** `lib/customize.ts` + `lib/templateSpecs.ts`.
