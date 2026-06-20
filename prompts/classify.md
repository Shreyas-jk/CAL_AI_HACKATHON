# Classify prompt
Given the paper's category and summary, choose the best game template id from:
pathfinding | attention | gridworld-rl | epidemic | none.
Return ONLY JSON: { "template", "confidence" (0..1), "goal", "baselineLabel", "powerupLabel", "claim", "params" }.
params are numeric knobs for the chosen template.
