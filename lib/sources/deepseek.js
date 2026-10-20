'use strict';

// Reads the remaining DeepSeek API balance (GET /user/balance) using DEEPSEEK_API_KEY.
// Results are cached on disk so a status line or prompt refreshing often doesn't
// call the API every time; a failed call falls back to the last cached value.

const fs = require('fs');
const os = require('os');
const path = require('path');

const URL = 'https://api.deepseek.com/user/balance';
const CACHE_MS = 5 * 60 * 1000;
const TIMEOUT_MS = 3000;

function cacheFile() {
  return path.join(os.tmpdir(), `ai-usage-bar-deepseek-${process.getuid ? process.getuid() : 'user'}.json`);
}

function readCache() {
  try {
    return JSON.parse(fs.readFileSync(cacheFile(), 'utf8'));
  } catch {
    return null;
  }
}

function normalize(body) {
  const infos = (body && body.balance_infos) || [];
  const info = infos.find((b) => b.currency === 'USD') || infos[0];
  if (!info) return null;
  return {
    name: 'deepseek',
    balance: { amount: info.total_balance, currency: info.currency, ok: body.is_available !== false },
  };
}

async function readDeepSeek({ apiKey = process.env.DEEPSEEK_API_KEY, now = Date.now() } = {}) {
  if (!apiKey) return null;
  const cached = readCache();
  if (cached && now - cached.at < CACHE_MS) return normalize(cached.body);

  try {
    const res = await fetch(URL, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    try {
      fs.writeFileSync(cacheFile(), JSON.stringify({ at: now, body }), { mode: 0o600 });
    } catch {
      // Caching is best effort.
    }
    return normalize(body);
  } catch {
    return cached ? normalize(cached.body) : null;
  }
}

module.exports = { readDeepSeek, normalize };
