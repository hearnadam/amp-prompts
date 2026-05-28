# amp-prompts

Tooling that extracts the system prompts baked into the
[`@sourcegraph/amp`](https://www.npmjs.com/package/@sourcegraph/amp) CLI bundle and
writes human-readable Markdown files under `prompts/` and `skills/`.

The Amp bundle ships as a single minified `dist/main.js`. Each prompt is a
template literal that often takes feature-flag arguments (e.g. `enableOracle`,
`enableDiagnostics`) and references other minified identifiers like `R4`, `V6`,
`AA`. This repo:

1. Pins `@sourcegraph/amp` as a normal dependency so Dependabot can open a PR
   each time a new bundle is published.
2. Parses the installed bundle with `@babel/parser`, locates every arrow
   function or template literal whose body looks like a prompt, and
   evaluates it inside a `node:vm` sandbox.
3. The sandbox's globals are a `Proxy` whose backing map is built from every
   `name = "value"` assignment in the bundle, so a reference to `R4`
   resolves to the string `"finder"`, `V6` to `"Read"`, and so on. Any
   identifier we can't resolve is filled in with a permissive proxy that
   coerces to `""` and is callable, so methods like `dirs.map(...)` don't
   throw.
4. Each prompt-builder function is invoked with all boolean flags forced to
   `true`, so optional sections (oracle, diagnostics, check mode) are always
   included.

## Quick start

```sh
bun install
bun run extract
```

The script writes:

- `prompts/<name>.md` — one file per prompt. The filename is derived from
  Amp's own `basePromptType` switch when the bundle exposes one, then from a
  curated substring lookup table (see `KNOWN_PROMPTS` in
  `extract-amp-prompts.mjs`), then from heuristics that read the first
  "You are …" line. This keeps public Amp names from the Owner's Manual and
  models page (`smart`, `deep`, `rush`, `review`, `search`, `oracle`,
  `librarian`) when a prompt can be tied back to Amp's mode/subagent wiring.
  Trivial prompts (single sentence, no real content) are dropped, as are
  exact-text duplicates.
- `subagents/<name>.md` — one file per extracted subagent prompt. These are
  specialized secondary-agent surfaces such as review, search, oracle, and
  librarian.
- `skills/<name>.md` — one file per extracted skill prompt. Skill-like
  prompts are separated from ordinary prompts so the generated catalog is
  easier to scan.
- the generated catalog below — an index linking to every generated file,
  with the bundle version it was extracted from.

## Catalog

<!-- BEGIN GENERATED CATALOG -->

Source: node_modules/@sourcegraph/amp/dist/main.js
Package: @sourcegraph/amp@0.0.1780001021-g55238e

Notes:
- Extracted by parsing the bundle with `@babel/parser`, locating prompt-producing arrow functions and template literals, then evaluating each in a `node:vm` sandbox.
- Free identifiers (e.g. `R4`, `V6`) are resolved through a Proxy whose backing map was built from `name = "value"` assignments in the bundle.
- Boolean feature-flag parameters (oracle/diagnostics/check-mode etc.) are forced `true` so all optional sections are included.
- Main and utility prompts are written under `prompts/`; subagent prompts under `subagents/`; skill prompts under `skills/`.

## Prompts

- [prompt](prompts/prompt.md) — line 758
- [subagent-summary](prompts/subagent-summary.md) — line 1261
- [thread-reader](prompts/thread-reader.md) — line 2779
- [agg](prompts/agg.md) — line 2892
- [amp-autonomous](prompts/amp-autonomous.md) — line 2951
- [amp-pragmatic](prompts/amp-pragmatic.md) — line 3047
- [pair-programming](prompts/pair-programming.md) — line 3207
- [amp-classic](prompts/amp-classic.md) — line 3305
- [amp-guardrails](prompts/amp-guardrails.md) — line 3574
- [amp-guardrails-2](prompts/amp-guardrails-2.md) — line 3815
- [amp-fast](prompts/amp-fast.md) — line 4047
- [rush](prompts/rush.md) — line 4115
- [amp-base](prompts/amp-base.md) — line 4192
- [agents-md-init](prompts/agents-md-init.md) — line 4222
- [task-worker-role](prompts/task-worker-role.md) — line 4250
- [ai-assistant](prompts/ai-assistant.md) — line 4352

## Subagents

- [review](subagents/review.md) — line 1793
- [search](subagents/search.md) — line 1945
- [librarian](subagents/librarian.md) — line 2558
- [oracle](subagents/oracle.md) — line 2660

## Skills

- [code-review-skill](skills/code-review-skill.md) — line 1054

<!-- END GENERATED CATALOG -->

## Bumping Amp

`@sourcegraph/amp` is pinned exactly in `package.json`. The workflow at
`.github/workflows/update-amp.yml` runs daily, can also be triggered manually,
asks the npm registry for the latest published version with `bun pm view`,
updates the exact pin with `bun add`, runs `bun run extract`, and opens a PR
labelled `amp-bump`.

The workflow at `.github/workflows/regenerate-prompts.yml` also listens for
`amp-bump` PRs that touch `package.json` / `bun.lock`, runs `bun run extract`,
and pushes any regenerated prompt files back onto the same PR branch. This
keeps manual amp-bump PRs and workflow-created amp-bump PRs consistent. It
also enables auto-merge for `amp-bump` PRs opened by `github-actions[bot]` or
`hearnadam`.

## Layout

```
extract-amp-prompts.mjs       # the extractor
package.json                  # pins @sourcegraph/amp
.github/workflows/update-amp.yml
.github/workflows/regenerate-prompts.yml
prompts/                      # generated; refreshed by the workflow
subagents/                    # generated subagent prompts
skills/                       # generated skill prompts
README.md                     # includes the generated catalog
```

## Caveats

- Heuristic naming will sometimes pick a wordy name for a brand-new prompt
  Amp ships. When that happens, add a substring entry to `KNOWN_PROMPTS` in
  the extractor and re-run.
- A prompt whose body is shorter than ~200 characters is dropped on the
  assumption that it's a trivial guard message rather than a real prompt.
  Adjust `MIN_BODY_CHARS` if that turns out to filter too aggressively.
- Free identifiers that map to functions (rather than strings) fall back to
  the permissive proxy. If a future Amp release hits a code path that
  actually needs the real function, the extractor will silently render
  `""` where that call would have produced text.
