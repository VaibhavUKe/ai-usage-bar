'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { render, countdown } = require('../lib/render');
const { install, uninstall } = require('../lib/install');

const strip = (s) => s.replace(/\x1b\[[0-9;]*m/g, '');

test('renders every segment', () => {
  const now = 1_700_000_000_000;
  const out = strip(render({
    model: { display_name: 'Opus' },
    context_window: { used_percentage: 42 },
    rate_limits: {
      five_hour: { used_percentage: 63, resets_at: now / 1000 + 7740 },
      seven_day: { used_percentage: 88, resets_at: now / 1000 + 3 * 86400 + 5 * 3600 },
    },
    cost: { total_cost_usd: 1.234 },
  }, { now }));
  assert.strictEqual(out, 'Opus | ctx ▓▓▓▓░░░░░░ 42% | 5h ▓▓▓▓▓▓░░░░ 63% (2h09m) | 7d ▓▓▓▓▓▓▓▓▓░ 88% (3d5h) | $1.23');
});

test('skips missing fields', () => {
  assert.strictEqual(render({}), '');
  assert.strictEqual(strip(render({ model: { display_name: 'Sonnet' } })), 'Sonnet');
});

test('clamps out-of-range percentages', () => {
  assert.match(strip(render({ context_window: { used_percentage: 150 } })), /▓{10} 100%/);
});

test('countdown hides past resets', () => {
  assert.strictEqual(countdown(1, Date.now()), '');
});

test('install keeps other settings and uninstall removes only ours', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccub-'));
  const file = path.join(dir, 'settings.json');
  fs.writeFileSync(file, JSON.stringify({ theme: 'dark' }));
  install({ file });
  const after = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.strictEqual(after.theme, 'dark');
  assert.strictEqual(after.statusLine.command, 'claude-code-usage-bar');
  assert.strictEqual(uninstall({ file }).removed, true);
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { theme: 'dark' });
});
