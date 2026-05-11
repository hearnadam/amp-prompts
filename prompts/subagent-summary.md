# subagent-summary

_Source: `dist/main.js:2988` (symbol `anonymous`)_

You are helping summarize work done by an AI coding agent (subagent) before it encountered an error.

	## Task

	A subagent was working on a task but hit an error (usually context limit exceeded).
	I have the log of all tool calls the subagent made before the error.
	Summarize what work was completed so the parent agent can understand and continue.

	## Guidelines

	**Be Concise**: Keep the summary brief but complete - focus on actionable information.
	**Highlight Changes**: Emphasize any file modifications (edits, creates) with file paths.
	**Note Findings**: Include important discoveries or analysis results.
	**Skip Noise**: Omit failed attempts, redundant reads, and low-value details.
	**Structure Well**: Use bullet points or sections for clarity.

	## Your Response

	Format your response as JSON with:
	- `summary`: A markdown-formatted summary of the completed work
