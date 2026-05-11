# Amp CLI Extracted Prompts

Source: /Users/akinventor/Documents/repos/amp-prompts/node_modules/@sourcegraph/amp/dist/main.js
Package: @sourcegraph/amp@0.0.1778501018-gf409dd

Notes:
- Extracted by parsing the bundle with `@babel/parser`, locating prompt-producing arrow functions and template literals, then evaluating each in a `node:vm` sandbox.
- Free identifiers (e.g. `R4`, `V6`) are resolved through a Proxy whose backing map was built from `name = "value"` assignments in the bundle.
- Boolean feature-flag parameters (oracle/diagnostics/check-mode etc.) are forced `true` so all optional sections are included.
- Each prompt is in its own file under `prompts/`.

- [code-review-skill](prompts/code-review-skill.md) — line 684
- [agg-man](prompts/agg-man.md) — line 970
- [amp-autonomous](prompts/amp-autonomous.md) — line 1029
- [amp-pragmatic](prompts/amp-pragmatic.md) — line 1115
- [pair-programming](prompts/pair-programming.md) — line 1273
- [amp-autonomous-2](prompts/amp-autonomous-2.md) — line 1369
- [amp-classic](prompts/amp-classic.md) — line 1489
- [amp-guardrails](prompts/amp-guardrails.md) — line 1757
- [amp-guardrails-2](prompts/amp-guardrails-2.md) — line 1997
- [amp-fast](prompts/amp-fast.md) — line 2228
- [amp-rush-mode](prompts/amp-rush-mode.md) — line 2295
- [amp-base](prompts/amp-base.md) — line 2371
- [agents-md-init](prompts/agents-md-init.md) — line 2420
- [subagent-summary](prompts/subagent-summary.md) — line 2988
- [senior-engineer-reviewer](prompts/senior-engineer-reviewer.md) — line 3392
- [code-search-agent](prompts/code-search-agent.md) — line 3543
- [librarian](prompts/librarian.md) — line 4153
- [file-analyzer](prompts/file-analyzer.md) — line 4247
- [oracle](prompts/oracle.md) — line 4321
- [thread-extractor](prompts/thread-extractor.md) — line 4404
