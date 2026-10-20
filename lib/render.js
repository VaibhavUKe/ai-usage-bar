'use strict';

// Renders usage from any source into one compact, colored line.
// A source is normalized to:
//   { name, contextPct, limits: [{ label, pct, resetsAt }], costUsd, balance: { amount, currency, ok } }
// Every field is optional: anything missing is skipped, never an error.

const RESET = '\x1b[0m';
const DIM = '\x1b[2m';
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';

function colorFor(pct) {
  if (pct < 50) return GREEN;
  if (pct <= 80) return YELLOW;
  return RED;
}

function isNum(v) {
  return v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
}

function bar(label, value, { width = 10, suffix = '' } = {}) {
  if (!isNum(value)) return null;
  const p = Math.max(0, Math.min(100, Number(value)));
  const filled = Math.round((p / 100) * width);
  const cells = '▓'.repeat(filled) + '░'.repeat(width - filled);
  return `${DIM}${label}${RESET} ${colorFor(p)}${cells}${RESET} ${Math.round(p)}%${suffix}`;
}

// resetsAt is a Unix timestamp in seconds.
function countdown(resetsAt, now = Date.now()) {
  if (!isNum(resetsAt)) return '';
  const secs = Math.floor(Number(resetsAt) - now / 1000);
  if (secs <= 0) return '';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  let t;
  if (h >= 24) t = `${Math.floor(h / 24)}d${h % 24}h`;
  else if (h > 0) t = `${h}h${String(m).padStart(2, '0')}m`;
  else t = `${m}m`;
  return ` ${DIM}(${t})${RESET}`;
}

function renderSource(src, opts = {}) {
  const { width = 10, now = Date.now(), cost = true } = opts;
  if (!src) return '';
  const parts = [];

  if (src.name) parts.push(`${CYAN}${src.name}${RESET}`);

  const ctx = bar('ctx', src.contextPct, { width });
  if (ctx) parts.push(ctx);

  for (const limit of src.limits || []) {
    // A window whose reset time has passed has started over, so the old figure is stale.
    const expired = isNum(limit.resetsAt) && Number(limit.resetsAt) <= now / 1000;
    const b = bar(limit.label, expired ? 0 : limit.pct, {
      width,
      suffix: countdown(limit.resetsAt, now),
    });
    if (b) parts.push(b);
  }

  if (cost && isNum(src.costUsd)) parts.push(`${DIM}$${Number(src.costUsd).toFixed(2)}${RESET}`);

  if (src.balance && isNum(src.balance.amount)) {
    const color = src.balance.ok === false ? RED : GREEN;
    parts.push(`${DIM}bal${RESET} ${color}${Number(src.balance.amount).toFixed(2)} ${src.balance.currency || ''}${RESET}`.trimEnd());
  }

  return parts.join(` ${DIM}|${RESET} `);
}

function render(sources, opts = {}) {
  return []
    .concat(sources)
    .map((s) => renderSource(s, opts))
    .filter(Boolean)
    .join(`  ${DIM}‖${RESET}  `);
}

module.exports = { render, renderSource, bar, countdown };
