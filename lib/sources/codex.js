'use strict';

// Reads usage for OpenAI Codex CLI (ChatGPT models) from its session logs.
// Codex appends `token_count` events to $CODEX_HOME/sessions/YYYY/MM/DD/*.jsonl; the newest
// one carries the plan's rate-limit windows and token usage. Field names have shifted
// between Codex versions, so both known spellings are accepted.

const fs = require('fs');
const os = require('os');
const path = require('path');

const TAIL_BYTES = 1024 * 1024;
const MAX_FILES = 20;

function sessionsDir(codexHome = process.env.CODEX_HOME) {
  return path.join(codexHome || path.join(os.homedir(), '.codex'), 'sessions');
}

// Newest session files first, walking the date folders from the latest down.
function recentFiles(dir, limit = MAX_FILES) {
  const out = [];
  const walk = (d, depth) => {
    if (out.length >= limit) return;
    let entries;
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    if (depth < 3) {
      for (const e of entries.filter((e) => e.isDirectory()).map((e) => e.name).sort().reverse()) {
        walk(path.join(d, e), depth + 1);
      }
      return;
    }
    const files = entries
      .filter((e) => e.isFile() && e.name.endsWith('.jsonl'))
      .map((e) => path.join(d, e.name))
      .map((f) => ({ f, t: fs.statSync(f).mtimeMs }))
      .sort((a, b) => b.t - a.t);
    for (const { f } of files) if (out.length < limit) out.push(f);
  };
  walk(dir, 0);
  return out;
}

function tailLines(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const size = fs.fstatSync(fd).size;
    const start = Math.max(0, size - TAIL_BYTES);
    const buf = Buffer.alloc(size - start);
    fs.readSync(fd, buf, 0, buf.length, start);
    const lines = buf.toString('utf8').split('\n');
    if (start > 0) lines.shift(); // first line may be cut in half
    return lines;
  } finally {
    fs.closeSync(fd);
  }
}

function windowLabel(minutes, fallback) {
  const m = Number(minutes);
  if (!Number.isFinite(m) || m <= 0) return fallback;
  if (m >= 1440) return `${Math.round(m / 1440)}d`;
  return `${Math.round(m / 60)}h`;
}

function toLimit(w, fallback, eventTime) {
  if (!w || typeof w !== 'object') return null;
  let resetsAt = w.resets_at;
  if (resetsAt === undefined && w.resets_in_seconds !== undefined && eventTime) {
    resetsAt = eventTime + Number(w.resets_in_seconds);
  }
  const minutes = w.window_minutes ?? (w.limit_window_seconds ? w.limit_window_seconds / 60 : undefined);
  return { label: windowLabel(minutes, fallback), pct: w.used_percent, resetsAt };
}

function parse(lines) {
  let usage = null;
  let model = null;
  for (let i = lines.length - 1; i >= 0 && !(usage && model); i--) {
    const line = lines[i];
    if (!line || (!line.includes('token_count') && !line.includes('turn_context'))) continue;
    let rec;
    try {
      rec = JSON.parse(line);
    } catch {
      continue;
    }
    const p = rec.payload || {};
    if (!usage && p.type === 'token_count' && (p.rate_limits || p.info)) usage = { p, ts: rec.timestamp };
    if (!model && rec.type === 'turn_context' && p.model) model = p.model;
  }
  if (!usage) return null;

  const eventTime = usage.ts ? Date.parse(usage.ts) / 1000 : undefined;
  const rl = usage.p.rate_limits || {};
  const limits = [toLimit(rl.primary, '5h', eventTime), toLimit(rl.secondary, '7d', eventTime)].filter(Boolean);

  const info = usage.p.info || {};
  const window = Number(info.model_context_window);
  const used = Number(info.last_token_usage && info.last_token_usage.total_tokens);
  const contextPct = window > 0 && used >= 0 ? (used / window) * 100 : undefined;

  return { name: model ? `codex ${model}` : 'codex', contextPct, limits };
}

function readCodex({ dir = sessionsDir() } = {}) {
  for (const file of recentFiles(dir)) {
    let result;
    try {
      result = parse(tailLines(file));
    } catch {
      continue;
    }
    if (result) return result;
  }
  return null;
}

function hasCodex(dir = sessionsDir()) {
  return fs.existsSync(dir);
}

module.exports = { readCodex, hasCodex, parse, sessionsDir };
