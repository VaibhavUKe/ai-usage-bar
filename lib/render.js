'use strict';

// Renders one status line from the JSON Claude Code pipes to a statusLine command.
// Every segment is optional: a field missing from the input is skipped, never an error.

const RESET = '\x1b[0m';
const DIM = '\x1b[2m';
const CYAN = '\x1b[36m';

function pick(obj, ...keys) {
  for (const k of keys) {
    if (obj === null || typeof obj !== 'object') return undefined;
    obj = obj[k];
  }
  return obj;
}

function colorFor(pct) {
  if (pct < 50) return '\x1b[32m';
  if (pct <= 80) return '\x1b[33m';
  return '\x1b[31m';
}

function bar(label, value, { width = 10, suffix = '' } = {}) {
  const pct = Number(value);
  if (value === null || value === undefined || !Number.isFinite(pct)) return null;
  const p = Math.max(0, Math.min(100, pct));
  const filled = Math.round((p / 100) * width);
  const cells = '▓'.repeat(filled) + '░'.repeat(width - filled);
  return `${DIM}${label}${RESET} ${colorFor(p)}${cells}${RESET} ${Math.round(p)}%${suffix}`;
}

// resets_at is a Unix timestamp in seconds.
function countdown(resetsAt, now = Date.now()) {
  const secs = Math.floor(Number(resetsAt) - now / 1000);
  if (!Number.isFinite(secs) || secs <= 0) return '';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  let t;
  if (h >= 24) t = `${Math.floor(h / 24)}d${h % 24}h`;
  else if (h > 0) t = `${h}h${String(m).padStart(2, '0')}m`;
  else t = `${m}m`;
  return ` ${DIM}(${t})${RESET}`;
}

function render(data, opts = {}) {
  const { width = 10, now = Date.now(), cost = true } = opts;
  const parts = [];

  const model = pick(data, 'model', 'display_name');
  if (model) parts.push(`${CYAN}${model}${RESET}`);

  const ctx = bar('ctx', pick(data, 'context_window', 'used_percentage'), { width });
  if (ctx) parts.push(ctx);

  for (const [key, label] of [['five_hour', '5h'], ['seven_day', '7d']]) {
    const limit = pick(data, 'rate_limits', key);
    const b = bar(label, pick(limit, 'used_percentage'), {
      width,
      suffix: countdown(pick(limit, 'resets_at'), now),
    });
    if (b) parts.push(b);
  }

  const usd = Number(pick(data, 'cost', 'total_cost_usd'));
  if (cost && pick(data, 'cost', 'total_cost_usd') != null && Number.isFinite(usd)) {
    parts.push(`${DIM}$${usd.toFixed(2)}${RESET}`);
  }

  return parts.join(` ${DIM}|${RESET} `);
}

module.exports = { render, bar, countdown };
