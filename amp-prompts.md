# Amp CLI Extracted Prompts

Source: node_modules/@sourcegraph/amp/dist/main.js
Package: @sourcegraph/amp@0.0.1779872458-g7b0532

Notes:
- Extracted by parsing the bundle with `@babel/parser`, locating prompt-producing arrow functions and template literals, then evaluating each in a `node:vm` sandbox.
- Free identifiers (e.g. `R4`, `V6`) are resolved through a Proxy whose backing map was built from `name = "value"` assignments in the bundle.
- Boolean feature-flag parameters (oracle/diagnostics/check-mode etc.) are forced `true` so all optional sections are included.
- Each prompt is in its own file under `prompts/`.

- [code-review-skill](prompts/code-review-skill.md) — line 690
- [agg](prompts/agg.md) — line 976
- [deep](prompts/deep.md) — line 1035
- [deep-gpt5-4](prompts/deep-gpt5-4.md) — line 1130
- [smart](prompts/smart.md) — line 1288
- [rush](prompts/rush.md) — line 2267
- [gemini](prompts/gemini.md) — line 1461
- [gpt](prompts/gpt.md) — line 1729
- [gpt-5-codex](prompts/gpt-5-codex.md) — line 1969
- [kimi](prompts/kimi.md) — line 2200
- [xai](prompts/xai.md) — line 2344
- [agents-md-init](prompts/agents-md-init.md) — line 2393
- [subagent-summary](prompts/subagent-summary.md) — line 2952
- [review](prompts/review.md) — line 3373
- [search](prompts/search.md) — line 3525
- [librarian](prompts/librarian.md) — line 4138
- [oracle](prompts/oracle.md) — line 4240
- [thread-extractor](prompts/thread-extractor.md) — line 4323
- [task-worker-role](prompts/task-worker-role.md) — line 4426
- [ai-assistant](prompts/ai-assistant.md) — line 4528
