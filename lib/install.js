'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const COMMAND = 'ai-usage-bar';

// Claude Code reads settings from $CLAUDE_CONFIG_DIR when set, else ~/.claude.
function settingsPath(configDir = process.env.CLAUDE_CONFIG_DIR) {
  const dir = configDir || path.join(os.homedir(), '.claude');
  return path.join(dir, 'settings.json');
}

function readSettings(file) {
  if (!fs.existsSync(file)) return {};
  const text = fs.readFileSync(file, 'utf8').trim();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`${file} is not valid JSON, so it was left untouched: ${err.message}`);
  }
}

function writeSettings(file, settings) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (fs.existsSync(file)) fs.copyFileSync(file, `${file}.bak`);
  fs.writeFileSync(file, JSON.stringify(settings, null, 2) + '\n');
}

function install({ file = settingsPath(), command = COMMAND } = {}) {
  const settings = readSettings(file);
  const previous = settings.statusLine;
  settings.statusLine = { type: 'command', command, padding: 0 };
  writeSettings(file, settings);
  return { file, previous };
}

function uninstall({ file = settingsPath() } = {}) {
  const settings = readSettings(file);
  const ours = settings.statusLine && String(settings.statusLine.command || '').includes(COMMAND);
  if (!ours) return { file, removed: false };
  delete settings.statusLine;
  writeSettings(file, settings);
  return { file, removed: true };
}

module.exports = { install, uninstall, settingsPath, COMMAND };
