import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import vm from 'node:vm';
import { parse } from '@babel/parser';

const ROOT = path.dirname(url.fileURLToPath(import.meta.url));
const AMP_PKG_DIR = path.join(ROOT, 'node_modules', '@sourcegraph', 'amp');
const BUNDLE = path.join(AMP_PKG_DIR, 'dist', 'main.js');
const PKG = path.join(AMP_PKG_DIR, 'package.json');
const PROMPTS_DIR = path.join(ROOT, 'prompts');
const INDEX_FILE = path.join(ROOT, 'amp-prompts.md');

const source = fs.readFileSync(BUNDLE, 'utf8');
const pkg = JSON.parse(fs.readFileSync(PKG, 'utf8'));

console.log('Parsing bundle...');
const ast = parse(source, {
  sourceType: 'unambiguous',
  errorRecovery: true,
  plugins: ['jsx'],
});

// Build identifier -> string-constant map for free variables (like R4="finder").
// Walk the AST collecting all `Identifier = StringLiteral` assignments and pick the
// shortest, most identifier-like value when an identifier is reassigned.
const identCandidates = new Map();
function walk(node, visit) {
  if (!node || typeof node !== 'object') return;
  visit(node);
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'start' || key === 'end' || key === 'extra') continue;
    const child = node[key];
    if (Array.isArray(child)) child.forEach((c) => walk(c, visit));
    else if (child && typeof child === 'object' && child.type) walk(child, visit);
  }
}

walk(ast, (n) => {
  if (n.type === 'VariableDeclarator' && n.id?.type === 'Identifier' && n.init?.type === 'StringLiteral') {
    const arr = identCandidates.get(n.id.name) ?? [];
    arr.push(n.init.value);
    identCandidates.set(n.id.name, arr);
  } else if (n.type === 'AssignmentExpression' && n.operator === '=' && n.left?.type === 'Identifier' && n.right?.type === 'StringLiteral') {
    const arr = identCandidates.get(n.left.name) ?? [];
    arr.push(n.right.value);
    identCandidates.set(n.left.name, arr);
  }
});

const identMap = new Map();
for (const [name, values] of identCandidates) {
  const ranked = [...new Set(values)].sort((a, b) => {
    const score = (s) => {
      let n = 0;
      if (/^[A-Za-z][\w.\-]{0,30}$/.test(s)) n += 100;
      if (s.length <= 24) n += 20;
      n -= s.length;
      return -n;
    };
    return score(a) - score(b);
  });
  identMap.set(name, ranked[0]);
}
console.log(`Collected ${identMap.size} identifier candidates.`);

// Find prompt-producing nodes:
//   1. Arrow/Function expressions whose body is (or returns) a template literal containing prompt-y text.
//   2. Top-level template literals containing prompt-y text (already-rendered prompts).
const PROMPT_RE = /You are|Please analyze|AGENTS\.md guidance|MUST answer|fast, parallel code search agent|Librarian|REPL operator|code review|Additional instructions from the user/i;
const STARTS_LIKE_PROMPT = /^(#|You are|Please analyze|AGENTS\.md guidance|MUST answer|The following|Run comprehensive|Remember:|Additional instructions from the user)/i;

function lineOf(node) {
  return node.loc?.start?.line ?? 0;
}

function nameForNode(node, parent) {
  if (parent?.type === 'VariableDeclarator' && parent.id?.type === 'Identifier') return parent.id.name;
  if (parent?.type === 'AssignmentExpression' && parent.left?.type === 'Identifier') return parent.left.name;
  if (parent?.type === 'Property' && parent.key?.name) return parent.key.name;
  if (node.id?.name) return node.id.name;
  return 'anonymous';
}

function templateLiteralText(tpl) {
  return tpl.quasis.map((q) => q.value.cooked ?? q.value.raw).join('');
}

// Walk again, this time tracking parent for naming.
const candidates = [];

function walkWithParent(node, parent) {
  if (!node || typeof node !== 'object' || !node.type) return;

  // Case A: arrow/function whose body is a TemplateLiteral.
  if ((node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression' || node.type === 'FunctionDeclaration')) {
    let tpl = null;
    if (node.body?.type === 'TemplateLiteral') tpl = node.body;
    else if (node.body?.type === 'BlockStatement') {
      const ret = node.body.body.find((s) => s.type === 'ReturnStatement' && s.argument?.type === 'TemplateLiteral');
      if (ret) tpl = ret.argument;
    }
    if (tpl) {
      const sample = templateLiteralText(tpl);
      if (PROMPT_RE.test(sample) && STARTS_LIKE_PROMPT.test(sample.trim())) {
        candidates.push({
          kind: 'function',
          node,
          parent,
          line: lineOf(node),
          name: nameForNode(node, parent),
        });
        // Don't recurse into prompt-producing functions — we'll evaluate them whole.
        return;
      }
    }
  }

  // Case B: a bare TemplateLiteral that looks like a prompt.
  if (node.type === 'TemplateLiteral' && (parent?.type !== 'ReturnStatement' && parent?.type !== 'ArrowFunctionExpression')) {
    const sample = templateLiteralText(node);
    if (PROMPT_RE.test(sample) && STARTS_LIKE_PROMPT.test(sample.trim())) {
      candidates.push({
        kind: 'template',
        node,
        parent,
        line: lineOf(node),
        name: nameForNode(node, parent),
      });
    }
  }

  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'start' || key === 'end' || key === 'extra') continue;
    const child = node[key];
    if (Array.isArray(child)) child.forEach((c) => walkWithParent(c, node));
    else if (child && typeof child === 'object' && child.type) walkWithParent(child, node);
  }
}

walkWithParent(ast, null);
console.log(`Found ${candidates.length} prompt candidates.`);

// Evaluate each candidate by extracting its source slice and running it in a fresh vm
// context whose globals are a Proxy that resolves unknown identifiers from identMap (so
// `R4` evaluates to the string `"finder"`, etc.). For function candidates, call the
// function with all boolean parameters set to `true` so optional sections are included.

function makeSandbox() {
  const target = {};
  const handler = {
    has() { return true; },
    get(t, prop) {
      if (prop === Symbol.unscopables) return undefined;
      if (Reflect.has(t, prop)) return Reflect.get(t, prop);
      if (typeof prop !== 'string') return undefined;
      if (prop === 'undefined') return undefined;
      if (prop === 'globalThis') return globalThis;
      if (prop === 'console') return console;
      if (identMap.has(prop)) return identMap.get(prop);
      // Unknown free var: return a permissive value that's callable, indexable, and stringifies to "".
      return permissive(prop);
    },
    set(t, prop, value) {
      return Reflect.set(t, prop, value);
    },
  };
  return new Proxy(target, handler);
}

function extractFunctionParamNames(node) {
  const names = [];
  for (const p of node.params) {
    if (p.type === 'Identifier') names.push(p.name);
    else if (p.type === 'AssignmentPattern' && p.left.type === 'Identifier') names.push(p.left.name);
    else if (p.type === 'ObjectPattern') {
      for (const prop of p.properties) {
        if (prop.type === 'ObjectProperty' || prop.type === 'Property') {
          const v = prop.value;
          if (v?.type === 'Identifier') names.push(v.name);
          else if (v?.type === 'AssignmentPattern' && v.left.type === 'Identifier') names.push(v.left.name);
        }
      }
    }
  }
  return names;
}

// A Proxy that pretends to be any shape: arrays return empty, function calls return self,
// property access returns another permissive proxy, but coerces to "" for string contexts.
function permissive(label = 'value') {
  const fn = function () { return permissive(label); };
  fn.toString = () => '';
  fn[Symbol.toPrimitive] = () => '';
  return new Proxy(fn, {
    get(t, prop) {
      if (prop === 'length') return 0;
      if (prop === Symbol.iterator) return function* () {}.bind(t);
      if (prop === Symbol.toPrimitive) return () => '';
      if (prop === 'toString') return () => '';
      if (prop === 'map' || prop === 'filter' || prop === 'flatMap') return () => [];
      if (prop === 'forEach') return () => undefined;
      if (prop === 'join') return () => '';
      if (prop === 'then') return undefined;
      if (typeof prop === 'symbol') return undefined;
      return permissive(`${label}.${String(prop)}`);
    },
    apply() { return permissive(label); },
  });
}

function buildAllTrueArgFor(node) {
  if (node.params.length === 0) return [];
  const first = node.params[0];
  if (first.type === 'ObjectPattern') {
    const obj = {};
    for (const prop of first.properties) {
      if (prop.type === 'ObjectProperty' || prop.type === 'Property') {
        if (prop.key?.type === 'Identifier') obj[prop.key.name] = true;
        else if (prop.key?.type === 'StringLiteral') obj[prop.key.value] = true;
      }
    }
    return [obj];
  }
  // Non-destructured first param: pass a permissive proxy so arbitrary `.dirs.map(...)` etc. work.
  return [permissive(first.type === 'Identifier' ? first.name : 'arg')];
}

function renderFunctionCandidate(cand) {
  const slice = source.slice(cand.node.start, cand.node.end);
  const args = buildAllTrueArgFor(cand.node);
  const sandbox = makeSandbox();
  const ctx = vm.createContext(sandbox);
  // Wrap as expression that evaluates to the function, then call it.
  const code = `(${slice})`;
  const fn = vm.runInContext(code, ctx, { timeout: 1000 });
  if (typeof fn !== 'function') throw new Error(`Not a function: ${cand.name}`);
  // Re-run in context so the call also sees the proxy globals.
  ctx.__fn = fn;
  ctx.__args = args;
  return vm.runInContext('__fn(...__args)', ctx, { timeout: 1000 });
}

function renderTemplateCandidate(cand) {
  const slice = source.slice(cand.node.start, cand.node.end);
  const sandbox = makeSandbox();
  const ctx = vm.createContext(sandbox);
  return vm.runInContext(`(${slice})`, ctx, { timeout: 1000 });
}

const rendered = [];
for (const cand of candidates) {
  try {
    const text = cand.kind === 'function' ? renderFunctionCandidate(cand) : renderTemplateCandidate(cand);
    if (typeof text === 'string' && text.trim().length > 0) {
      rendered.push({ ...cand, text: text.trim() });
    }
  } catch (err) {
    console.warn(`! Failed to render ${cand.kind} ${cand.name}@L${cand.line}: ${err.message}`);
  }
}
console.log(`Rendered ${rendered.length} prompts.`);

// Drop trivial prompts (single short sentence, no real content).
const MIN_BODY_CHARS = 200;
const substantial = rendered.filter((r) => {
  const nonEmptyLines = r.text.split('\n').filter((l) => l.trim().length > 0);
  return r.text.length >= MIN_BODY_CHARS && nonEmptyLines.length >= 2;
});
console.log(`Dropped ${rendered.length - substantial.length} trivial prompts.`);

// Dedupe by exact text — different bundle locations sometimes hold identical prompts.
const seen = new Set();
const unique = substantial.filter((r) => {
  if (seen.has(r.text)) return false;
  seen.add(r.text);
  return true;
});
console.log(`Dropped ${substantial.length - unique.length} duplicate prompts.`);

fs.rmSync(PROMPTS_DIR, { recursive: true, force: true });
fs.mkdirSync(PROMPTS_DIR, { recursive: true });

function slug(s) {
  return s
    .toLowerCase()
    .replace(/^\s*(a|an|the)\s+/i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'prompt';
}

// Derive a human-meaningful name from the prompt body.
// Strategy: look at the first ~400 chars and try a series of patterns in order. The
// fallback is to slugify the first ~6 words. The minified symbol name from the bundle is
// only used to disambiguate when two prompts produce the same derived name.
// Curated substring → canonical-name table. First match wins. Tried before any heuristic
// because once we've identified a prompt's role by hand, that's always the right name.
// Order matters: more specific patterns should appear before generic ones.
const KNOWN_PROMPTS = [
  ['fast, parallel code search agent', 'code-search-agent'],
  ['You are the Librarian', 'librarian'],
  ['You are the Oracle', 'oracle'],
  ['You are Agg Man', 'agg-man'],
  ['You are Amp (Rush Mode)', 'amp-rush-mode'],
  ['Amp, an autonomous coding agent', 'amp-autonomous'],
  ['optimized for speed and efficiency', 'amp-fast'],
  ['pair programming with a user', 'pair-programming'],
  ['expert senior engineer', 'senior-engineer-reviewer'],
  ['analyzes files for a software engineer', 'file-analyzer'],
  ['generates short, descriptive titles', 'title-generator'],
  ['summarize work done by an AI coding agent', 'subagent-summary'],
  ['extract relevant information from the mentioned thread', 'thread-extractor'],
  ['analyze this codebase and create an AGENTS.md', 'agents-md-init'],
  ['# Code Review Skill', 'code-review-skill'],
  ['Additional instructions from the user', 'user-instructions'],
  // Amp main-agent variants — disambiguated by their distinctive section headings.
  ['# Pragmatism and Scope', 'amp-pragmatic'],
  ['# Guardrails (Read this before doing anything)', 'amp-guardrails'],
  ['# Role & Agency', 'amp-role-agency'],
  ['# Agency\n', 'amp-classic'],
  // Empty-name template (`You are , a powerful AI coding agent.`) used as a base shape.
  ['You are , a powerful AI coding agent', 'amp-base'],
];

function deriveName(text) {
  for (const [needle, name] of KNOWN_PROMPTS) {
    if (text.includes(needle)) return name;
  }

  // Only consider a markdown heading if it is literally the first line — section
  // headings inside the body are not the prompt's name.
  const firstLine = text.split('\n', 1)[0].trim();
  const leadingHeading = firstLine.match(/^#+\s+(.+)$/);
  if (leadingHeading) return slug(leadingHeading[1]);

  const head = text.slice(0, 400);

  // "You are <Proper Name>" — title-case identifier ending at punctuation. Excludes "Amp"
  // alone (too generic across many prompts) but keeps "Amp (Rush Mode)" → "amp-rush-mode".
  const youAreNamed = head.match(/^You are (?:the |an? )?([A-Z][\w']*(?:\s+(?:[A-Z][\w']*|\([^)]+\))){0,4})\b/);
  if (youAreNamed) {
    let cleaned = youAreNamed[1].replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();
    // Skip throwaway one-word matches like "AI", "An".
    if (cleaned.length >= 2 && !/^(AI|An)$/i.test(cleaned)) return slug(cleaned);
  }

  // "You are helping <verb-ing> X" → name from the verb + object (drop "helping").
  const helping = head.match(/^You are helping(?: me| us)?\s+(\w+)(?:\s+(\w+))?/i);
  if (helping) {
    const verb = helping[1];
    const obj = helping[2];
    return slug(obj ? `${verb}-${obj}` : verb);
  }

  // "You are , <something>, a powerful AI coding agent" — empty proper-name slot. Use the
  // first descriptive phrase after the empty comma.
  const emptyName = head.match(/^You are\s*,\s*([^.,]{3,60})/);
  if (emptyName) return slug(emptyName[1]);

  // "You are <verb-ing>..." (no article, no Title-case): e.g. "You are pair programming".
  // Skip leading article so "You are a fast, parallel code search agent" captures the full phrase.
  const youAreVerbing = head.match(/^You are (?:a |an |the )?([a-z][\w]*(?:[\s,]+[a-z][\w]*){0,5}?)\s+(?:with|to|for|that|which|who)\b/);
  if (youAreVerbing) return slug(youAreVerbing[1]);

  // "You are an? <noun phrase>" — short descriptive role. Allows commas inside the phrase
  // so "You are a fast, parallel code search agent." captures the full noun phrase.
  const youAreDesc = head.match(/^You are (?:the |an? )([\w\- ,]{3,80}?)(?:\.\s|\s(?:that|which|who|with|for|to|in)\b|\(|$)/i);
  if (youAreDesc) {
    return slug(youAreDesc[1]);
  }

  // "Please analyze this codebase and create an AGENTS.md file" — special-case the AGENTS.md
  // initializer prompt that doesn't fit the "You are" mold.
  if (/AGENTS\.md/i.test(head) && /analyze|create/i.test(head)) return 'agents-md-init';

  // Generic imperative fallback.
  const imperative = head.match(/^(?:Please\s+)?([A-Z][a-z]+(?:\s+\w+){0,2})/);
  if (imperative) return slug(imperative[1]);

  return 'prompt';
}

// Assign names with disambiguation: identical derived names get a numeric suffix.
const nameCount = new Map();
const named = unique.map((block) => {
  const base = deriveName(block.text);
  const seenN = nameCount.get(base) ?? 0;
  nameCount.set(base, seenN + 1);
  const finalName = seenN === 0 ? base : `${base}-${seenN + 1}`;
  return { ...block, derivedName: finalName };
});

// If a base name only appears once we'd rather not number it. Re-pass to clean trailing -2 etc.
// (Already handled: only suffix when seenN > 0.)

const indexEntries = [];
named.forEach((block) => {
  const filename = `${block.derivedName}.md`;
  const filePath = path.join(PROMPTS_DIR, filename);
  const body = [
    `# ${block.derivedName}`,
    '',
    `_Source: \`dist/main.js:${block.line}\` (symbol \`${block.name}\`)_`,
    '',
    block.text,
    '',
  ].join('\n');
  fs.writeFileSync(filePath, body);
  indexEntries.push(`- [${block.derivedName}](prompts/${filename}) — line ${block.line}`);
});

const index = [
  '# Amp CLI Extracted Prompts',
  '',
  `Source: ${BUNDLE}`,
  `Package: ${pkg.name}@${pkg.version}`,
  '',
  'Notes:',
  '- Extracted by parsing the bundle with `@babel/parser`, locating prompt-producing arrow functions and template literals, then evaluating each in a `node:vm` sandbox.',
  '- Free identifiers (e.g. `R4`, `V6`) are resolved through a Proxy whose backing map was built from `name = "value"` assignments in the bundle.',
  '- Boolean feature-flag parameters (oracle/diagnostics/check-mode etc.) are forced `true` so all optional sections are included.',
  '- Each prompt is in its own file under `prompts/`.',
  '',
  ...indexEntries,
  '',
].join('\n');

fs.writeFileSync(INDEX_FILE, index);
console.log(`Wrote ${unique.length} prompt files to ${PROMPTS_DIR}`);
console.log(`Wrote index to ${INDEX_FILE}`);
