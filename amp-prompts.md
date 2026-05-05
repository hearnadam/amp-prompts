# Amp CLI Extracted Prompts

Source: /home/runner/work/amp-prompts/amp-prompts/node_modules/@sourcegraph/amp/dist/main.js
Package: @sourcegraph/amp@0.0.1769731386-gb24343

Notes:
- Extracted by parsing the bundle with `@babel/parser`, locating prompt-producing arrow functions and template literals, then evaluating each in a `node:vm` sandbox.
- Free identifiers (e.g. `R4`, `V6`) are resolved through a Proxy whose backing map was built from `name = "value"` assignments in the bundle.
- Boolean feature-flag parameters (oracle/diagnostics/check-mode etc.) are forced `true` so all optional sections are included.
- Each prompt is in its own file under `prompts/`.

- [code-review-skill](prompts/code-review-skill.md) — line 263
- [amp-role-agency](prompts/amp-role-agency.md) — line 612
- [amp](prompts/amp.md) — line 702
- [amp-classic](prompts/amp-classic.md) — line 776
- [amp-guardrails](prompts/amp-guardrails.md) — line 1028
- [amp-guardrails-2](prompts/amp-guardrails-2.md) — line 1251
- [amp-rush-mode](prompts/amp-rush-mode.md) — line 1465
- [amp-rush-mode-2](prompts/amp-rush-mode-2.md) — line 1534
- [amp-base](prompts/amp-base.md) — line 1594
- [amp-classic-2](prompts/amp-classic-2.md) — line 1621
- [agents-md-init](prompts/agents-md-init.md) — line 1950
- [subagent-summary](prompts/subagent-summary.md) — line 2303
- [file-analyzer](prompts/file-analyzer.md) — line 2561
- [repl](prompts/repl.md) — line 2647
- [senior-engineer-reviewer](prompts/senior-engineer-reviewer.md) — line 3060
- [code-search-agent](prompts/code-search-agent.md) — line 3146
- [librarian](prompts/librarian.md) — line 3604
- [oracle](prompts/oracle.md) — line 3757
- [thread-extractor](prompts/thread-extractor.md) — line 3806
- [walkthrough-planner](prompts/walkthrough-planner.md) — line 4028
