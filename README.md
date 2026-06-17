# amp-prompts

## Update Status

This repo is no longer updated automatically. It is pinned to
`@ampcode/cli@0.0.1781102632-gaaab69`, the last checked version whose CLI
bundle still contained extractable prompt bodies.

Later `@ampcode/cli` builds expose built-in prompt identifiers such as
`smart`, `deep`, `rush`, and `review`, plus `promptFragments` identifiers, but
not the prompt bodies this extractor was built to recover. Future bumps should
be done manually only after the extractor is updated for the new prompt source.

See [Prompt Construction After Embedded Prompt Bodies](docs/prompt-construction.md)
for a reconstruction of the newer prompt assembly path.

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

1. Pins `@ampcode/cli` to the last version found to still embed prompt bodies:
   `0.0.1781102632-gaaab69`.
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

Source: node_modules/@ampcode/cli-darwin-arm64/amp#embedded-js@62734374
Package: @ampcode/cli@0.0.1781102632-gaaab69

Notes:
- Extracted by parsing the bundle with `@babel/parser`, locating prompt-producing arrow functions and template literals, then evaluating each in a `node:vm` sandbox.
- Free identifiers (e.g. `R4`, `V6`) are resolved through a Proxy whose backing map was built from `name = "value"` assignments in the bundle.
- Boolean feature-flag parameters (oracle/diagnostics/check-mode etc.) are forced `true` so all optional sections are included.
- Main and utility prompts are written under `prompts/`; subagent prompts under `subagents/`; skill prompts under `skills/`.

## Prompts

- [ai-assistant](prompts/ai-assistant.md) — line 2211
- [subagent-summary](prompts/subagent-summary.md) — line 4476

## Subagents

- [review](subagents/review.md) — line 1933

## Skills

- [code-review-skill](skills/code-review-skill.md) — line 1804

<!-- END GENERATED CATALOG -->

## Layout

```
extract-amp-prompts.mjs       # the extractor
package.json                  # pins @ampcode/cli
.github/workflows/regenerate-prompts.yml
prompts/                      # generated prompt output
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
- Extraction fails before rewriting generated files if no main prompt files are
  found. This keeps a manual future bump from erasing the prompt catalog.
- Free identifiers that map to functions (rather than strings) fall back to
  the permissive proxy. If a future Amp release hits a code path that
  actually needs the real function, the extractor will silently render
  `""` where that call would have produced text.
