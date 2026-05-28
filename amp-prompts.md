# Amp CLI Extracted Prompts

Source: node_modules/@sourcegraph/amp/dist/main.js
Package: @sourcegraph/amp@0.0.1779927513-g17febb

Notes:
- Extracted by parsing the bundle with `@babel/parser`, locating prompt-producing arrow functions and template literals, then evaluating each in a `node:vm` sandbox.
- Free identifiers (e.g. `R4`, `V6`) are resolved through a Proxy whose backing map was built from `name = "value"` assignments in the bundle.
- Boolean feature-flag parameters (oracle/diagnostics/check-mode etc.) are forced `true` so all optional sections are included.
- Each prompt is in its own file under `prompts/`.

- [prompt](prompts/prompt.md) — line 758
- [code-review-skill](prompts/code-review-skill.md) — line 1054
- [subagent-summary](prompts/subagent-summary.md) — line 1261
- [review](prompts/review.md) — line 1793
- [search](prompts/search.md) — line 1945
- [librarian](prompts/librarian.md) — line 2558
- [oracle](prompts/oracle.md) — line 2660
- [thread-reader](prompts/thread-reader.md) — line 2779
- [agg](prompts/agg.md) — line 2892
- [amp-autonomous](prompts/amp-autonomous.md) — line 2951
- [amp-pragmatic](prompts/amp-pragmatic.md) — line 3047
- [pair-programming](prompts/pair-programming.md) — line 3207
- [rush](prompts/rush.md) — line 3305
- [amp-classic](prompts/amp-classic.md) — line 3382
- [amp-guardrails](prompts/amp-guardrails.md) — line 3651
- [amp-guardrails-2](prompts/amp-guardrails-2.md) — line 3892
- [amp-fast](prompts/amp-fast.md) — line 4124
- [amp-base](prompts/amp-base.md) — line 4269
- [agents-md-init](prompts/agents-md-init.md) — line 4299
- [task-worker-role](prompts/task-worker-role.md) — line 4327
- [ai-assistant](prompts/ai-assistant.md) — line 4429
