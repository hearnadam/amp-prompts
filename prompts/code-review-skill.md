# code-review-skill

_Source: `dist/main.js:263` (symbol `C$4`)_

# Code Review Skill

Run comprehensive code review using the code_review tool.

## Usage

Call `code_review` tool to perform a comprehensive review of code changes or files.

## When to Use

Use this skill when asked to perform a code review or a review of changes to code.

## After the Tool Completes

Display the issues from the result in this EXACT format:

### Code Review Results

**X issues found across Y checks**

| # | Severity | Source | Location | Problem | Why | Fix |
|---|----------|--------|----------|---------|-----|-----|
| 1 | CRITICAL | bigo | file:line | problem text | why text | fix text |
| 2 | HIGH | general | file:line | problem text | why text | fix text |
| 3 | MEDIUM | security | file:line | problem text | why text | fix text |
| 4 | LOW | general | file:line | problem text | why text | fix text |

**Checks performed:** list each check name and patterns it looked for

Then ask: "Would you like me to fix any of these issues? (e.g., 'fix issue #1' or 'fix issues #2 and #3')". Number issues sequentially starting from 1.
