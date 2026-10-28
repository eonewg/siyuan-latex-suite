# Latex Suite

> Fast, configurable LaTeX input for SiYuan Note.

![Latex Suite formula input preview](preview.png)

[简体中文](README_zh_CN.md) · [Issues](https://github.com/eonewg/siyuan-latex-suite/issues) · [Third-party notices](THIRD_PARTY_NOTICES.md)

## Overview

Latex Suite enhances SiYuan's formula editors with snippets, automatic fractions, tabstop navigation, matrix shortcuts, visual transformations, and intelligent bracket handling. It works with SiYuan's native formula source editor and the MathLive editor provided by Math Enhance.

The plugin also works directly in document text: type `mk` to create an inline formula, or type `dm` in an empty paragraph to create a math block. More than 150 tested snippets are bundled as the initial configuration and can be replaced or extended from the settings panel.

## Features

### Snippet engine

- Automatic and Tab-triggered snippets.
- String and regular-expression triggers, `triggerAfter`, priorities, and custom key bindings.
- Dynamic JavaScript replacement functions.
- Environment, macro, and macro-argument exclusions.
- `includedMacros` and configurable text/restricted macro arguments.
- Reusable trigger variables such as `${GREEK}` and `${SYMBOL}`.
- Configurable recursive expansion.
- A searchable reference for saved snippets, templates, descriptions, and macro scopes, available in settings and the command palette.

### Templates and tabstops

- Numbered `$0`, `$1`, and `$2` tabstops.
- Defaults such as `${1:value}`.
- Linked occurrences of the same tabstop.
- Regex captures, named captures, and `${VISUAL}` selections.
- Forward and backward navigation with Tab and Shift+Tab.

### Math typing enhancements

- Convert `x/` and `(a+b)/` into fractions and enter the denominator automatically.
- Configure the fraction command, scan boundaries, and excluded regions.
- In matrices and aligned environments, Tab skips the current cell's closing bracket before adding a column. Enter uses spaces in single-line matrices and preserves indentation in multiline matrices; Shift+Enter moves to the next line end or environment end.
- Skip closing delimiters such as `)`, `]`, and `\rangle` with Tab.
- Use Shift+Tab to move before opening delimiters, including `\left`; active snippet tabstops take precedence.
- Exit the formula editor with Tab when no other navigation target remains.
- Add `\left` and `\right` automatically for snippets containing fractions, sums, or integrals.
- Suppress expansion during IME composition, then expand once on commit.
- Defer linked tabstop mirroring until IME commit. Input and key events while disabled discard stale linked state.
- Avoid accidental re-expansion on Backspace, undo, and redo.
- Prefer browser edit transactions in the native source editor. Chromium checks confirm undo back to the trigger and redo back to the expansion. History operations clear stale tabstops; historical tabstops are not restored. Unsupported frontends fall back to direct text edits.
- Isolate failing replacement functions in the current editor, report once, and keep healthy snippets usable. Edit the source or reopen the formula to retry. Replacements must synchronously return a string or `false`; async functions are unsupported.
- Type over an existing `)`, `]`, or `}` to skip it.
- Independently configure or disable nine shortcuts for manual snippets, tabstops, tabout, fractions, and matrix navigation.

### Editor support

- SiYuan native inline-formula source editor.
- SiYuan native math-block source editor.
- MathLive editor supplied by Math Enhance.
- Desktop, mobile, and browser SiYuan frontends.

## Quick start

| Input | Result or behavior |
| --- | --- |
| Type `mk` in document text | Create and open an inline formula |
| Type `dm` in an empty paragraph | Create and open a math block |
| `@a` or `alpha` | Expand to `\alpha` |
| `sin`, `cos`, or `log` | Expand to the corresponding LaTeX function |
| `xsr` | Expand to `x^{2}` |
| `x/` | Create `\frac{x}{}` and enter the denominator |
| Type `frac`, then press Tab | Insert a fraction template with tabstops |
| Type `mat`, then press Tab | Insert a matrix template |
| Select a formula and press `U` | Wrap the selection in `\underbrace` |

Use `Alt+Shift+L` to toggle all plugin enhancements globally.

## Custom snippets

Open the plugin settings from SiYuan's downloaded package list. Snippets are trusted JavaScript expressions rather than JSON, so comments, regular-expression literals, and replacement functions are supported.

```js
[
  {trigger: "@q", replacement: "\\quad", options: "mA"},
  {
    trigger: /([A-Za-z])norm/,
    replacement: "\\lVert [[0]] \\rVert$0",
    options: "mrA"
  },
  {trigger: "frac", replacement: "\\frac{$1}{$2}$0", options: "m"},
  {trigger: "U", replacement: "\\underbrace{${VISUAL}}_{$1}$0", options: "mv"},
  {
    trigger: "op",
    replacement: () => "\\operatorname{$1}$0",
    options: "m",
    triggerKey: "Ctrl-o"
  }
]
```

Common options:

| Option | Meaning |
| --- | --- |
| `m` | Enable in math input |
| `M` | Enable only in math blocks |
| `n` | Enable only in inline formulas |
| `T` | Enable inside text macros such as `\text{}`; combine with `M` or `n` to limit formula mode |
| `t` | Upstream document-text mode; custom snippets here run in formula editors, with only `mk`/`dm` adapted to document text |
| `A` | Expand automatically; without it, expansion normally occurs on Tab |
| `r` | Treat the trigger as a regular expression |
| `w` | Require configurable word boundaries |
| `v` | Visual/selection snippet |

Additional supported fields include `triggerAfter`, `priority`, `description`, `flags`, `triggerKey`, `includedMacros`, `excludedMacros`, and `excludedEnvironments`. Key-only snippets may omit `trigger`. Expression-style `export default [...]` and `export default {...}` configurations are also accepted.

When upgrading from 0.2.x, change custom `t` rules intended for text macros to `T`. Custom source remains verbatim. Only unchanged bundled settings receive the updated inline/block `beg` rules.

String macro entries such as `excludedMacros: ["foo"]` match argument 0 only. Use `{name: "foo", arguments: [1]}` for argument 1, or `{name: "foo"}` for all arguments. `includedMacros` checks the innermost macro; explicit exclusions still apply.

The text/restricted macro setting accepts JSON, for example `{"text":["mytext"],"restricted":["operatorname"]}`. These entries extend the built-in argument rules for `textcolor`, `colorbox`, `fcolorbox`, and other macros.

Snippet variables use an object expression:

```js
{
  "${GREEK}": "alpha|beta|gamma|delta|theta|lambda|sigma|omega",
  "${ARROW}": "to|rightarrow|leftarrow|mapsto"
}
```

> [!WARNING]
> Snippets and variables execute as trusted JavaScript configuration. Only paste source you understand and trust.

## Settings

The settings panel covers feature switches, IME behavior, recursive expansion, word boundaries, fraction scanning, matrix environments, Tab navigation, automatic brackets, the complete snippet source, and snippet variables. Sources are validated before saving, so invalid configuration does not replace the current working setup.

Regexes are compiled before saving; invalid string regexes in legacy settings are isolated at runtime. Settings become active only after persistence succeeds. Failed writes keep the previous configuration and show a retry message. Rule ordering and regex compilation are cached per configuration revision. MathLive replacements require exact position mappings and preserve input when either boundary cannot be represented.

Initialization reads saved settings before enabling listeners, commands, or settings controls. Closing, unloading, or reusing a formula panel cancels pending attachment; replaced textarea and MathLive elements are rebound without retaining old listeners. Document `dm` conversion validates a detached result before replacing the paragraph, preserves native input on conversion failure, and keeps the full trigger in its undo snapshot.

Shortcut defaults: Tab for manual snippets, next tabstop, forward tabout, and matrix cells; Shift-Tab for previous tabstop and reverse tabout; `/` for fractions; Enter for matrix rows; Shift-Enter for matrix exit. Each action has its own setting. Use key names such as `Ctrl-j`, `Mod-/`, `Shift-Enter`, or `Ctrl--`; leave a field empty to disable that action. `Mod` accepts Ctrl or Command. Changing the fraction key leaves ordinary slashes untouched. Fraction shortcuts avoid text/restricted macros and comments.

Snippet-specific `triggerKey` bindings take precedence over the global manual shortcut, and active tabstops take precedence over ordinary matrix navigation. MathLive uses native placeholder commands. Open the snippet reference from settings or the command palette; searching never runs dynamic replacement functions.

## Installation

SiYuan `3.8.0` or later is required.

### Manual installation

1. Obtain a built `package.zip`, or build it from source as described below.
2. Extract it into `data/plugins/siyuan-latex-suite/` in your SiYuan workspace.
3. Enable the plugin from SiYuan's downloaded package list.

## Host limitations

SiYuan's formula panel does not expose Obsidian's CodeMirror 6 Markdown decoration layer. Conceal, editing-time inline-math decorations, colored paired brackets, cursor-bracket highlighting, dollar coloring, and code-block language snippets therefore cannot be reproduced directly. SiYuan already provides a live formula preview; this plugin focuses on portable input, expansion, and navigation behavior.

This update targets portable behaviors from Obsidian LaTeX Suite **1.14.1**. See the [alignment record](UPSTREAM_ALIGNMENT.md) for completed work and remaining gaps. CodeMirror `context`/`includedPaths`, LuaSnip node APIs, module imports, and snippet-file watching are not supported. The customized bundled snippets are retained rather than replaced with all upstream defaults. MathLive uses native placeholders and differs from the source editor in linked-tabstop behavior.

## Development

```bash
npm install
npm run check
npm run package
```

- `npm run typecheck` checks TypeScript types.
- `npm test` runs unit and regression tests.
- `npm run build` creates the deployable `dist/` directory.
- `npm run package` creates `package.zip`.
- `npm run benchmark` measures a fixed snippet-matching workload, not SiYuan end-to-end input latency.

For isolated browser interaction checks, run `npm exec vite -- --host 127.0.0.1 --port 4175` and open `http://127.0.0.1:4175/tests/browser-harness.html`. This fixture does not connect to SiYuan data.

## Acknowledgements

The snippet compatibility target and typing workflow are inspired by [Obsidian LaTeX Suite](https://github.com/artisticat1/obsidian-latex-suite). Thanks to [artisticat1](https://github.com/artisticat1) and all upstream contributors; MIT attribution is retained in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). This is an independent SiYuan plugin.

## License

[MIT License](LICENSE) © 2026 eonewg
