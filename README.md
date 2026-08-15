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
- Reusable trigger variables such as `${GREEK}` and `${SYMBOL}`.
- Configurable recursive expansion.

### Templates and tabstops

- Numbered `$0`, `$1`, and `$2` tabstops.
- Defaults such as `${1:value}`.
- Linked occurrences of the same tabstop.
- Regex captures, named captures, and `${VISUAL}` selections.
- Forward and backward navigation with Tab and Shift+Tab.

### Math typing enhancements

- Convert `x/` and `(a+b)/` into fractions and enter the denominator automatically.
- Configure the fraction command, scan boundaries, and excluded regions.
- Use Tab for columns, Enter for rows, and Shift+Enter for the next line end in matrices and aligned environments.
- Skip closing delimiters such as `)`, `]`, and `\rangle` with Tab.
- Exit the formula editor with Tab when no other navigation target remains.
- Add `\left` and `\right` automatically for snippets containing fractions, sums, or integrals.
- Suppress automatic expansion during IME composition.
- Avoid accidental re-expansion on Backspace, undo, and redo.

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
| `t` | Enable inside text macros such as `\text{}` |
| `A` | Expand automatically; without it, expansion normally occurs on Tab |
| `r` | Treat the trigger as a regular expression |
| `w` | Require configurable word boundaries |
| `v` | Visual/selection snippet |

Additional supported fields include `triggerAfter`, `priority`, `description`, `flags`, `triggerKey`, `excludedMacros`, and `excludedEnvironments`.

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

## Installation

SiYuan `3.8.0` or later is required.

### Manual installation

1. Obtain a built `package.zip`, or build it from source as described below.
2. Extract it into `data/plugins/siyuan-latex-suite/` in your SiYuan workspace.
3. Enable the plugin from SiYuan's downloaded package list.

## Host limitations

SiYuan's formula panel does not expose Obsidian's CodeMirror 6 Markdown decoration layer. Conceal, editing-time inline-math decorations, colored paired brackets, cursor-bracket highlighting, dollar coloring, and code-block language snippets therefore cannot be reproduced directly. SiYuan already provides a live formula preview; this plugin focuses on portable input, expansion, and navigation behavior.

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

## Acknowledgements

The snippet compatibility target and typing workflow are inspired by [Obsidian LaTeX Suite](https://github.com/artisticat1/obsidian-latex-suite). Thanks to [artisticat1](https://github.com/artisticat1) and all upstream contributors; MIT attribution is retained in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). This is an independent SiYuan plugin.

## License

[MIT License](LICENSE) © 2026 eonewg
