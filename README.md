# amp-prompts

Tooling that extracts the system prompts baked into the
[`@ampcode/cli`](https://www.npmjs.com/package/@ampcode/cli) CLI and
writes human-readable Markdown files under `prompts/`, `subagents/`, and
`skills/`.

Older `@sourcegraph/amp` packages shipped a single minified `dist/main.js`.
Amp now ships through `@ampcode/cli`, whose platform packages contain a native
executable with the bundled JavaScript embedded inside it. The extractor
supports both layouts: it reads the legacy `dist/main.js` when present,
otherwise scans the installed native Amp binary for the embedded bundle. Each
prompt is a template literal that often takes feature-flag arguments (e.g.
`enableOracle`, `enableDiagnostics`) and references other minified identifiers
like `R4`, `V6`, `AA`. This repo:

1. Pins `@ampcode/cli` as a normal dependency so Dependabot can open a PR
   each time a new bundle is published.
2. Parses the installed bundle with `@babel/parser`, locates every arrow
   function or template literal whose body looks like a prompt, rejects
   generated runtime bundles and trivial guard strings, and evaluates each
   candidate inside a `node:vm` sandbox.
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

Source: node_modules/@ampcode/cli-linux-x64/amp#embedded-js@94535715
Package: @ampcode/cli@0.0.1781345939-g79ca9e

Notes:
- Extracted by parsing the bundle with `@babel/parser`, locating prompt-producing arrow functions and template literals, then evaluating each in a `node:vm` sandbox.
- Free identifiers (e.g. `R4`, `V6`) are resolved through a Proxy whose backing map was built from `name = "value"` assignments in the bundle.
- Boolean feature-flag parameters (oracle/diagnostics/check-mode etc.) are forced `true` so all optional sections are included.
- Main and utility prompts are written under `prompts/`; subagent prompts under `subagents/`; skill prompts under `skills/`.

## Prompts


## Subagents


## Skills


<!-- END GENERATED CATALOG -->

## Bumping Amp

`@ampcode/cli` is pinned exactly in `package.json`. The workflow at
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
package.json                  # pins @ampcode/cli
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
