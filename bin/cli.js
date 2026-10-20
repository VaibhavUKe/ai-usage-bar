#!/usr/bin/env node
'use strict';

const { render } = require('../lib/render');
const { install, uninstall, settingsPath } = require('../lib/install');

const HELP = `claude-code-usage-bar: a usage status line for Claude Code

Usage:
  claude-code-usage-bar install     Add the status line to Claude Code settings
  claude-code-usage-bar uninstall   Remove it again
  claude-code-usage-bar demo        Print a sample bar
  claude-code-usage-bar             Render from JSON on stdin (what Claude Code runs)

Settings file: ${settingsPath()}
(set CLAUDE_CONFIG_DIR to use a different Claude Code config directory)

Environment:
  CLAUDE_USAGE_BAR_WIDTH=10   Bar width in cells
  CLAUDE_USAGE_BAR_COST=0     Hide the session cost segment`;

function options() {
  const width = parseInt(process.env.CLAUDE_USAGE_BAR_WIDTH, 10);
  return {
    width: width > 0 && width <= 40 ? width : 10,
    cost: process.env.CLAUDE_USAGE_BAR_COST !== '0',
  };
}

function renderStdin() {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => (input += chunk));
  process.stdin.on('end', () => {
    let data;
    try {
      data = JSON.parse(input);
    } catch {
      return; // A status line should never print an error into the UI.
    }
    process.stdout.write(render(data, options()));
  });
}

function demo() {
  const now = Math.floor(Date.now() / 1000);
  const sample = {
    model: { display_name: 'Opus' },
    context_window: { used_percentage: 42 },
    rate_limits: {
      five_hour: { used_percentage: 63, resets_at: now + 2 * 3600 + 540 },
      seven_day: { used_percentage: 88, resets_at: now + 3 * 86400 + 5 * 3600 },
    },
    cost: { total_cost_usd: 1.23 },
  };
  console.log(render(sample, options()));
}

const cmd = process.argv[2];
try {
  if (cmd === 'install') {
    const { file, previous } = install();
    console.log(`Status line added to ${file}`);
    if (previous) console.log(`Replaced previous statusLine: ${JSON.stringify(previous)} (backup: ${file}.bak)`);
    console.log('Restart Claude Code to see it.');
  } else if (cmd === 'uninstall') {
    const { file, removed } = uninstall();
    console.log(removed ? `Status line removed from ${file}` : `No claude-code-usage-bar status line found in ${file}`);
  } else if (cmd === 'demo') {
    demo();
  } else if (cmd === '-h' || cmd === '--help' || cmd === 'help') {
    console.log(HELP);
  } else if (cmd === undefined) {
    if (process.stdin.isTTY) console.log(HELP);
    else renderStdin();
  } else {
    console.error(`Unknown command: ${cmd}\n\n${HELP}`);
    process.exit(1);
  }
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
