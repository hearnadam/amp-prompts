# code-review-skill

_Source: `dist/main.js:684` (symbol `Dk6`)_

# Code Review Skill

Run comprehensive code review using the code_review tool.

## Usage

Call `code_review` tool to perform a comprehensive review of code changes or files.

## When to Use

Use this skill when asked to perform a code review or a review of changes to code.

## After the Tool Completes

Display the issues as a concise markdown numbered list. Each item is one line in this format:

1. source (severity) - [file-basename](file-path#range): one sentence summary

Example:

1. security (critical) - [auth.ts](src/auth/auth.ts#L10-L15): JWT secret is hardcoded
2. general (high) - [server.ts](src/server.ts#L42): Missing error handling on database connection

If no issues were found, say so briefly.

Mention which checks were run (if any) and their results.

If issues were found, offer to fix them and make it clear how to reply.
