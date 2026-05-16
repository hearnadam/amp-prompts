# Amp CLI Extracted Prompts

Source: /home/runner/work/amp-prompts/amp-prompts/node_modules/@sourcegraph/amp/dist/main.js
Package: @sourcegraph/amp@0.0.1778920904-g408447

Notes:
- Extracted by parsing the bundle with `@babel/parser`, locating prompt-producing arrow functions and template literals, then evaluating each in a `node:vm` sandbox.
- Free identifiers (e.g. `R4`, `V6`) are resolved through a Proxy whose backing map was built from `name = "value"` assignments in the bundle.
- Boolean feature-flag parameters (oracle/diagnostics/check-mode etc.) are forced `true` so all optional sections are included.
- Each prompt is in its own file under `prompts/`.

- [code-review-skill](prompts/code-review-skill.md) — line 684
- [agg-man](prompts/agg-man.md) — line 970
- [amp-autonomous](prompts/amp-autonomous.md) — line 1029
- [amp-pragmatic](prompts/amp-pragmatic.md) — line 1124
- [pair-programming](prompts/pair-programming.md) — line 1282
- [amp-autonomous-2](prompts/amp-autonomous-2.md) — line 1378
- [amp-classic](prompts/amp-classic.md) — line 1602
- [amp-guardrails](prompts/amp-guardrails.md) — line 1870
- [amp-guardrails-2](prompts/amp-guardrails-2.md) — line 2110
- [amp-fast](prompts/amp-fast.md) — line 2341
- [amp-rush-mode](prompts/amp-rush-mode.md) — line 2408
- [amp-base](prompts/amp-base.md) — line 2484
- [agents-md-init](prompts/agents-md-init.md) — line 2533
- [subagent-summary](prompts/subagent-summary.md) — line 3101
- [senior-engineer-reviewer](prompts/senior-engineer-reviewer.md) — line 3524
- [code-search-agent](prompts/code-search-agent.md) — line 3675
- [librarian](prompts/librarian.md) — line 4285
- [file-analyzer](prompts/file-analyzer.md) — line 4379
- [oracle](prompts/oracle.md) — line 4453
- [thread-extractor](prompts/thread-extractor.md) — line 4536
- [task-worker-role](prompts/task-worker-role.md) — line 4639
