# Latex Suite

**Write formulas in SiYuan with fewer keystrokes.**

Turn `@a` into `\alpha` and `x/` into a fraction. Use Tab to fill templates, leave brackets, and build matrices. Latex Suite adds configurable input enhancements to SiYuan's native formula editors and adapts to the MathLive editor supplied by Math Enhance.

[简体中文](README_zh_CN.md) · [User guide](https://github.com/eonewg/siyuan-latex-suite/blob/main/docs/guide.en.md) · [Latest release](https://github.com/eonewg/siyuan-latex-suite/releases/latest) · [Report an issue](https://github.com/eonewg/siyuan-latex-suite/issues)

![Latex Suite formula input preview](preview.png)

## Try these first

After installing and enabling the plugin, try the bundled defaults:

| Where | Input / action | Result |
| --- | --- | --- |
| Document text | Type `mk` | Create and open an inline formula |
| Empty paragraph | Type `dm` | Create and open a math block |
| Formula editor | Type `@a` | Expand automatically to `\alpha` |
| Formula editor | Type `xsr` | Expand automatically to `x^{2}` |
| Formula editor | Type `x/` | Insert `\frac{x}{}` and enter the denominator |
| Formula editor | Type `pmat` or `bmat` | Insert a round- or square-bracket matrix template |
| Formula editor | Select an expression and press `U` | Add an underbrace with an annotation placeholder |

Use `Tab` / `Shift+Tab` for tabstops and navigation in both directions. In matrices, use `Tab` for columns and `Enter` for rows. The default global toggle is `Alt+Shift+L`, or `Option+Shift+L` on macOS.

To discover more triggers, open the snippet reference from plugin settings or search for **Latex Suite snippet reference** in the command palette. It searches your saved configuration and filters snippets by type.

## Features

| Capability | What it does |
| --- | --- |
| **200+ bundled snippets** | Greek letters, scripts, operators, matrices, and selection transformations, with automatic or manual expansion |
| **Templates and tabstops** | Fill numbered parameters and defaults; linked occurrences are supported in the native source editor |
| **Fractions and brackets** | Convert the preceding expression or selection into a fraction, skip closing delimiters, and enlarge brackets around suitable content |
| **Matrices and aligned equations** | Navigate columns and rows, leave brackets within a cell first, and preserve multiline indentation |
| **Custom rules** | Strings, regexes, dynamic functions, trigger variables, and macro-argument scope controls |
| **Configurable shortcuts** | Rebind or disable nine input/navigation actions, with optional shortcuts for individual snippets |

Expansion pauses during IME composition by default and resumes on commit. Failed settings writes keep the previous configuration active; a failing dynamic snippet is skipped without blocking healthy rules.

## Install and update

Requires **SiYuan 3.8.0 or later**. Native formula editors need no additional plugin. MathLive is provided by Math Enhance.

### From the marketplace

1. Open SiYuan's settings, go to **Marketplace → Plugins**, and search for **Latex Suite**.
2. Download it, then enable it in the downloaded package list.
3. Open a formula editor and try the examples above.

Marketplace updates follow the official index's periodic sync. If a release has not appeared yet, restart SiYuan later to refresh the index, or install it manually from GitHub.

### Manual installation

Download **`package.zip`** from the [latest release](https://github.com/eonewg/siyuan-latex-suite/releases/latest). Extract its contents directly into this directory in your workspace:

```text
data/plugins/siyuan-latex-suite/
├── plugin.json
├── index.js
├── index.css
└── ...
```

Enable it in the downloaded package list. Before upgrading, disable the plugin and copy your custom snippets and variables somewhere safe, then replace the program files and enable it again. Choose `package.zip`; GitHub's generated Source code archives require a build.

## Documentation

- **[User guide](https://github.com/eonewg/siyuan-latex-suite/blob/main/docs/guide.en.md)**: typing workflows, all default shortcuts, matrices, custom snippets, settings, and troubleshooting.
- **[Upgrade from 0.2.x](https://github.com/eonewg/siyuan-latex-suite/blob/main/docs/guide.en.md#upgrade-from-02x)**: `t` / `T`, configuration preservation, and migrating upstream snippets.
- **[Changelog](CHANGELOG.md)**: features and fixes by version.
- **[Obsidian alignment record](UPSTREAM_ALIGNMENT.md)**: ported behavior, host differences, and validation scope (Chinese).

Supported snippet syntax can be reused from Obsidian LaTeX Suite, but functions that depend on Obsidian APIs need adaptation. Native and MathLive placeholders behave differently. Conceal, colored brackets, and CodeMirror-specific features are not available. The alignment record details the compatibility target and what has been verified.

## Development and feedback

```bash
npm ci
npm run check
npm run package
```

`check` runs type checks, tests, and the production build. `package` creates an installable `package.zip`. See the [guide](https://github.com/eonewg/siyuan-latex-suite/blob/main/docs/guide.en.md#development-checks) for the matching benchmark and [isolated browser fixture](tests/browser-harness.html).

When [reporting an issue](https://github.com/eonewg/siyuan-latex-suite/issues), include your SiYuan and plugin versions, editor type, minimal reproduction steps, and the relevant snippet. Reduce custom configuration to the part needed to reproduce the problem.

## Acknowledgements and license

The snippet syntax and typing workflow are inspired by [Obsidian LaTeX Suite](https://github.com/artisticat1/obsidian-latex-suite). Thanks to [artisticat1](https://github.com/artisticat1) and upstream contributors. This is an independent SiYuan plugin; attribution and license details are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

[MIT License](LICENSE) © 2026 eonewg
