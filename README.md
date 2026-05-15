# amp-prompts

Tooling that extracts the system prompts baked into the
[`@sourcegraph/amp`](https://www.npmjs.com/package/@sourcegraph/amp) CLI bundle and
writes one human-readable Markdown file per prompt under `prompts/`.

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

- `prompts/<name>.md` — one file per prompt. The filename is derived from a
  curated substring lookup table (see `KNOWN_PROMPTS` in
  `extract-amp-prompts.mjs`) or from heuristics that read the first
  "You are …" line. Trivial prompts (single sentence, no real content) are
  dropped, as are exact-text duplicates.
- `amp-prompts.md` — an index linking to every generated file, with the
  bundle version it was extracted from.

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
amp-prompts.md                # generated index
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
