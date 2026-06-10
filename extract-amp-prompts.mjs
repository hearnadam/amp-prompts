import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import vm from 'node:vm';
import { parse } from '@babel/parser';

const ROOT = path.dirname(url.fileURLToPath(import.meta.url));
const AMPCODE_CLI_DIR = path.join(ROOT, 'node_modules', '@ampcode', 'cli');
const AMPCODE_CLI_PKG = path.join(AMPCODE_CLI_DIR, 'package.json');
const LEGACY_SOURCEGRAPH_DIR = path.join(ROOT, 'node_modules', '@sourcegraph', 'amp');
const LEGACY_SOURCEGRAPH_PKG = path.join(LEGACY_SOURCEGRAPH_DIR, 'package.json');
const LEGACY_BUNDLE = path.join(LEGACY_SOURCEGRAPH_DIR, 'dist', 'main.js');
const PROMPTS_DIR = path.join(ROOT, 'prompts');
const SUBAGENTS_DIR = path.join(ROOT, 'subagents');
const SKILLS_DIR = path.join(ROOT, 'skills');
const README_FILE = path.join(ROOT, 'README.md');
const MAX_PROMPT_CHARS = 80_000;

function relative(p) {
  return path.relative(ROOT, p);
}

function resolveNativeAmpBinary() {
  if (!fs.existsSync(AMPCODE_CLI_PKG)) {
    throw new Error('Could not find @ampcode/cli. Run bun install first.');
  }
  const cliPkg = JSON.parse(fs.readFileSync(path.join(AMPCODE_CLI_DIR, 'package.json'), 'utf8'));
  const platformPackageByKey = {
    'darwin-arm64': '@ampcode/cli-darwin-arm64',
    'darwin-x64': '@ampcode/cli-darwin-x64',
    'linux-arm64': '@ampcode/cli-linux-arm64',
    'linux-x64': '@ampcode/cli-linux-x64',
    'win32-x64': '@ampcode/cli-win32-x64',
  };
  const key = `${process.platform}-${process.arch}`;
  const platformPackage = platformPackageByKey[key];
  if (platformPackage) {
    const platformDir = path.join(ROOT, 'node_modules', ...platformPackage.split('/'));
    const binary = path.join(platformDir, process.platform === 'win32' ? 'amp.exe' : 'amp');
    if (fs.existsSync(binary)) return binary;
  }

  const binRel = cliPkg.bin?.amp;
  if (binRel) {
    const binary = path.join(AMPCODE_CLI_DIR, binRel);
    if (fs.existsSync(binary) && fs.statSync(binary).size > 100_000) return binary;
  }

  throw new Error(`Could not find native Amp binary for ${key}. Install @ampcode/cli first.`);
}

function sourceLikeByte(byte) {
  return byte === 0x09 || byte === 0x0a || byte === 0x0d || (byte >= 0x20 && byte <= 0x7e) || byte >= 0x80;
}

function extractEmbeddedBundle(binaryPath) {
  const buffer = fs.readFileSync(binaryPath);
  const bundleMarkers = [
    'Code Review Skill',
    'Additional instructions from the user',
    'Please analyze this codebase',
    'AGENTS.md guidance',
    'promptFragments',
    'systemPrompt',
  ];
  const candidates = [];
  let start = -1;
  for (let i = 0; i <= buffer.length; i += 1) {
    const isSourceLike = i < buffer.length && sourceLikeByte(buffer[i]);
    if (isSourceLike && start === -1) start = i;
    if ((!isSourceLike || i === buffer.length) && start !== -1) {
      const length = i - start;
      if (length >= 500_000) {
        const text = buffer.subarray(start, i).toString('utf8');
        const markerCount = bundleMarkers.filter((marker) => text.includes(marker)).length;
        if (text.startsWith('// @bun') && markerCount > 0) {
          candidates.push({ text, offset: start, length, markerCount });
        }
      }
      start = -1;
    }
  }

  candidates.sort((a, b) => b.markerCount - a.markerCount || b.length - a.length);
  if (candidates.length === 0) {
    throw new Error(`Could not find embedded Amp JS bundle in ${binaryPath}`);
  }
  return candidates[0];
}

function loadAmpSource() {
  if (fs.existsSync(LEGACY_BUNDLE)) {
    const pkg = JSON.parse(fs.readFileSync(LEGACY_SOURCEGRAPH_PKG, 'utf8'));
    return {
      source: fs.readFileSync(LEGACY_BUNDLE, 'utf8'),
      sourceLabel: relative(LEGACY_BUNDLE),
      pkg,
    };
  }

  const pkg = JSON.parse(fs.readFileSync(AMPCODE_CLI_PKG, 'utf8'));
  const binary = resolveNativeAmpBinary();
  const embedded = extractEmbeddedBundle(binary);
  return {
    source: embedded.text,
    sourceLabel: `${relative(binary)}#embedded-js@${embedded.offset}`,
    pkg,
  };
}

const { source, sourceLabel, pkg } = loadAmpSource();

console.log(`Parsing ${sourceLabel}...`);
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
const STARTS_LIKE_PROMPT = /^(# Code Review Skill\b|#{1,3}\s+.+\bSkill\b|You are|Please analyze|AGENTS\.md guidance|MUST answer|The following|Run comprehensive|Remember:|Additional instructions from the user)/i;

function isBundleLikeText(text) {
  const trimmed = text.trimStart();
  if (trimmed.length > MAX_PROMPT_CHARS) return true;
  if (trimmed.startsWith('#!/usr/bin/env bun')) return true;
  if (trimmed.startsWith('// @bun\nvar ')) return true;
  if (/^(var|function)\s+[A-Za-z_$][\w$]*=.*Object\.create/.test(trimmed.slice(0, 300))) return true;
  return false;
}

function looksLikePromptText(text) {
  const trimmed = text.trim();
  return !isBundleLikeText(trimmed) && PROMPT_RE.test(trimmed) && STARTS_LIKE_PROMPT.test(trimmed);
}

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
      if (looksLikePromptText(sample)) {
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
    if (looksLikePromptText(sample)) {
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

// Amp's main-agent prompt builder chooses a base prompt by switching on a
// basePromptType derived from agentMode/model/provider. Prefer that structural
// mapping over body substrings when the bundle exposes it.
const PUBLIC_BASE_PROMPT_NAMES = new Map([
  ['aggman', 'agg'],
  ['rush', 'rush'],
  ['deep', 'deep'],
  ['deep-gpt5.4', 'deep-gpt5-4'],
  ['frontier', null],
]);
const basePromptNameBySymbol = new Map();
for (const match of source.matchAll(/case"([^"]+)":[A-Za-z_$][\w$]*=([A-Za-z_$][\w$]*)\(/g)) {
  const name = PUBLIC_BASE_PROMPT_NAMES.has(match[1]) ? PUBLIC_BASE_PROMPT_NAMES.get(match[1]) : match[1];
  if (name) basePromptNameBySymbol.set(match[2], name);
}
const defaultPrompt = source.match(/default:[A-Za-z_$][\w$]*=([A-Za-z_$][\w$]*)\(\);break/);
if (defaultPrompt) basePromptNameBySymbol.set(defaultPrompt[1], 'smart');

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
  return r.text.length >= MIN_BODY_CHARS && r.text.length <= MAX_PROMPT_CHARS && nonEmptyLines.length >= 2 && !isBundleLikeText(r.text);
});
console.log(`Dropped ${rendered.length - substantial.length} trivial prompts.`);

// Dedupe by exact text — different bundle locations sometimes hold identical prompts.
const seen = new Set();
function structuralNameFor(block) {
  return basePromptNameBySymbol.get(block.name);
}

const PUBLIC_STRUCTURAL_NAMES = new Set(['agg', 'smart', 'deep', 'rush']);

const unique = [];
for (const block of substantial) {
  const existingIndex = unique.findIndex((r) => r.text === block.text);
  if (existingIndex === -1) {
    unique.push(block);
    seen.add(block.text);
    continue;
  }
  const existing = unique[existingIndex];
  const existingName = structuralNameFor(existing);
  const blockName = structuralNameFor(block);
  if (!PUBLIC_STRUCTURAL_NAMES.has(existingName) && PUBLIC_STRUCTURAL_NAMES.has(blockName)) {
    unique[existingIndex] = block;
  }
}
const duplicateCount = substantial.length - unique.length;
console.log(`Dropped ${duplicateCount} duplicate prompts.`);

fs.rmSync(PROMPTS_DIR, { recursive: true, force: true });
fs.rmSync(SUBAGENTS_DIR, { recursive: true, force: true });
fs.rmSync(SKILLS_DIR, { recursive: true, force: true });
fs.mkdirSync(PROMPTS_DIR, { recursive: true });
fs.mkdirSync(SUBAGENTS_DIR, { recursive: true });
fs.mkdirSync(SKILLS_DIR, { recursive: true });

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
  // Public names from https://ampcode.com/models and the Owner's Manual.
  // Agent modes: smart, deep, rush. Subagents: review, search, oracle, librarian.
  ['You are Amp, an autonomous coding agent and lead orchestrator', 'deep'],
  ['You are Amp (Rush Mode)', 'rush'],
  ['Optimize for latency and token economy', 'rush'],
  ['You are Agg Man', 'agg'],
  ['expert senior engineer', 'review'],
  ['fast, parallel code search agent', 'search'],
  ['You are the Librarian', 'librarian'],
  ['You are the Oracle', 'oracle'],
  ['Amp, an autonomous coding agent', 'amp-autonomous'],
  ['optimized for speed and efficiency', 'amp-fast'],
  ['pair programming with a user', 'pair-programming'],
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

function deriveName(block) {
  const text = block.text;
  const structuralName = structuralNameFor(block);
  if (structuralName) return structuralName;

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
  const base = deriveName(block);
  const seenN = nameCount.get(base) ?? 0;
  nameCount.set(base, seenN + 1);
  const finalName = seenN === 0 ? base : `${base}-${seenN + 1}`;
  return { ...block, derivedName: finalName };
});

// If a base name only appears once we'd rather not number it. Re-pass to clean trailing -2 etc.
// (Already handled: only suffix when seenN > 0.)

function categoryFor(block) {
  if (block.derivedName.endsWith('-skill')) return 'skill';
  if (block.text.trimStart().startsWith('# Code Review Skill')) return 'skill';
  if (['review', 'search', 'librarian', 'oracle'].includes(block.derivedName)) return 'subagent';
  return 'prompt';
}

const promptIndexEntries = [];
const subagentIndexEntries = [];
const skillIndexEntries = [];
named.forEach((block) => {
  const filename = `${block.derivedName}.md`;
  const category = categoryFor(block);
  const outputDir = category === 'skill' ? SKILLS_DIR : category === 'subagent' ? SUBAGENTS_DIR : PROMPTS_DIR;
  const relativeDir = category === 'skill' ? 'skills' : category === 'subagent' ? 'subagents' : 'prompts';
  const filePath = path.join(outputDir, filename);
  const body = [
    `# ${block.derivedName}`,
    '',
    `_Source: \`${sourceLabel}:${block.line}\` (symbol \`${block.name}\`)_`,
    '',
    block.text,
    '',
  ].join('\n');
  fs.writeFileSync(filePath, body);
  const entry = `- [${block.derivedName}](${relativeDir}/${filename}) — line ${block.line}`;
  if (category === 'skill') skillIndexEntries.push(entry);
  else if (category === 'subagent') subagentIndexEntries.push(entry);
  else promptIndexEntries.push(entry);
});

function replaceGeneratedCatalog(catalog) {
  const start = '<!-- BEGIN GENERATED CATALOG -->';
  const end = '<!-- END GENERATED CATALOG -->';
  const readme = fs.readFileSync(README_FILE, 'utf8');
  const startIndex = readme.indexOf(start);
  const endIndex = readme.indexOf(end);
  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new Error(`README.md must contain ${start} and ${end} markers`);
  }
  const before = readme.slice(0, startIndex + start.length);
  const after = readme.slice(endIndex);
  fs.writeFileSync(README_FILE, `${before}\n\n${catalog}\n${after}`);
}

const catalog = [
  `Source: ${sourceLabel}`,
  `Package: ${pkg.name}@${pkg.version}`,
  '',
  'Notes:',
  '- Extracted by parsing the bundle with `@babel/parser`, locating prompt-producing arrow functions and template literals, then evaluating each in a `node:vm` sandbox.',
  '- Free identifiers (e.g. `R4`, `V6`) are resolved through a Proxy whose backing map was built from `name = "value"` assignments in the bundle.',
  '- Boolean feature-flag parameters (oracle/diagnostics/check-mode etc.) are forced `true` so all optional sections are included.',
  '- Main and utility prompts are written under `prompts/`; subagent prompts under `subagents/`; skill prompts under `skills/`.',
  '',
  '## Prompts',
  '',
  ...promptIndexEntries,
  '',
  '## Subagents',
  '',
  ...subagentIndexEntries,
  '',
  '## Skills',
  '',
  ...skillIndexEntries,
  '',
].join('\n');

replaceGeneratedCatalog(catalog);
console.log(`Wrote ${promptIndexEntries.length} prompt files to ${PROMPTS_DIR}`);
console.log(`Wrote ${subagentIndexEntries.length} subagent files to ${SUBAGENTS_DIR}`);
console.log(`Wrote ${skillIndexEntries.length} skill files to ${SKILLS_DIR}`);
console.log(`Updated generated catalog in ${README_FILE}`);
