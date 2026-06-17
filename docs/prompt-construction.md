# Prompt Construction After Embedded Prompt Bodies

This note reconstructs how recent `@ampcode/cli` builds appear to construct
agent prompts after the CLI stopped embedding the full prompt text.

The investigation used `@ampcode/cli-darwin-arm64@0.0.1781601196-gacc35e` by
unpacking the package, extracting the embedded JavaScript bundle from the
native binary, and searching the extracted bundle. The older pinned build,
`0.0.1781102632-gaaab69`, still embeds prompt bodies. Newer builds do not.

## What Changed

Older bundles included large template literals whose text began with markers
such as `You are Amp`, `Code Review Skill`, `AGENTS.md guidance`, and other
prompt-like prose. The extractor found those template literals and rendered
them locally.

In the newer bundle, those bodies are absent. The bundle still includes agent
mode configuration, but the prompt fields are identifiers:

| Mode | Model | `systemPrompt` | `promptFragments` |
| --- | --- | --- | --- |
| `deep` | `openai/gpt-5.5` | `deep` | `diagrams`, `threadLinks`, `toolConnectionError`, `guidanceFiles` |
| `smart` | `anthropic/claude-opus-4-8` | `smart` | `diagrams`, `fileLinks`, `threadLinks`, `toolConnectionError`, `guidanceFiles` |
| `rush` | `openai/gpt-5.5` | `rush` | `threadLinks`, `toolConnectionError`, `guidanceFiles` |
| `review` | `openai/gpt-5.5` | `review` | `toolConnectionError`, `guidanceFiles` |
| `agg-man` | `anthropic/claude-opus-4-6` | `aggman` | `threadLinks` |
| `large` | `anthropic/claude-opus-4-8` | `large` | `diagrams`, `fileLinks`, `threadLinks`, `toolConnectionError`, `guidanceFiles` |
| `nostromo` | `amp/amp-nostromo-v1` | `nostromo` | `diagrams`, `fileLinks`, `threadLinks`, `toolConnectionError`, `guidanceFiles` |

The same config also carries mode descriptions, default reasoning effort,
visible/internal flags, UI colors, and tool allowlists. That means the CLI
still owns mode selection and local UI/tool policy, but not the static prompt
body text.

## Local Flow

The user-facing flow looks like this:

1. The UI chooses an `agentMode`, normally `smart`, `deep`, or `rush`.
2. The client creates a thread actor through `POST /api/thread-actors`.
3. For a built-in mode, the request includes `agentMode`.
4. For a plugin/custom agent, the request includes an `agent` object instead.
5. The server returns `threadId`, `wsToken`, `poolName`, owner/version fields,
   and a thread-actor connection target.
6. The CLI connects to the thread actor and appends user messages with a
   `client_append_user_msg` JSON-RPC payload containing `content`, `agentMode`,
   optional `reasoningEffort`, message metadata, steering flags, and user state.

In pseudocode, the built-in path is approximately:

```js
createNewThread(agentMode, threadSettings, visibility, customAgent)
  -> createClient({
       agentMode,
       agent: customAgent,
       executorType: "local-client",
       parentThreadID,
       threadMeta
     })
  -> POST /api/thread-actors
  -> connect to returned thread actor
  -> client_append_user_msg({ content, agentMode, reasoningEffort, ... })
```

The important boundary is `POST /api/thread-actors`: the newer CLI forwards
mode or custom-agent metadata to the backend/thread actor. It does not appear
to expand `systemPrompt` or `promptFragments` into prose locally.

## Custom Agents

The plugin API exposes two agent shapes:

- Built-in agent reference:

```ts
{ kind: "builtin-agent", mode: "smart" | "deep" | "rush", reasoningEffort? }
```

- Custom agent definition:

```ts
{
  kind: "agent-definition",
  model: string,
  instructions: string,
  tools?: AgentToolSelection,
  reasoningEffort?: AgentReasoningEffort,
  display?: AgentDisplay
}
```

The embedded plugin API docs say custom-agent `instructions` are appended to
Amp's base agent prompt. That is a useful clue: Amp still has a base prompt,
but recent CLI builds no longer ship it as a local string. The base prompt is
likely selected by `systemPrompt` and assembled by the backend/thread actor,
with custom instructions layered on top.

## What `promptFragments` Probably Mean

The fragment names look like prompt-module keys, not rendered prompt content:

- `guidanceFiles` likely injects workspace guidance such as `AGENTS.md`,
  `Agents.md`, `CLAUDE.md`, and related files. The newer bundle still contains
  guidance-file discovery code and a `guidanceInventory` thread-actor event.
- `threadLinks` likely adds thread-reference context.
- `fileLinks` likely adds file-link context available to supported modes.
- `diagrams` likely enables diagram/media-related guidance.
- `toolConnectionError` likely adds standard handling guidance for tool
  connection failures.

These are inferences from names and surrounding code. The key point is that
the bundle does not contain a local map from these fragment keys to prose.

## Why `promptFragments` Is Not Enough To Extract Prompts

Searching the extracted newer bundle found:

- `systemPrompt` only in mode configuration and schemas.
- `promptFragments` only in mode configuration.
- Fragment IDs only as string values in those arrays.
- No old prompt-body markers such as `You are Amp`, `Code Review Skill`,
  `AGENTS.md guidance`, `You are the Oracle`, or `You are the Librarian`.

So `promptFragments` is enough to extract a mode manifest, but not enough to
reconstruct the prompt text. A future extractor could produce a useful metadata
catalog for current Amp releases:

```json
{
  "mode": "smart",
  "model": "anthropic/claude-opus-4-8",
  "systemPrompt": "smart",
  "promptFragments": [
    "diagrams",
    "fileLinks",
    "threadLinks",
    "toolConnectionError",
    "guidanceFiles"
  ],
  "tools": ["finder", "Bash", "..."],
  "reasoningEffort": "high"
}
```

That would be interesting, but it would be a different artifact from this
repo's original goal of recovering full prompt bodies.

## Reconstructed Architecture

The best current model is:

```text
CLI mode table
  -> mode key, model, tool policy, systemPrompt ID, prompt fragment IDs
  -> thread actor creation request
  -> server/thread actor expands systemPrompt + fragments + dynamic context
  -> user message appended over thread actor RPC
  -> inference tools and agent state stream back to the CLI
```

This explains why extraction broke cleanly at the version boundary. The CLI
still knows which prompt family and fragments to request, but the prompt prose
is no longer recoverable from the package alone.
