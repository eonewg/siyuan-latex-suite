# Latex Suite

> 为思源笔记提供快捷、可配置、接近手写速度的 LaTeX 公式输入体验。

![Latex Suite 公式输入预览](preview.png)

[English](README.md) · [问题反馈](https://github.com/eonewg/siyuan-latex-suite/issues) · [第三方声明](THIRD_PARTY_NOTICES.md)

## 简介

Latex Suite 是面向思源笔记公式编辑器的输入增强插件。它把 snippets、自动分数、停靠点导航、矩阵快捷键、选区变换和智能括号等能力整合到思源原生公式源码框中，也兼容“数学增强”插件提供的 MathLive 编辑器。

插件不仅能在公式面板内加速输入，还可以直接在正文中键入 `mk` 创建行级公式，或在空段落中键入 `dm` 创建公式块。内置配置包含 150 余个经过测试的 snippets，并允许在设置中完全替换、扩展或重写。

## 主要功能

### Snippets 输入引擎

- 支持自动片段与按 Tab 展开的片段。
- 支持字符串和正则表达式触发器、`triggerAfter`、优先级和自定义快捷键。
- 支持 JavaScript 函数形式的动态 replacement。
- 支持环境、宏及宏参数区域排除，避免在 `\text{}`、`\ce{}` 等上下文中误展开。
- 支持 `includedMacros` 限定片段区域，以及按参数配置文本宏和禁用片段的宏。
- 支持触发器变量，例如 `${GREEK}`、`${SYMBOL}`，便于复用大型正则规则。
- 支持自动递归展开，并可限制最大递归次数。
- 可搜索已保存片段的触发词、模板、说明及宏范围；从设置或命令面板打开“Latex Suite 片段速查”。

### 模板与光标停靠点

- `$0`、`$1`、`$2` 等编号停靠点。
- `${1:默认值}` 形式的默认内容。
- 同编号停靠点联动编辑。
- `[[0]]`、命名捕获组和 `${VISUAL}` 选区插入。
- Tab/Shift+Tab 在停靠点间前进和后退。

### 公式输入增强

- `x/`、`(a+b)/` 等输入自动转换为分数，并把光标放入分母。
- 可配置分数命令、向左扫描终止字符和排除区域。
- 矩阵、`cases`、`align`、`aligned` 等环境内，Tab 优先跳出当前单元格括号，再换列；Enter 在单行矩阵中插入 `\\` 和空格，在多行矩阵中保留缩进换行；Shift+Enter 跳到下一行末尾或环境结尾。
- Tab 可跳过右括号、右方括号、`\rangle` 等闭合符号。
- Shift+Tab 可退到左括号或 `\left` 等命令之前；存在片段停靠点时优先导航停靠点。
- 没有其他可跳位置时，Tab 可直接退出公式输入面板。
- 分数、求和、积分等片段可自动生成 `\left` / `\right`。
- 中文输入法组合期间默认暂停自动片段，上屏后展开一次，避免漏展开或重复展开。
- 重复停靠点也会等输入法提交后再联动；停用后的输入和按键会清理旧联动状态。
- Backspace、撤销和重做不会重新触发自动片段。
- 原生源码框优先保留浏览器撤销历史；Chromium 中可撤回片段到触发词并重做恢复。历史操作后清除旧停靠点，避免联动误改；不恢复历史停靠点。其他前端若不支持原生编辑命令，则回退文本修改。
- 动态 replacement 报错时仅在当前编辑器跳过该规则并提示一次；修复配置或重新打开公式后可重试。replacement 须同步返回字符串或 `false`，不支持异步函数。
- 再次键入光标右侧已有的 `)`、`]`、`}` 可跳过它，避免重复输入。
- 片段展开、停靠点前后移动、双向跳出、自动分数、矩阵换列/换行/跳出共 9 个动作均可独立改键或禁用。

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

打开“设置 → 集市 → 已下载 → Latex Suite → 设置”，可以直接编辑 snippets 和变量。配置是受信任的 JavaScript 表达式，不是 JSON，因此支持注释、正则字面量和函数。

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
| `T` | 在 `\text{}` 等文本宏内部启用，可与 `M`、`n` 组合 |
| `t` | 上游的正文模式；此处的自定义引擎只处理公式，正文仅适配 `mk`、`dm` |
| `A` | 输入触发词后自动展开；没有 `A` 时通常按 Tab 展开 |
| `r` | 将触发器作为正则表达式匹配 |
| `w` | 要求触发词位于可配置的单词边界 |
| `v` | 选区片段 |

支持的额外字段包括 `triggerAfter`、`priority`、`description`、`flags`、`triggerKey`、`includedMacros`、`excludedMacros` 和 `excludedEnvironments`。仅绑定快捷键时可以省略 `trigger`。也可粘贴 `export default [...]` 或 `export default {...}` 形式的配置表达式。

从 0.2.x 升级时，如果曾按旧版说明用 `t` 匹配文本宏，请将对应规则改成 `T`。自定义源文本保留原样；只有完全未修改的旧内置配置会更新 `beg`，使其在行级公式中使用空格、在公式块中使用换行。

宏列表中的字符串（如 `excludedMacros: ["foo"]`）只匹配第一个参数。用 `{name: "foo", arguments: [1]}` 匹配第二个参数，用 `{name: "foo"}` 匹配全部参数；参数编号从 0 开始。`includedMacros` 只检查最内层宏，显式排除仍然优先。

“文本宏与禁用片段区域”设置使用 JSON，例如：

```json
{
  "text": ["mytext", {"name": "caption", "arguments": [1]}],
  "restricted": ["operatorname", {"name": "metadata"}]
}
```

内置规则按参数区分 `\textcolor` 的颜色和数学内容，以及 `\colorbox`、`\fcolorbox` 的颜色和文本内容。自定义区域会叠加到内置区域。

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

快捷键默认值如下。在设置中直接修改对应动作；支持 `Ctrl-j`、`Mod-/`、`Shift-Enter`、`Ctrl--` 等格式，留空禁用该动作。`Mod` 可使用 Ctrl 或 Command。改变自动分数键后，普通 `/` 保留为字面斜杠；分数快捷键同时支持光标前的表达式和选区，并避开文本宏、受限宏及注释。

| 动作 | 默认键 |
| --- | --- |
| 展开手动片段 / 下一个停靠点 / 向右跳出 / 矩阵换列 | `Tab`（四项可分别配置） |
| 上一个停靠点 / 向左跳出 | `Shift-Tab`（两项可分别配置） |
| 自动分数 | `/` |
| 矩阵换行 | `Enter` |
| 矩阵下一行末尾 / 跳出 | `Shift-Enter` |

现有停靠点优先于普通矩阵导航。每个片段自己的 `triggerKey` 优先于全局片段展开键。MathLive 通过原生占位符导航命令响应改键，仍保留其原生编辑行为。

插件设置包含以下几组功能：

- **功能开关**：自动片段、Tab 片段、自动分数、矩阵快捷键、Tab 跳出、选区片段。
- **输入行为**：输入法组合抑制、片段尾随空格、递归次数、单词分隔符。
- **自动分数**：分数命令、终止字符和排除区域。
- **矩阵导航**：可识别的环境和宏。
- **Tab 导航**：可跳过的闭合符号、是否只允许从公式末尾退出。
- **自动括号**：触发命令和括号内侧空格。
- **自定义配置**：完整 snippets 源与 snippet 变量源。
- **宏区域**：自定义文本宏、禁用片段的宏及其参数范围。
- **快捷键与速查**：独立配置 9 个动作，查看和筛选已保存片段；速查不会执行动态 replacement 函数。

设置保存前会进行语法和结构校验；格式错误时不会覆盖当前有效配置。

插件会先读取已保存的配置，再启用编辑监听、命令和设置入口，避免启动时默认配置抢先生效。关闭、卸载或复用公式面板会取消待挂载操作；源码框与 MathLive 节点更换后会重新绑定。

正则在保存前编译检查；旧配置中的坏字符串正则会单独跳过。保存成功后才切换运行配置，写入失败时继续使用之前的配置并提示重试。匹配排序和正则编译结果按配置缓存，编辑源文本后自动使用新结果。

## 安装

要求思源笔记 `3.8.0` 或更高版本。

正文 `dm` 转换会先验证目标公式块，转换失败时保留正常输入；成功转换的撤销快照保留完整触发词。

### 手动安装

1. 获取构建好的 `package.zip`，或按照下方开发说明自行构建。
2. 解压到思源工作空间的 `data/plugins/siyuan-latex-suite/`。
3. 在“设置 → 集市 → 已下载”中启用插件。

## 与宿主相关的限制

思源公式面板没有暴露 Obsidian CodeMirror 6 的 Markdown 装饰层，因此 Conceal、正文编辑态公式预览、彩色成对括号、光标括号高亮、美元符号着色和代码块语言 snippets 无法原样实现。思源本身已经提供实时公式预览，本插件专注于可稳定移植的输入、展开和导航能力。

本轮以 Obsidian LaTeX Suite **1.14.1** 为对照，具体完成项、待适配能力和验证边界见 [上游对齐记录](UPSTREAM_ALIGNMENT.md)。依赖 CodeMirror 的 `context`、`includedPaths`、LuaSnip 节点 API、模块导入及片段文件监听尚未支持；内置片段保留原有定制集，并未替换成上游全部默认片段。MathLive 使用原生占位符，停靠点联动与源码框存在差异。

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
- `npm run benchmark`：运行固定片段匹配微基准，不代表思源整体输入延迟。

浏览器交互夹具位于 `tests/browser-harness.html`。运行 `npm exec vite -- --host 127.0.0.1 --port 4175` 后打开 `http://127.0.0.1:4175/tests/browser-harness.html`，可单独检查源码框和片段速查，不连接思源数据。

## 致谢

本项目的 snippets 兼容目标和输入体验受到 [Obsidian LaTeX Suite](https://github.com/artisticat1/obsidian-latex-suite) 启发。感谢 [artisticat1](https://github.com/artisticat1) 及所有上游贡献者；相关 MIT 归属见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。本项目是独立的思源插件。

## 许可证

[MIT License](LICENSE) © 2026 eonewg
