# claude-code-usage-bar

A compact status line for [Claude Code](https://claude.com/claude-code) that shows how much of your context window and usage limits you have used, as colored bars.

```
Opus | ctx ▓▓▓▓░░░░░░ 42% | 5h ▓▓▓▓▓▓░░░░ 63% (2h09m) | 7d ▓▓▓▓▓▓▓▓▓░ 88% (3d5h) | $1.23
```

| Segment | Meaning |
|---|---|
| `Opus` | The model in use |
| `ctx` | Context window used in the current conversation |
| `5h` | 5-hour usage limit, with time until it resets |
| `7d` | Weekly usage limit, with time until it resets |
| `$1.23` | Cost of the current session |

Bars are green below 50%, yellow from 50 to 80%, and red above 80%. No dependencies; needs Node.js 18 or later.

## Install

```sh
npm install -g claude-code-usage-bar
claude-code-usage-bar install
```

Then restart Claude Code. `install` adds a `statusLine` entry to your Claude Code `settings.json` and keeps everything else in it. If the file already had one, it is replaced and the old file is saved as `settings.json.bak`.

The settings file is `~/.claude/settings.json`, or `$CLAUDE_CONFIG_DIR/settings.json` if you set `CLAUDE_CONFIG_DIR`.

Preview it without installing:

```sh
npx claude-code-usage-bar demo
```

## Uninstall

```sh
claude-code-usage-bar uninstall
npm uninstall -g claude-code-usage-bar
```

## Options

Set these in your shell environment:

| Variable | Default | Effect |
|---|---|---|
| `CLAUDE_USAGE_BAR_WIDTH` | `10` | Bar width in cells (1–40) |
| `CLAUDE_USAGE_BAR_COST` | `1` | Set to `0` to hide the cost segment |

## Notes

- The `5h` and `7d` bars only appear for Claude.ai subscribers, and only after the first response in a session, because that is when Claude Code receives the limit data.
- Any field Claude Code doesn't send is skipped, so the bar never shows an error.

## License

MIT
