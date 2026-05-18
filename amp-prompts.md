# Amp CLI Extracted Prompts

Source: /home/runner/work/amp-prompts/amp-prompts/node_modules/@sourcegraph/amp/dist/main.js
Package: @sourcegraph/amp@0.0.1779099005-g16da7b

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
- [amp-autonomous-2](prompts/amp-autonomous-2.md) — line 1384
- [amp-classic](prompts/amp-classic.md) — line 1608
- [amp-guardrails](prompts/amp-guardrails.md) — line 1876
- [amp-guardrails-2](prompts/amp-guardrails-2.md) — line 2116
- [amp-fast](prompts/amp-fast.md) — line 2347
- [amp-rush-mode](prompts/amp-rush-mode.md) — line 2414
- [amp-base](prompts/amp-base.md) — line 2490
- [agents-md-init](prompts/agents-md-init.md) — line 2539
- [subagent-summary](prompts/subagent-summary.md) — line 3105
- [senior-engineer-reviewer](prompts/senior-engineer-reviewer.md) — line 3527
- [code-search-agent](prompts/code-search-agent.md) — line 3678
- [librarian](prompts/librarian.md) — line 4288
- [oracle](prompts/oracle.md) — line 4390
- [thread-extractor](prompts/thread-extractor.md) — line 4473
- [task-worker-role](prompts/task-worker-role.md) — line 4576
- [ai-assistant](prompts/ai-assistant.md) — line 4675
