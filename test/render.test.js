'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { render, countdown } = require('../lib/render');
const { install, uninstall } = require('../lib/install');
const { fromClaudeCode } = require('../lib/sources/claude');
const codex = require('../lib/sources/codex');
const { normalize: deepseek } = require('../lib/sources/deepseek');

const strip = (s) => s.replace(/\x1b\[[0-9;]*m/g, '');
const NOW = 1_700_000_000_000;

test('renders a Claude Code status line', () => {
  const out = strip(render(fromClaudeCode({
    model: { display_name: 'Opus' },
    context_window: { used_percentage: 42 },
    rate_limits: {
      five_hour: { used_percentage: 63, resets_at: NOW / 1000 + 7740 },
      seven_day: { used_percentage: 88, resets_at: NOW / 1000 + 3 * 86400 + 5 * 3600 },
    },
    cost: { total_cost_usd: 1.234 },
  }), { now: NOW }));
  assert.strictEqual(out, 'Opus | ctx ▓▓▓▓░░░░░░ 42% | 5h ▓▓▓▓▓▓░░░░ 63% (2h09m) | 7d ▓▓▓▓▓▓▓▓▓░ 88% (3d5h) | $1.23');
});

test('works for any Claude Code model without plan limits', () => {
  const out = strip(render(fromClaudeCode({
    model: { display_name: 'deepseek-chat' },
    context_window: { used_percentage: 10 },
  }), { now: NOW }));
  assert.strictEqual(out, 'deepseek-chat | ctx ▓░░░░░░░░░ 10%');
});

test('skips missing fields', () => {
  assert.strictEqual(render(fromClaudeCode({})), '');
  assert.strictEqual(render([]), '');
});

test('clamps out-of-range percentages', () => {
  assert.match(strip(render({ contextPct: 150 })), /▓{10} 100%/);
});

test('countdown hides past resets and expired windows show 0%', () => {
  assert.strictEqual(countdown(1, Date.now()), '');
  const out = strip(render({ limits: [{ label: '5h', pct: 90, resetsAt: NOW / 1000 - 60 }] }, { now: NOW }));
  assert.strictEqual(out, '5h ░░░░░░░░░░ 0%');
});

test('parses Codex token_count with resets_in_seconds', () => {
  const ts = new Date(NOW).toISOString();
  const lines = [
    JSON.stringify({ timestamp: ts, type: 'turn_context', payload: { model: 'gpt-5' } }),
    JSON.stringify({
      timestamp: ts,
      type: 'event_msg',
      payload: {
        type: 'token_count',
        info: { last_token_usage: { total_tokens: 64000 }, model_context_window: 256000 },
        rate_limits: {
          primary: { used_percent: 25, window_minutes: 299, resets_in_seconds: 3600 },
          secondary: { used_percent: 40, window_minutes: 10079, resets_in_seconds: 86400 },
        },
      },
    }),
  ];
  const src = codex.parse(lines);
  assert.strictEqual(src.name, 'codex gpt-5');
  assert.strictEqual(src.contextPct, 25);
  assert.deepStrictEqual(src.limits.map((l) => l.label), ['5h', '7d']);
  assert.strictEqual(src.limits[0].resetsAt, NOW / 1000 + 3600);
  assert.strictEqual(
    strip(render(src, { now: NOW })),
    'codex gpt-5 | ctx ▓▓▓░░░░░░░ 25% | 5h ▓▓▓░░░░░░░ 25% (1h00m) | 7d ▓▓▓▓░░░░░░ 40% (1d0h)'
  );
});

test('parses Codex token_count with resets_at and reads newest session file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-'));
  const day = path.join(dir, '2026', '10', '20');
  fs.mkdirSync(day, { recursive: true });
  const rec = {
    timestamp: new Date(NOW).toISOString(),
    type: 'event_msg',
    payload: { type: 'token_count', rate_limits: { primary: { used_percent: 70, window_minutes: 300, resets_at: 1_700_003_600 } } },
  };
  fs.writeFileSync(path.join(day, 'rollout-a.jsonl'), 'not json\n' + JSON.stringify(rec) + '\n');
  const src = codex.readCodex({ dir });
  assert.strictEqual(src.name, 'codex');
  assert.deepStrictEqual(src.limits, [{ label: '5h', pct: 70, resetsAt: 1_700_003_600 }]);
  assert.strictEqual(codex.readCodex({ dir: path.join(dir, 'missing') }), null);
});

test('normalizes the DeepSeek balance response', () => {
  const src = deepseek({
    is_available: true,
    balance_infos: [
      { currency: 'CNY', total_balance: '110.00' },
      { currency: 'USD', total_balance: '9.42' },
    ],
  });
  assert.strictEqual(strip(render(src)), 'deepseek | bal 9.42 USD');
  assert.strictEqual(deepseek({ balance_infos: [] }), null);
});

test('install keeps other settings and uninstall removes only ours', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiub-'));
  const file = path.join(dir, 'settings.json');
  fs.writeFileSync(file, JSON.stringify({ theme: 'dark' }));
  install({ file });
  const after = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.strictEqual(after.theme, 'dark');
  assert.strictEqual(after.statusLine.command, 'ai-usage-bar');
  assert.strictEqual(uninstall({ file }).removed, true);
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { theme: 'dark' });
});
