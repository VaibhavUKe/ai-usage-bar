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

## Styles

Preview them all with `ai-usage-bar styles`:

```
blocks   Opus | ctx ▓▓▓▓░░░░░░ 42% | 5h ▓▓▓▓▓▓░░░░ 63% (2h08m) | 7d ▓▓▓▓▓▓▓▓▓░ 88% (3d4h) | $1.23
solid    Opus | ctx ████░░░░░░ 42% | 5h ██████░░░░ 63% (2h08m) | 7d █████████░ 88% (3d4h) | $1.23
dots     Opus | ctx ●●●●○○○○○○ 42% | 5h ●●●●●●○○○○ 63% (2h08m) | 7d ●●●●●●●●●○ 88% (3d4h) | $1.23
squares  Opus | ctx ■■■■□□□□□□ 42% | 5h ■■■■■■□□□□ 63% (2h08m) | 7d ■■■■■■■■■□ 88% (3d4h) | $1.23
ascii    Opus | ctx [####------] 42% | 5h [######----] 63% (2h08m) | 7d [#########-] 88% (3d4h) | $1.23
smooth   Opus | ctx ████▎░░░░░ 42% | 5h ██████▎░░░ 63% (2h08m) | 7d ████████▊░ 88% (3d4h) | $1.23
emoji    Opus | ctx 🟩🟩🟩🟩⬜⬜⬜⬜⬜⬜ 42% | 5h 🟨🟨🟨🟨🟨🟨⬜⬜⬜⬜ 63% (2h08m) | 7d 🟥🟥🟥🟥🟥🟥🟥🟥🟥⬜ 88% (3d4h) | $1.23
pct      Opus | ctx 42% | 5h 63% (2h08m) | 7d 88% (3d4h) | $1.23
```

`smooth` draws partial cells for finer steps; `emoji` changes color by usage on its own, so it also works without terminal colors; `pct` drops the bars for the most compact line.

## Options

Pass options as flags, or set them as environment variables. Flags given to `install` are saved into the Claude Code status line command, so `ai-usage-bar install --style dots --remaining` keeps that look without any shell setup.

| Flag | Variable | Default | Effect |
|---|---|---|---|
| `--style <name>` | `AI_USAGE_BAR_STYLE` | `blocks` | `blocks`, `solid`, `dots`, `squares`, `ascii`, `smooth`, `emoji` or `pct` |
| `--width <cells>` | `AI_USAGE_BAR_WIDTH` | `10` | Bar width in cells (1–40) |
| `--show <list>` | `AI_USAGE_BAR_SHOW` | all | Which segments to show: `model,ctx,limits,reset,cost,balance` |
| `--remaining` | `AI_USAGE_BAR_REMAINING=1` | off | Show what's left (`37% left`) instead of what's used; colors still warn as you run low |
| `--no-color` | `NO_COLOR=1` | off | Plain text, no colors |
| `--extra <sources>` | `AI_USAGE_BAR_EXTRA` | none | Extra sources in the Claude Code status line, e.g. `codex,deepseek` |
| `--interval <sec>` | | `30` | Refresh interval for `watch` (minimum 5) |
| | `AI_USAGE_BAR_COST=0` | | Hide session cost (same as leaving `cost` out of `--show`) |
| | `DEEPSEEK_API_KEY` | none | Enables the DeepSeek balance |
| | `CODEX_HOME` | `~/.codex` | Where Codex keeps its sessions |

Examples:

```sh
ai-usage-bar install --style smooth --width 8          # finer, shorter bars
ai-usage-bar install --show model,limits,reset         # only plan limits
ai-usage-bar install --style pct --remaining           # "5h 37% left | 7d 12% left"
ai-usage-bar watch codex --style emoji --interval 10
```

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
