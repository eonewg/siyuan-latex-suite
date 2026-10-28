# Latex Suite user guide

[Project home](../README.md) · [简体中文](guide.zh-CN.md) · [Changelog](../CHANGELOG.md)

This guide describes input behavior in 0.4.2. Examples use bundled snippets and default keys. If you have customized your configuration, the in-plugin snippet reference shows what is currently saved.

## Contents

- [Your first formula](#your-first-formula)
- [Shortcuts and navigation](#shortcuts-and-navigation)
- [Fractions, matrices, and selections](#fractions-matrices-and-selections)
- [Custom snippets](#custom-snippets)
- [Macro scopes](#macro-scopes)
- [Settings and saving](#settings-and-saving)
- [Upgrade from 0.2.x](#upgrade-from-02x)
- [Editors and compatibility](#editors-and-compatibility)
- [Troubleshooting](#troubleshooting)
- [Development checks](#development-checks)

## Your first formula

### Open an editor

Type `mk` in document text to create an inline formula, or `dm` in an empty paragraph to create a math block. SiYuan's built-in formula actions also work. Custom snippets do not expand in ordinary document text; `mk` / `dm` are specifically adapted entry points.

### Write an expression with a fraction

1. Type `@a` in the formula editor to insert `\alpha`.
2. Continue with `+x/`. The result is `\alpha+\frac{x}{}`, with the cursor in the denominator.
3. Type `y` to fill the denominator.
4. Press `Tab` to reach the position after the fraction and continue typing.

Automatic snippets expand when you finish their trigger, without a space or Tab. Manual snippets need the expansion key. For example, the bundled `sum` expands automatically to `\sum`; pressing `Tab` then inserts a template with limits. Type to replace the active tabstop's default value.

### Find more snippets

Open the plugin settings from the downloaded package list and click the snippet reference button, or search for **Latex Suite snippet reference** in SiYuan's command palette.

Search covers triggers, descriptions, templates, and macro scopes, with filters for automatic, manual, and selection snippets. The reference reads saved settings and does not run dynamic replacement functions. Unsaved edits are not included.

## Shortcuts and navigation

### Default keys

These nine actions can each be rebound or disabled by leaving the field empty:

| Action | Default | When to use it |
| --- | --- | --- |
| Expand a manual snippet | `Tab` | A matching manual trigger precedes the cursor |
| Next tabstop | `Tab` | A template has another parameter |
| Previous tabstop | `Shift-Tab` | Return to the preceding parameter |
| Forward tabout | `Tab` | Pass a closing delimiter or close the formula panel |
| Reverse tabout | `Shift-Tab` | Move before an opening delimiter or close the panel |
| Automatic fraction | `/` | Use the preceding expression or selection as a numerator |
| Matrix column | `Tab` | Insert ` & ` in an eligible matrix cell |
| Matrix row | `Enter` | Insert a row separator with suitable whitespace |
| Matrix next line end / exit | `Shift-Enter` | Move to the next line end or environment end |

The default global toggle is `Alt+Shift+L`, or `Option+Shift+L` on macOS. The toggle command is also available in the command palette. Input and key events while disabled discard stale tabstop state.

### How Tab chooses an action

Active tabstops take precedence over ordinary matrix navigation and tabout. Manual expansion also runs before ordinary matrix navigation. When matrix columns and forward tabout share a key, the plugin first tries to leave a closing bracket within the current cell before adding a column.

With no other target, tabout can close the formula panel. Enable the boundary-only exit setting if you want this to happen only at the start or end. Typing an existing `)`, `]`, or `}` also skips it, subject to the tabout switch and configured closing-symbol list.

### Rebind an action

Use spellings such as `Ctrl-j`, `Mod-/`, and `Shift-Enter`. `Mod` accepts Ctrl or Command; `Ctrl--` means Ctrl plus minus. Choose keys that your operating system and host do not intercept.

A snippet's own `triggerKey` takes precedence over the global manual expansion key. Rebinding the fraction key leaves ordinary `/` input unchanged.

## Fractions, matrices, and selections

### Automatic fractions

| Action | Default result |
| --- | --- |
| Type `x/` | Insert `\frac{x}{}` and enter the denominator |
| Type `(a+b)/` | Use the grouped expression as the numerator |
| Select an expression and press `/` | Use the selection as the numerator |
| Type `//` | Insert an empty fraction; fill the numerator, then the denominator |

The fraction command defaults to `\frac`. Scan-breaking characters determine where the numerator scan stops. Superscripts and `\pu{}` are excluded by default, with configurable delimiter pairs in JSON. Fraction actions avoid text macros, restricted macros, and comments.

### Matrices and aligned equations

Type `pmat` or `bmat` to insert a `pmatrix` or `bmatrix` template, then:

1. Fill the first cell and press `Tab` to add a column.
2. Press `Enter` to create a row.
3. Press `Shift+Enter` to navigate to the next line end or environment end. This action does not insert a row.

For a 2 × 2 matrix, enter `a`, Tab, `b`, Enter, `c`, Tab, `d` inside the `bmat` template.

Single-line environments use spaces after `\\`; multiline environments preserve indentation. Default environments are `pmatrix`, `bmatrix`, `Bmatrix`, `vmatrix`, `Vmatrix`, `matrix`, `array`, `cases`, `align`, `aligned`, and `gather`, plus the `eqalign` macro. These lists are configurable.

Matrix column insertion may be suppressed inside fraction arguments, text macros, color arguments, and comments. Move back into the cell's math content before adding a column.

### Selection transformations and brackets

Select an expression, then use one of these bundled keys:

| Key | Template command |
| --- | --- |
| `U` | `\underbrace` |
| `O` | `\overbrace` |
| `C` | `\cancel` |
| `K` | `\cancelto` |
| `B` | `\underset` |

These are uppercase keys: press Shift with the letter. Fill any annotation or parameter tabstops after expansion. Custom selection templates can use `${VISUAL}`.

Automatic bracket enlargement adds `\left` / `\right` when snippets contain configured commands such as `\frac`, `\sum`, and `\int`. Both trigger commands and spacing inside enlarged brackets are configurable.

## Custom snippets

### Where to edit

Open plugin settings and edit the snippets source field. It holds the complete snippet array: add entries to the existing array to retain the bundled rules you use. You can back up both source fields by copying their contents into your own files.

Snippets and variables are trusted JavaScript expressions with comments, regex literals, and functions. Use configuration you understand and trust. Snippets accept an array or an expression-style `export default [...]`; variables accept an object or `export default {...}`. Full modules, `import`, and `require("latex-suite")` are unsupported.

### Example rules

Use this array as a standalone configuration, or add individual entries to your existing array. `frac` and `same` are custom triggers introduced by this example:

```js
[
  // Automatic: @q → \quad
  {trigger: "@q", replacement: "\\quad", options: "mA"},

  // Manual: frac + Tab; numerator, denominator, then position after the fraction
  {trigger: "frac", replacement: "\\frac{$0}{$1}$2", options: "m"},

  // Defaults and linked occurrences in the native source editor
  {trigger: "same", replacement: "${0:x}+${0:x}$1", options: "m"},

  // Regex: xnorm → \lVert x \rVert
  {
    trigger: /([A-Za-z])norm/,
    replacement: "\\lVert [[0]] \\rVert$0",
    options: "mrA"
  },

  // Selection: select an expression and press U
  {trigger: "U", replacement: "\\underbrace{${VISUAL}}_{$0}$1", options: "mv"},

  // Key-only: Ctrl-j in a formula editor, with no trigger text
  {replacement: () => "\\operatorname{$0}$1", options: "m", triggerKey: "Ctrl-j"}
]
```

### Template syntax

| Syntax | Meaning |
| --- | --- |
| `$0`, `$1`, `$2` | Navigate in ascending numeric order; **`$0` comes first** |
| `${0:x}` | Tabstop 0 with default text `x` |
| Repeated indices | Linked editing in the native source editor |
| `[[0]]`, `[[1]]` | First and second regex capture groups, not the whole match |
| `[[name]]` | Named regex capture group |
| `${VISUAL}` or `[[selection]]` | Selected text; use `v` for explicit selection mode |

Escape LaTeX backslashes as `\\` inside JavaScript strings. Dynamic `replacement` functions receive a string trigger or a regex match and must synchronously return a string. Return `false` to skip a match; async functions are unsupported. A throwing rule is isolated in the current editor. Change its source or reopen the formula to retry.

### Options and extra fields

| Option | Behavior |
| --- | --- |
| `m` | Inline formulas and math blocks, excluding text-macro content |
| `M` | Math blocks only |
| `n` | Inline formulas only |
| `T` | Inside text macros; use `MT` / `nT` to restrict formula type |
| `t` | Upstream document-text mode; only `mk` / `dm` receive native document adaptation |
| `A` | Expand automatically; otherwise expansion normally uses Tab |
| `r` | Regex trigger; a regex literal can also be used directly |
| `w` | Require word boundaries on both sides, as configured in settings |
| `v` | Selection snippet |

`description` appears in the snippet reference; `priority` controls rule matching priority. Other fields include `flags`, `triggerKey`, `triggerAfter`, `includedMacros`, `excludedMacros`, and `excludedEnvironments`. `triggerAfter` matches text after the cursor; that match is included in the replacement range.

### Trigger variables

Define reusable regex fragments in the separate snippet variables field:

```js
{
  "${GREEK}": "alpha|beta|gamma|delta|theta|lambda|sigma|omega",
  "${ARROW}": "to|rightarrow|leftarrow|mapsto"
}
```

Use names such as `${GREEK}` in `trigger` or `triggerAfter`. To interpret alternatives as regex syntax, use a regex trigger or the `r` option. Variable substitution does not automatically make a plain trigger a regex.

## Macro scopes

Math arguments, text arguments, and restricted arguments such as color names are handled separately. For example, the second argument of `\textcolor{red}{x}` remains eligible for math snippets, while the color name should remain unchanged.

The text/restricted macro setting takes JSON:

```json
{
  "text": ["mytext", {"name": "caption", "arguments": [1]}],
  "restricted": ["operatorname", {"name": "metadata"}]
}
```

`text` regions use `T` snippets; `restricted` regions suppress snippets by default. Custom entries extend the built-in macro argument rules.

Write macro names without a backslash. Argument indices start at 0: `"foo"` matches only the first argument, `{"name":"foo","arguments":[1]}` matches the second, and `{"name":"foo"}` matches all arguments. This notation also applies to per-snippet `includedMacros` / `excludedMacros`.

`includedMacros` checks the innermost macro and argument; explicit exclusions still take precedence. The first argument of `operatorname` is a custom restricted region by default. Remove that entry from the setting if needed.

## Settings and saving

| Group | Controls |
| --- | --- |
| Feature switches | Automatic/manual snippets, fractions, matrices, tabout, selection snippets |
| Input behavior | IME composition protection, inline trailing whitespace, word delimiters, recursion limit |
| Fractions | Command, scan boundaries, excluded regions |
| Matrices | Recognized environments and macros |
| Brackets and tabout | Closing symbols, boundary-only exit, enlargement commands and spacing |
| Custom configuration | Full snippet source, variables, macro regions, nine shortcuts |

The recursion limit defaults to `0`, which disables recursive expansion. A positive integer permits further automatic expansion after the first match, up to the configured limit.

Confirming settings validates syntax, structure, and regexes before saving. New settings become active only after a successful write. Failed writes keep the previous configuration active and display a message; successive writes are processed in order. IME composition protection is recommended. Linked tabstops also wait for composition to commit.

## Upgrade from 0.2.x

- **Custom source is preserved verbatim.** Only an unchanged old bundled source receives the updated `beg` rules: spaces for inline formulas and newlines for blocks. Keep your own rules when adding new snippets.
- **Use `T` for text macros.** Change older `t` rules intended for `\text{}` content to `T`. Lowercase `t` means upstream document-text mode.
- **Review macro exclusions.** A string macro name now matches only argument 0. Use an object without `arguments` to match all arguments.
- **Missing shortcut fields inherit defaults.** Rebind or disable individual actions if needed.
- **Check API dependencies when migrating from Obsidian.** Supported expressions and templates can be reused; code requiring `view` / `ctx`, CodeMirror, LuaSnip, or module imports needs adaptation.

Native source-editor tabstops start at `$0`; it is not the final exit position. For a fraction template, put the numerator at `$0`, denominator at `$1`, and final position at `$2`.

## Editors and compatibility

| Editor | Adaptation and differences |
| --- | --- |
| Native inline/block source editor | Edits LaTeX text directly and supports linked tabstop occurrences |
| MathLive from Math Enhance | Uses native placeholders/navigation; preserves input or leaves navigation to MathLive when positions cannot be mapped exactly |
| Desktop, mobile, browser frontends | Attaches to recognized formula editors; keys can be adjusted for available input devices |

The source editor prefers browser edit transactions to preserve undo history. Undo/redo clears stale tabstops and does not restore historical ones. When the frontend cannot use this edit command, direct text editing remains available, without a guarantee of native undo history.

The plugin targets portable behaviors from Obsidian LaTeX Suite 1.14.1 while retaining its own customized snippets. Conceal, colored brackets, dollar coloring, CodeMirror `context` / `includedPaths`, LuaSnip node APIs, file watching, and full module imports are unsupported. Reverse exit closes SiYuan's formula panel without guaranteeing a document cursor before the formula.

Automated and isolated Chromium checks do not establish real-host behavior across all SiYuan frontends or actual MathLive instances. See the [alignment record](../UPSTREAM_ALIGNMENT.md#验证边界) for validation scope (Chinese).

## Troubleshooting

### A trigger does not expand

Confirm that the plugin and the corresponding feature are enabled, and that the cursor is in a formula editor. Check whether the snippet needs Tab, is limited to inline/block mode, or is inside a text or excluded region. Expansion pauses during uncommitted IME composition by default. Search the saved snippet reference to confirm that the trigger exists in your current configuration.

### frac or mat does nothing

The bundled fraction entry points are `x/` and `//`; matrices use `pmat` / `bmat`. `frac` is a custom example in this guide and must be added first. There is no bundled `mat` trigger.

### Tab adds a column or exits unexpectedly

Check for active tabstops and for brackets or fraction arguments within the current cell. Then check changed or disabled keybindings and whether the host intercepts the key. Native source and MathLive navigation differ in some details.

### Settings did not take effect

Look for validation or write-failure messages. Confirm that you edited the intended snippets or variables field and confirmed the settings. Failed writes do not activate the new configuration; correct the issue and retry.

### A dynamic snippet stopped working

A throwing rule is isolated in the current editor and reported once; healthy rules remain available. Check that the function synchronously returns a string or `false`, save the corrected source, or reopen the formula and retry.

### The marketplace shows an older version

The marketplace index syncs separately from GitHub Releases. Restart SiYuan later to refresh it, or manually install the latest release's `package.zip`. The plugin directory should contain `plugin.json` directly, without an extra enclosing folder.

## Development checks

Run `npm ci` in the project directory, then:

| Command | Purpose |
| --- | --- |
| `npm run typecheck` | TypeScript type checks |
| `npm test` | Unit and regression tests |
| `npm run check` | Type checks, tests, production build |
| `npm run package` | Build and create an installable `package.zip` |
| `npm run benchmark` | A fixed snippet-matching microbenchmark, not end-to-end SiYuan input latency |

Run `npm exec vite -- --host 127.0.0.1 --port 4175` and open `http://127.0.0.1:4175/tests/browser-harness.html` to check the source editor and snippet reference in isolation. The fixture does not connect to SiYuan data or contain a real MathLive instance.
