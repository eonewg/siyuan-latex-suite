# SiYuan LaTeX Suite

![LaTeX Suite 公式输入预览](preview.png)

把 Obsidian LaTeX Suite 1.12.2 的公式输入能力移植到思源笔记公式面板。插件同时支持思源原生公式源码框和“数学增强”插件的 MathLive 编辑器。

## 已实现功能

- 完整 snippets 源格式：直接支持 JavaScript 数组、注释、嵌套数组、RegExp、函数 replacement 和变量源。
- 匹配语义：`triggerAfter`、`priority`、`flags`、`triggerKey`、`description`、环境/宏排除和 `m/n/M/t/c/C/A/r/w/v/U` 选项解析。
- 模板语义：`[[0]]` 捕获组、`${VISUAL}`、`$0/$1`、默认值、重复编号联动和 Tab/Shift+Tab 停靠点。
- 自动片段、Tab 片段、CodeMirror 格式自定义快捷键（如 `Ctrl-a`）和可配置递归展开。
- 自动分数、选区分数、矩阵/`eqalign` 换列换行、智能跳过闭合符号、公式面板跳出和自动 `\left`/`\right`。
- 已内置当前 Obsidian `obsidian-latex-suite/data.json` 中的 snippets 与变量，无需重新粘贴。

## 使用

打开行级公式或公式块的编辑面板后直接输入。例如：

- `@a` 或 `alpha` → `\alpha`
- `xsr` → `x^{2}`
- `x/` → `\frac{x}{}`
- 普通 snippet 输入触发词后按 Tab
- 选中文本后使用配置中的 visual snippet 触发键
- 矩阵环境内按 Tab 换列、Enter 换行

全局快捷键 `Alt+Shift+L` 可临时启用或停用插件。所有开关、snippets 源、变量、递归、分隔符、自动分数、矩阵、Tabout 和自动放大括号规则均可在插件设置中修改。

## Snippet 格式

设置中的 snippets 是与 LaTeX Suite 相同的受信任 JavaScript 配置，不是 JSON：

```js
[
  {trigger: "@q", replacement: "\\quad", options: "mA"},
  {trigger: /([A-Za-z])norm/, replacement: "\\lVert [[0]] \\rVert$0", options: "mrA"},
  {trigger: "hot", replacement: () => "\\operatorname{hot}", options: "m", triggerKey: "Ctrl-h"},
  {trigger: "U", replacement: "\\underbrace{${VISUAL}}_{$0}", options: "mv"}
]
```

这段配置会在插件前端执行，只应粘贴你信任的 snippets 源。旧版插件的 `customSnippets` 会自动迁移。

## 与 Obsidian 的宿主差异

思源公式面板没有 Obsidian CodeMirror 6 的 Markdown 装饰层，因此 Conceal、正文编辑态公式预览、彩色成对括号、光标括号高亮、美元符号着色和代码块语言 snippets 无法原样移植。思源公式面板本身已经提供实时渲染预览；公式输入相关的可移植功能均在本插件中实现。

## 构建

```bash
npm install
npm run check
npm run package
```

将 `package.zip` 解压到工作空间的 `data/plugins/siyuan-latex-suite/` 后启用插件。
