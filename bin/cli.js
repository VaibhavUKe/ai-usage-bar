#!/usr/bin/env node
'use strict';

const { render, STYLES, SEGMENTS } = require('../lib/render');
const { install, uninstall, settingsPath, COMMAND } = require('../lib/install');
const { fromClaudeCode } = require('../lib/sources/claude');
const { readCodex, hasCodex, sessionsDir } = require('../lib/sources/codex');
const { readDeepSeek } = require('../lib/sources/deepseek');

const SOURCES = ['codex', 'deepseek'];

const HELP = `ai-usage-bar: AI coding tool usage as colored bars

Usage:
  ai-usage-bar install [options]  Add the bar to Claude Code's status line (options are saved)
  ai-usage-bar uninstall          Remove it from Claude Code
  ai-usage-bar show [sources]     Print usage once        (sources: ${SOURCES.join(', ')}; default: all found)
  ai-usage-bar watch [sources]    Keep it on screen, refreshing (--interval <sec>, default 30)
  ai-usage-bar styles             Preview every style
  ai-usage-bar demo               Print a sample
  ai-usage-bar [options]          Render from Claude Code's status line JSON on stdin

Options (flag, or environment variable):
  --style <name>       AI_USAGE_BAR_STYLE      ${Object.keys(STYLES).join(', ')}
  --width <cells>      AI_USAGE_BAR_WIDTH      Bar width, 1-40 (default 10)
  --show <list>        AI_USAGE_BAR_SHOW       Segments to show: ${SEGMENTS.join(',')}
  --remaining          AI_USAGE_BAR_REMAINING=1  Show what's left instead of what's used
  --no-color           NO_COLOR=1              Plain text, no colors
  --extra <sources>    AI_USAGE_BAR_EXTRA      Also show these in the Claude Code status line

Sources:
  Claude Code   any model it runs; read from its status line input
  codex         OpenAI Codex CLI (ChatGPT models); read from ${sessionsDir()}
  deepseek      DeepSeek API balance; needs DEEPSEEK_API_KEY

Claude Code settings: ${settingsPath()}`;

function parseList(value) {
  return String(value || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

// Splits argv into positional args and options. Flags override environment variables.
function parseArgs(argv, env = process.env) {
  const opts = {
    style: env.AI_USAGE_BAR_STYLE || undefined,
    width: parseInt(env.AI_USAGE_BAR_WIDTH, 10) || undefined,
    show: env.AI_USAGE_BAR_SHOW ? parseList(env.AI_USAGE_BAR_SHOW) : undefined,
    remaining: env.AI_USAGE_BAR_REMAINING === '1',
    color: !env.NO_COLOR,
    cost: env.AI_USAGE_BAR_COST !== '0',
    extra: parseList(env.AI_USAGE_BAR_EXTRA),
    interval: 30,
  };
  const saved = []; // the flags `install` writes into the status line command
  const positional = [];
  const value = (i, flag) => {
    if (argv[i + 1] === undefined || argv[i + 1].startsWith('--')) throw new Error(`${flag} needs a value`);
    return argv[i + 1];
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--style') {
      opts.style = value(i, a);
      saved.push(a, opts.style);
      i++;
    } else if (a === '--width') {
      opts.width = parseInt(value(i, a), 10);
      saved.push(a, String(opts.width));
      i++;
    } else if (a === '--show') {
      opts.show = parseList(value(i, a));
      saved.push(a, opts.show.join(','));
      i++;
    } else if (a === '--extra') {
      opts.extra = parseList(value(i, a));
      saved.push(a, opts.extra.join(','));
      i++;
    } else if (a === '--interval') {
      opts.interval = Math.max(5, parseInt(value(i, a), 10) || 30);
      i++;
    } else if (a === '--remaining') {
      opts.remaining = true;
      saved.push(a);
    } else if (a === '--no-color') {
      opts.color = false;
      saved.push(a);
    } else if (a.startsWith('--')) {
      throw new Error(`Unknown option: ${a}`);
    } else {
      positional.push(a);
    }
  }

  if (opts.style && !STYLES[opts.style]) {
    throw new Error(`Unknown style: ${opts.style} (choose from ${Object.keys(STYLES).join(', ')})`);
  }
  if (opts.width !== undefined && !(opts.width >= 1 && opts.width <= 40)) {
    throw new Error('--width must be between 1 and 40');
  }
  for (const s of opts.show || []) {
    if (!SEGMENTS.includes(s)) throw new Error(`Unknown segment: ${s} (choose from ${SEGMENTS.join(', ')})`);
  }
  for (const s of opts.extra) {
    if (!SOURCES.includes(s)) throw new Error(`Unknown source: ${s} (choose from ${SOURCES.join(', ')})`);
  }
  return { opts, positional, saved };
}

function detected() {
  const found = [];
  if (hasCodex()) found.push('codex');
  if (process.env.DEEPSEEK_API_KEY) found.push('deepseek');
  return found;
}

async function collect(names) {
  const results = [];
  for (const name of names) {
    if (name === 'codex') results.push(readCodex());
    else if (name === 'deepseek') results.push(await readDeepSeek());
    else throw new Error(`Unknown source: ${name} (choose from ${SOURCES.join(', ')})`);
  }
  return results.filter(Boolean);
}

function readStdin() {
  return new Promise((resolve) => {
    let input = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => (input += chunk));
    process.stdin.on('end', () => resolve(input));
  });
}

async function statusLine(opts) {
  let data;
  try {
    data = JSON.parse(await readStdin());
  } catch {
    return; // A status line should never print an error into the UI.
  }
  let extras = [];
  try {
    extras = await collect(opts.extra);
  } catch {
    // An unreadable extra source shouldn't break the status line.
  }
  process.stdout.write(render([fromClaudeCode(data), ...extras], opts));
}

async function show(names, opts) {
  const list = names.length ? names.flatMap(parseList) : detected();
  if (!list.length) {
    console.log('No usage sources found. Use Codex CLI, set DEEPSEEK_API_KEY, or run `ai-usage-bar install` for Claude Code.');
    return;
  }
  const line = render(await collect(list), opts);
  console.log(line || `No usage data yet for: ${list.join(', ')}`);
}

async function watch(names, opts) {
  const tick = async () => {
    process.stdout.write('\x1b[2J\x1b[H');
    await show(names, opts);
  };
  await tick();
  setInterval(tick, opts.interval * 1000);
}

function sample() {
  const now = Math.floor(Date.now() / 1000);
  return [
    {
      name: 'Opus',
      contextPct: 42,
      limits: [
        { label: '5h', pct: 63, resetsAt: now + 2 * 3600 + 540 },
        { label: '7d', pct: 88, resetsAt: now + 3 * 86400 + 5 * 3600 },
      ],
      costUsd: 1.23,
    },
    { name: 'codex gpt-5', contextPct: 18, limits: [{ label: '5h', pct: 25, resetsAt: now + 4 * 3600 }] },
    { name: 'deepseek', balance: { amount: '9.42', currency: 'USD', ok: true } },
  ];
}

function styles(opts) {
  const [claude] = sample();
  const pad = Math.max(...Object.keys(STYLES).map((s) => s.length));
  for (const style of Object.keys(STYLES)) {
    console.log(`${style.padEnd(pad)}  ${render(claude, { ...opts, style })}`);
  }
  console.log(`\nTry one: ai-usage-bar demo --style dots    Keep it: ai-usage-bar install --style dots`);
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === '--help' || cmd === '-h' || cmd === 'help') {
    console.log(HELP);
    return;
  }
  // Options may also come first, as in the status line command `ai-usage-bar --style dots`.
  const isOption = cmd !== undefined && cmd.startsWith('--');
  const { opts, positional, saved } = parseArgs(isOption ? [cmd, ...rest] : rest);
  const command = isOption ? undefined : cmd;

  if (command === 'install') {
    const statusCommand = [COMMAND, ...saved].join(' ');
    const { file, previous } = install({ command: statusCommand });
    console.log(`Status line added to ${file}: ${statusCommand}`);
    if (previous) console.log(`Replaced previous statusLine: ${JSON.stringify(previous)} (backup: ${file}.bak)`);
    console.log('Restart Claude Code to see it.');
  } else if (command === 'uninstall') {
    const { file, removed } = uninstall();
    console.log(removed ? `Status line removed from ${file}` : `No ai-usage-bar status line found in ${file}`);
  } else if (command === 'show') {
    await show(positional, opts);
  } else if (command === 'watch') {
    await watch(positional, opts);
  } else if (command === 'demo') {
    console.log(render(sample(), opts));
  } else if (command === 'styles') {
    styles(opts);
  } else if (command === undefined) {
    if (process.stdin.isTTY) console.log(HELP);
    else await statusLine(opts);
  } else {
    console.error(`Unknown command: ${command}\n\n${HELP}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

module.exports = { parseArgs };
