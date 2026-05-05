# Amp CLI Extracted Prompts

Source: /home/runner/work/amp-prompts/amp-prompts/node_modules/@sourcegraph/amp/dist/main.js
Package: @sourcegraph/amp@0.0.1777933148-g0690e2

Notes:
- Extracted by parsing the bundle with `@babel/parser`, locating prompt-producing arrow functions and template literals, then evaluating each in a `node:vm` sandbox.
- Free identifiers (e.g. `R4`, `V6`) are resolved through a Proxy whose backing map was built from `name = "value"` assignments in the bundle.
- Boolean feature-flag parameters (oracle/diagnostics/check-mode etc.) are forced `true` so all optional sections are included.
- Each prompt is in its own file under `prompts/`.

- [code-review-skill](prompts/code-review-skill.md) — line 651
- [agg-man](prompts/agg-man.md) — line 937
- [amp-autonomous](prompts/amp-autonomous.md) — line 996
- [amp-pragmatic](prompts/amp-pragmatic.md) — line 1080
- [pair-programming](prompts/pair-programming.md) — line 1238
- [amp-classic](prompts/amp-classic.md) — line 1418
- [amp-guardrails](prompts/amp-guardrails.md) — line 1686
- [amp-guardrails-2](prompts/amp-guardrails-2.md) — line 1926
- [amp-fast](prompts/amp-fast.md) — line 2157
- [amp-rush-mode](prompts/amp-rush-mode.md) — line 2224
- [amp-base](prompts/amp-base.md) — line 2300
- [agents-md-init](prompts/agents-md-init.md) — line 2349
- [subagent-summary](prompts/subagent-summary.md) — line 2935
- [senior-engineer-reviewer](prompts/senior-engineer-reviewer.md) — line 3338
- [code-search-agent](prompts/code-search-agent.md) — line 3489
- [librarian](prompts/librarian.md) — line 4099
- [file-analyzer](prompts/file-analyzer.md) — line 4193
- [oracle](prompts/oracle.md) — line 4267
- [thread-extractor](prompts/thread-extractor.md) — line 4350
