# ai-usage-bar

See how much of your AI coding tool's usage you have left, as colored bars in your terminal.

```
Opus | ctx ▓▓▓▓░░░░░░ 42% | 5h ▓▓▓▓▓▓░░░░ 63% (2h09m) | 7d ▓▓▓▓▓▓▓▓▓░ 88% (3d5h) | $1.23
codex gpt-5 | ctx ▓▓░░░░░░░░ 18% | 5h ▓▓▓░░░░░░░ 25% (3h59m) | 7d ▓▓▓▓░░░░░░ 40% (1d0h)
deepseek | bal 9.42 USD
```

Bars are green below 50%, yellow from 50 to 80%, and red above 80%. No dependencies; needs Node.js 18 or later.

## Supported tools

| Tool | Models | What it shows | Where the data comes from |
|---|---|---|---|
| **Claude Code** | Any model it runs: Claude, or DeepSeek and others through `ANTHROPIC_BASE_URL` | Model, context, 5-hour and weekly limits, session cost | Claude Code's status line input |
| **OpenAI Codex CLI** | ChatGPT models (GPT-5 etc.) | Model, context, 5-hour and weekly limits | Codex session logs in `~/.codex/sessions` (or `$CODEX_HOME/sessions`) |
| **DeepSeek API** | DeepSeek models used with your own API key | Remaining balance | DeepSeek's `/user/balance` API, using `DEEPSEEK_API_KEY` |

Plan limits (`5h`, `7d`) only appear when the tool reports them: Claude Code on a Claude.ai plan, and Codex signed in with ChatGPT. API-key users see context and cost or balance instead.

## Install

```sh
npm install -g ai-usage-bar
```

### Claude Code: show it in the status line

```sh
ai-usage-bar install
```

Restart Claude Code. `install` adds a `statusLine` entry to `~/.claude/settings.json` (or `$CLAUDE_CONFIG_DIR/settings.json`) and keeps your other settings; any existing file is backed up as `settings.json.bak`.

To show other tools in the same line, set `AI_USAGE_BAR_EXTRA` before starting Claude Code:

```sh
export AI_USAGE_BAR_EXTRA=codex,deepseek
```

### Codex CLI, DeepSeek, or any terminal

Codex CLI can't run a custom status line command, so use `ai-usage-bar` alongside it:

```sh
ai-usage-bar show                 # print usage once for every tool it finds
ai-usage-bar show codex           # just Codex
ai-usage-bar watch                # keep it on screen, refreshing every 30s
ai-usage-bar watch --interval 10  # refresh every 10s
```

A handy setup in iTerm2 is a small split pane running `ai-usage-bar watch` next to your coding session.

Preview without installing:

```sh
npx ai-usage-bar demo
```

## Options

| Variable | Default | Effect |
|---|---|---|
| `AI_USAGE_BAR_EXTRA` | none | Extra sources in the Claude Code status line, e.g. `codex,deepseek` |
| `AI_USAGE_BAR_WIDTH` | `10` | Bar width in cells (1–40) |
| `AI_USAGE_BAR_COST` | `1` | Set to `0` to hide session cost |
| `DEEPSEEK_API_KEY` | none | Enables the DeepSeek balance |
| `CODEX_HOME` | `~/.codex` | Where Codex keeps its sessions |

## Notes

- Codex figures come from its most recent session log, so they update when you use Codex. A window whose reset time has passed shows 0%.
- Codex's log format isn't officially documented and has changed between versions; both known field layouts are supported. Please open an issue if your version shows nothing.
- The DeepSeek balance is cached for 5 minutes so it doesn't call the API on every refresh. Your key is only sent to `api.deepseek.com`.
- Anything a tool doesn't report is skipped, so the bar never prints an error.

## Uninstall

```sh
ai-usage-bar uninstall
npm uninstall -g ai-usage-bar
```

## License

MIT
