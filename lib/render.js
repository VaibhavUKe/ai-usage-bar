'use strict';

// Renders usage from any source into one compact line.
// A source is normalized to:
//   { name, contextPct, limits: [{ label, pct, resetsAt }], costUsd, balance: { amount, currency, ok } }
// Every field is optional: anything missing is skipped, never an error.

const ANSI = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
};

const SEGMENTS = ['model', 'ctx', 'limits', 'reset', 'cost', 'balance'];

// Each style draws `filled` of `width` cells. `level` is 'low' | 'mid' | 'high' for styles
// whose glyphs carry their own color.
const STYLES = {
  blocks: { fill: '▓', empty: '░' },
  solid: { fill: '█', empty: '░' },
  dots: { fill: '●', empty: '○' },
  squares: { fill: '■', empty: '□' },
  ascii: { fill: '#', empty: '-', open: '[', close: ']' },
  smooth: { smooth: true, empty: '░' },
  emoji: { emoji: { low: '🟩', mid: '🟨', high: '🟥' }, empty: '⬜', colorless: true },
  pct: { none: true },
};

const EIGHTHS = ['', '▏', '▎', '▍', '▌', '▋', '▊', '▉'];

function levelFor(usedPct) {
  if (usedPct < 50) return 'low';
  if (usedPct <= 80) return 'mid';
  return 'high';
}

function isNum(v) {
  return v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
}

function normalizeOptions(opts = {}) {
  const style = STYLES[opts.style] ? opts.style : 'blocks';
  let show = opts.show ? new Set(opts.show) : new Set(SEGMENTS);
  if (opts.cost === false) show.delete('cost');
  return {
    width: opts.width > 0 ? Math.min(40, opts.width) : 10,
    now: opts.now ?? Date.now(),
    style,
    show,
    remaining: Boolean(opts.remaining),
    color: opts.color !== false,
  };
}

function painter(color) {
  return (code, text) => (color ? `${ANSI[code]}${text}${ANSI.reset}` : text);
}

function cells(fraction, width, styleName, level) {
  const s = STYLES[styleName];
  if (s.none) return '';
  if (s.smooth) {
    const exact = fraction * width;
    const full = Math.floor(exact);
    const part = full < width ? EIGHTHS[Math.round((exact - full) * 8) % 8] : '';
    const used = full + (part ? 1 : 0);
    return '█'.repeat(full) + part + s.empty.repeat(Math.max(0, width - used));
  }
  const filled = Math.round(fraction * width);
  const fill = s.emoji ? s.emoji[level] : s.fill;
  return `${s.open || ''}${fill.repeat(filled)}${s.empty.repeat(width - filled)}${s.close || ''}`;
}

// usedPct always drives the color, so a nearly exhausted limit is red in either mode.
function bar(label, usedValue, opts = {}, suffix = '') {
  if (!isNum(usedValue)) return null;
  const o = normalizeOptions(opts);
  const paint = painter(o.color);
  const used = Math.max(0, Math.min(100, Number(usedValue)));
  const shown = o.remaining ? 100 - used : used;
  const level = levelFor(used);
  const color = { low: 'green', mid: 'yellow', high: 'red' }[level];
  const drawn = cells(shown / 100, o.width, o.style, level);
  const text = `${Math.round(shown)}%${o.remaining ? ' left' : ''}`;
  const body = drawn
    ? `${STYLES[o.style].colorless ? drawn : paint(color, drawn)} ${text}`
    : paint(color, text);
  return `${paint('dim', label)} ${body}${suffix}`;
}

// resetsAt is a Unix timestamp in seconds.
function countdown(resetsAt, now = Date.now(), color = true) {
  if (!isNum(resetsAt)) return '';
  const secs = Math.floor(Number(resetsAt) - now / 1000);
  if (secs <= 0) return '';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  let t;
  if (h >= 24) t = `${Math.floor(h / 24)}d${h % 24}h`;
  else if (h > 0) t = `${h}h${String(m).padStart(2, '0')}m`;
  else t = `${m}m`;
  return ` ${painter(color)('dim', `(${t})`)}`;
}

function renderSource(src, opts = {}) {
  if (!src) return '';
  const o = normalizeOptions(opts);
  const paint = painter(o.color);
  const parts = [];

  if (o.show.has('model') && src.name) parts.push(paint('cyan', src.name));

  if (o.show.has('ctx')) {
    const ctx = bar('ctx', src.contextPct, o);
    if (ctx) parts.push(ctx);
  }

  if (o.show.has('limits')) {
    for (const limit of src.limits || []) {
      // A window whose reset time has passed has started over, so the old figure is stale.
      const expired = isNum(limit.resetsAt) && Number(limit.resetsAt) <= o.now / 1000;
      const suffix = o.show.has('reset') ? countdown(limit.resetsAt, o.now, o.color) : '';
      const b = bar(limit.label, expired ? 0 : limit.pct, o, suffix);
      if (b) parts.push(b);
    }
  }

  if (o.show.has('cost') && isNum(src.costUsd)) parts.push(paint('dim', `$${Number(src.costUsd).toFixed(2)}`));

  if (o.show.has('balance') && src.balance && isNum(src.balance.amount)) {
    const amount = `${Number(src.balance.amount).toFixed(2)} ${src.balance.currency || ''}`.trimEnd();
    parts.push(`${paint('dim', 'bal')} ${paint(src.balance.ok === false ? 'red' : 'green', amount)}`);
  }

  return parts.join(` ${paint('dim', '|')} `);
}

function render(sources, opts = {}) {
  const o = normalizeOptions(opts);
  return []
    .concat(sources)
    .map((s) => renderSource(s, o))
    .filter(Boolean)
    .join(`  ${painter(o.color)('dim', '‖')}  `);
}

module.exports = { render, renderSource, bar, countdown, STYLES, SEGMENTS };
