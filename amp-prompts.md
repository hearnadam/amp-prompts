# Amp CLI Extracted Prompts

Source: /home/runner/work/amp-prompts/amp-prompts/node_modules/@sourcegraph/amp/dist/main.js
Package: @sourcegraph/amp@0.0.1779525469-ge68d87

Notes:
- Extracted by parsing the bundle with `@babel/parser`, locating prompt-producing arrow functions and template literals, then evaluating each in a `node:vm` sandbox.
- Free identifiers (e.g. `R4`, `V6`) are resolved through a Proxy whose backing map was built from `name = "value"` assignments in the bundle.
- Boolean feature-flag parameters (oracle/diagnostics/check-mode etc.) are forced `true` so all optional sections are included.
- Each prompt is in its own file under `prompts/`.

- [code-review-skill](prompts/code-review-skill.md) — line 690
- [agg-man](prompts/agg-man.md) — line 976
- [amp-autonomous](prompts/amp-autonomous.md) — line 1035
- [amp-pragmatic](prompts/amp-pragmatic.md) — line 1130
- [pair-programming](prompts/pair-programming.md) — line 1288
- [amp](prompts/amp.md) — line 1384
- [amp-classic](prompts/amp-classic.md) — line 1461
- [amp-guardrails](prompts/amp-guardrails.md) — line 1729
- [amp-guardrails-2](prompts/amp-guardrails-2.md) — line 1969
- [amp-fast](prompts/amp-fast.md) — line 2200
- [amp-base](prompts/amp-base.md) — line 2344
- [agents-md-init](prompts/agents-md-init.md) — line 2393
- [subagent-summary](prompts/subagent-summary.md) — line 2954
- [senior-engineer-reviewer](prompts/senior-engineer-reviewer.md) — line 3377
- [code-search-agent](prompts/code-search-agent.md) — line 3529
- [librarian](prompts/librarian.md) — line 4142
- [oracle](prompts/oracle.md) — line 4244
- [thread-extractor](prompts/thread-extractor.md) — line 4327
- [task-worker-role](prompts/task-worker-role.md) — line 4430
- [ai-assistant](prompts/ai-assistant.md) — line 4532
