# SiYuan LaTeX Suite

> 为思源笔记提供快捷、可配置、接近手写速度的 LaTeX 公式输入体验。

![LaTeX Suite 公式输入预览](preview.png)

[English](README.md) · [问题反馈](https://github.com/eonewg/siyuan-latex-suite/issues) · [第三方声明](THIRD_PARTY_NOTICES.md)

## 简介

SiYuan LaTeX Suite 是面向思源笔记公式编辑器的输入增强插件。它把 snippets、自动分数、停靠点导航、矩阵快捷键、选区变换和智能括号等能力整合到思源原生公式源码框中，也兼容“数学增强”插件提供的 MathLive 编辑器。

插件不仅能在公式面板内加速输入，还可以直接在正文中键入 `mk` 创建行级公式，或在空段落中键入 `dm` 创建公式块。内置配置包含 150 余个经过测试的 snippets，并允许在设置中完全替换、扩展或重写。

## 主要功能

### Snippets 输入引擎

- 支持自动片段与按 Tab 展开的片段。
- 支持字符串和正则表达式触发器、`triggerAfter`、优先级和自定义快捷键。
- 支持 JavaScript 函数形式的动态 replacement。
- 支持环境、宏及宏参数区域排除，避免在 `\text{}`、`\ce{}` 等上下文中误展开。
- 支持触发器变量，例如 `${GREEK}`、`${SYMBOL}`，便于复用大型正则规则。
- 支持自动递归展开，并可限制最大递归次数。

### 模板与光标停靠点

- `$0`、`$1`、`$2` 等编号停靠点。
- `${1:默认值}` 形式的默认内容。
- 同编号停靠点联动编辑。
- `[[0]]`、命名捕获组和 `${VISUAL}` 选区插入。
- Tab/Shift+Tab 在停靠点间前进和后退。

### 公式输入增强

- `x/`、`(a+b)/` 等输入自动转换为分数，并把光标放入分母。
- 可配置分数命令、向左扫描终止字符和排除区域。
- 矩阵、`cases`、`align` 等环境内，Tab 换列、Enter 换行、Shift+Enter 跳到下一行末尾。
- Tab 可跳过右括号、右方括号、`\rangle` 等闭合符号。
- 没有其他可跳位置时，Tab 可直接退出公式输入面板。
- 分数、求和、积分等片段可自动生成 `\left` / `\right`。
- 中文输入法组合期间默认暂停自动片段，避免尚未上屏时误触发。
- Backspace、撤销和重做不会重新触发自动片段。

### 编辑器兼容

- 思源原生行级公式源码编辑器。
- 思源原生公式块源码编辑器。
- “数学增强”插件提供的 MathLive 编辑器。
- 桌面端、移动端和浏览器端思源前端。

## 快速上手

安装并启用插件后，可以从以下输入开始：

| 输入方式 | 结果或行为 |
| --- | --- |
| 正文中键入 `mk` | 创建行级公式并打开公式编辑器 |
| 空段落中键入 `dm` | 创建公式块并打开公式编辑器 |
| `@a` 或 `alpha` | 自动展开为 `\alpha` |
| `sin`、`cos`、`log` | 自动展开为对应的 LaTeX 函数 |
| `xsr` | 自动展开为 `x^{2}` |
| `x/` | 自动生成 `\frac{x}{}` 并进入分母 |
| `frac` 后按 Tab | 插入带分子、分母停靠点的分数模板 |
| `mat` 后按 Tab | 插入矩阵模板 |
| 选中公式后按 `U` | 用 `\underbrace` 包裹选区 |

全局快捷键 `Alt+Shift+L` 可以快速启用或停用插件。

## 自定义 Snippets

打开“设置 → 集市 → 已下载 → LaTeX 输入增强 → 设置”，可以直接编辑 snippets 和变量。配置是受信任的 JavaScript 表达式，不是 JSON，因此支持注释、正则字面量和函数。

```js
[
  // 自动展开：@q → \quad
  {trigger: "@q", replacement: "\\quad", options: "mA"},

  // 正则捕获：xnorm → \lVert x \rVert
  {
    trigger: /([A-Za-z])norm/,
    replacement: "\\lVert [[0]] \\rVert$0",
    options: "mrA"
  },

  // Tab 片段与停靠点
  {trigger: "frac", replacement: "\\frac{$1}{$2}$0", options: "m"},

  // 选区片段
  {trigger: "U", replacement: "\\underbrace{${VISUAL}}_{$1}$0", options: "mv"},

  // 自定义快捷键
  {
    trigger: "op",
    replacement: () => "\\operatorname{$1}$0",
    options: "m",
    triggerKey: "Ctrl-o"
  }
]
```

常用 `options`：

| 选项 | 含义 |
| --- | --- |
| `m` | 在公式环境中启用 |
| `M` | 仅在公式块中启用 |
| `n` | 仅在行级公式中启用 |
| `t` | 在 `\text{}` 等文本宏内部启用 |
| `A` | 输入触发词后自动展开；没有 `A` 时通常按 Tab 展开 |
| `r` | 将触发器作为正则表达式匹配 |
| `w` | 要求触发词位于可配置的单词边界 |
| `v` | 选区片段 |

支持的额外字段包括 `triggerAfter`、`priority`、`description`、`flags`、`triggerKey`、`excludedMacros` 和 `excludedEnvironments`。

Snippet 变量使用对象表达式：

```js
{
  "${GREEK}": "alpha|beta|gamma|delta|theta|lambda|sigma|omega",
  "${ARROW}": "to|rightarrow|leftarrow|mapsto"
}
```

> [!WARNING]
> Snippets 与变量会作为受信任的 JavaScript 配置执行。只粘贴你理解并信任的配置。

## 设置说明

插件设置包含以下几组功能：

- **功能开关**：自动片段、Tab 片段、自动分数、矩阵快捷键、Tab 跳出、选区片段。
- **输入行为**：输入法组合抑制、片段尾随空格、递归次数、单词分隔符。
- **自动分数**：分数命令、终止字符和排除区域。
- **矩阵导航**：可识别的环境和宏。
- **Tab 导航**：可跳过的闭合符号、是否只允许从公式末尾退出。
- **自动括号**：触发命令和括号内侧空格。
- **自定义配置**：完整 snippets 源与 snippet 变量源。

设置保存前会进行语法和结构校验；格式错误时不会覆盖当前有效配置。

## 安装

要求思源笔记 `3.8.0` 或更高版本。

### 手动安装

1. 获取构建好的 `package.zip`，或按照下方开发说明自行构建。
2. 解压到思源工作空间的 `data/plugins/siyuan-latex-suite/`。
3. 在“设置 → 集市 → 已下载”中启用插件。

## 与宿主相关的限制

思源公式面板没有暴露 Obsidian CodeMirror 6 的 Markdown 装饰层，因此 Conceal、正文编辑态公式预览、彩色成对括号、光标括号高亮、美元符号着色和代码块语言 snippets 无法原样实现。思源本身已经提供实时公式预览，本插件专注于可稳定移植的输入、展开和导航能力。

## 开发

```bash
npm install
npm run check
npm run package
```

- `npm run typecheck`：TypeScript 类型检查。
- `npm test`：运行单元与回归测试。
- `npm run build`：生成可部署的 `dist/`。
- `npm run package`：生成 `package.zip`。

## 致谢

本项目的 snippets 兼容目标和输入体验受到 [Obsidian LaTeX Suite](https://github.com/artisticat1/obsidian-latex-suite) 启发。感谢 [artisticat1](https://github.com/artisticat1) 及所有上游贡献者；相关 MIT 归属见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。本项目是独立的思源插件。

## 许可证

[MIT License](LICENSE) © 2026 eonewg
