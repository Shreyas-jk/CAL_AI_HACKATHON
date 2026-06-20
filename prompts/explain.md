# Explain prompt
Produce a plain-English explanation and a concept map.
Return ONLY JSON: { "plainEnglish": string[] (4-6 short steps), "concept": { "nodes":[{id,label,group}], "edges":[{source,target,label}] } }.
Keep node ids short and lowercase.
