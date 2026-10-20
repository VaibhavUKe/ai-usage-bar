'use strict';

// Normalizes the JSON Claude Code pipes to a statusLine command. This covers every
// model Claude Code can run, including other providers reached through ANTHROPIC_BASE_URL.

function pick(obj, ...keys) {
  for (const k of keys) {
    if (obj === null || typeof obj !== 'object') return undefined;
    obj = obj[k];
  }
  return obj;
}

function fromClaudeCode(data) {
  const limits = [];
  for (const [key, label] of [['five_hour', '5h'], ['seven_day', '7d']]) {
    const limit = pick(data, 'rate_limits', key);
    if (limit) limits.push({ label, pct: limit.used_percentage, resetsAt: limit.resets_at });
  }
  return {
    name: pick(data, 'model', 'display_name'),
    contextPct: pick(data, 'context_window', 'used_percentage'),
    limits,
    costUsd: pick(data, 'cost', 'total_cost_usd'),
  };
}

module.exports = { fromClaudeCode };
