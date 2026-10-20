#!/usr/bin/env node
'use strict';

const { render } = require('../lib/render');
const { install, uninstall, settingsPath } = require('../lib/install');
const { fromClaudeCode } = require('../lib/sources/claude');
const { readCodex, hasCodex, sessionsDir } = require('../lib/sources/codex');
const { readDeepSeek } = require('../lib/sources/deepseek');

const SOURCES = ['codex', 'deepseek'];

const HELP = `ai-usage-bar: AI coding tool usage as colored bars

Usage:
  ai-usage-bar install            Add the bar to Claude Code's status line
  ai-usage-bar uninstall          Remove it from Claude Code
  ai-usage-bar show [sources]     Print usage once        (sources: ${SOURCES.join(', ')}; default: all found)
  ai-usage-bar watch [sources]    Keep it on screen, refreshing every 30s (--interval <sec>)
  ai-usage-bar demo               Print a sample
  ai-usage-bar                    Render from Claude Code's status line JSON on stdin

Sources:
  Claude Code   any model it runs; read from its status line input
  codex         OpenAI Codex CLI (ChatGPT models); read from ${sessionsDir()}
  deepseek      DeepSeek API balance; needs DEEPSEEK_API_KEY

Environment:
  AI_USAGE_BAR_EXTRA=codex,deepseek   Also show these in the Claude Code status line
  AI_USAGE_BAR_WIDTH=10               Bar width in cells
  AI_USAGE_BAR_COST=0                 Hide the session cost

Claude Code settings: ${settingsPath()}`;

function options() {
  const width = parseInt(process.env.AI_USAGE_BAR_WIDTH, 10);
  return {
    width: width > 0 && width <= 40 ? width : 10,
    cost: process.env.AI_USAGE_BAR_COST !== '0',
  };
}

function parseList(value) {
  return String(value || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
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

async function statusLine() {
  let data;
  try {
    data = JSON.parse(await readStdin());
  } catch {
    return; // A status line should never print an error into the UI.
  }
  let extras = [];
  try {
    extras = await collect(parseList(process.env.AI_USAGE_BAR_EXTRA));
  } catch {
    // Ignore a bad AI_USAGE_BAR_EXTRA rather than break the status line.
  }
  process.stdout.write(render([fromClaudeCode(data), ...extras], options()));
}

async function show(args) {
  const names = args.length ? args.flatMap(parseList) : detected();
  if (!names.length) {
    console.log('No usage sources found. Use Codex CLI, set DEEPSEEK_API_KEY, or run `ai-usage-bar install` for Claude Code.');
    return;
  }
  const line = render(await collect(names), options());
  console.log(line || `No usage data yet for: ${names.join(', ')}`);
}

async function watch(args) {
  let interval = 30;
  const i = args.indexOf('--interval');
  if (i !== -1) {
    interval = Math.max(5, parseInt(args[i + 1], 10) || 30);
    args.splice(i, 2);
  }
  const tick = async () => {
    process.stdout.write('\x1b[2J\x1b[H');
    await show(args);
  };
  await tick();
  setInterval(tick, interval * 1000);
}

function demo() {
  const now = Math.floor(Date.now() / 1000);
  console.log(render([
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
  ], options()));
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  if (cmd === 'install') {
    const { file, previous } = install();
    console.log(`Status line added to ${file}`);
    if (previous) console.log(`Replaced previous statusLine: ${JSON.stringify(previous)} (backup: ${file}.bak)`);
    console.log('Restart Claude Code to see it.');
  } else if (cmd === 'uninstall') {
    const { file, removed } = uninstall();
    console.log(removed ? `Status line removed from ${file}` : `No ai-usage-bar status line found in ${file}`);
  } else if (cmd === 'show') {
    await show(args);
  } else if (cmd === 'watch') {
    await watch(args);
  } else if (cmd === 'demo') {
    demo();
  } else if (cmd === '-h' || cmd === '--help' || cmd === 'help') {
    console.log(HELP);
  } else if (cmd === undefined) {
    if (process.stdin.isTTY) console.log(HELP);
    else await statusLine();
  } else {
    console.error(`Unknown command: ${cmd}\n\n${HELP}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
