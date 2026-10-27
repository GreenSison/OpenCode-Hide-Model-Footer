# opencode-hide-model-footer

[![CI](https://github.com/GreenSison/OpenCode-Hide-Model-Footer/actions/workflows/ci.yml/badge.svg)](https://github.com/GreenSison/OpenCode-Hide-Model-Footer/actions/workflows/ci.yml)

An OpenCode TUI plugin that hides the composer metadata row:

```text
┌──────────────────────────────────────────────────────────────┐
│ Ask anything...                                              │
│                                                              │
│ Build · DeepSeek 4.1 Flash · OpenCode Go                      │  ← hidden
└──────────────────────────────────────────────────────────────┘
```

After installing, the prompt keeps its input and context/usage footer, but the
`agent · model · provider` line inside the composer is removed.

## Why

OpenCode has no `cli.json` setting for this row. The footer settings that do
exist cover other surfaces:

- `mini.footer` only applies to `opencode mini`.
- `session.tps` only hides tok/s in assistant message footers.

This plugin fills that gap. It is deliberately small and has no UI of its own.

## Install

### From GitHub

```bash
opencode plugin add github:GreenSison/OpenCode-Hide-Model-Footer
```

### From npm

After the first npm release:

```bash
opencode plugin add opencode-hide-model-footer
```

The package exposes both a server entrypoint and a `./tui` entrypoint. OpenCode
loads the TUI half automatically, so you do not need to add it to `cli.json` as
well.

Restart the TUI, or run `/reload` if it is already open.

### Manual install

Clone the repository into the global plugin directory:

```bash
git clone https://github.com/GreenSison/OpenCode-Hide-Model-Footer \
  ~/.config/opencode/plugins/opencode-hide-model-footer
```

OpenCode discovers `index.ts` and `tui.ts` there automatically.

## Options

No options are required. To tune it, use the object form in `opencode.json(c)`:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    {
      "package": "opencode-hide-model-footer",
      "options": {
        // Default: true. Set false to disable without uninstalling.
        "enabled": true,
        // Default: 250 ms. How often to look for a remounted prompt.
        "interval": 250,
        // Default: false. Writes discovery details to the OS temp directory.
        "debug": false
      }
    }
  ]
}
```

With `debug: true`, look for `opencode-hide-model-footer.log` in your OS temp
directory (`%TEMP%` on Windows, `$TMPDIR` on macOS/Linux).

## How it works

OpenCode renders the metadata row as the sibling immediately after the prompt's
textarea. The plugin walks the renderer tree, finds textareas, and hides the
adjacent box that matches that row: one cell of top padding and `flexShrink: 0`,
with a single-child fallback for layout changes.

The row is hidden, not removed, so the plugin can restore it when disabled. It
also stops scanning once the row is hidden, which keeps idle CPU usage
negligible.

## Caveats

- This uses host renderer internals. OpenCode does not expose the composer
  metadata row as a plugin API, so a future release can change the layout and
  break the plugin. If that happens, enable `debug` and open an issue with the
  log.
- Switching sessions or opening a new session may show the row for up to one
  `interval` (250 ms by default) while the prompt remounts.
- Only the composer row is hidden. Context usage, cost, and key hints in the
  row below the composer are left alone.

## Development

```bash
npm install
npm run typecheck
```

The plugin is plain TypeScript, no build step. OpenCode runs the `.ts`
entrypoints directly with Bun.

## License

MIT
