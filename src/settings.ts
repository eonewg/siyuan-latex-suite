import {Setting, showMessage, type Plugin} from "siyuan";
import {BUNDLED_SNIPPETS_SOURCE, BUNDLED_SNIPPET_VARIABLES_SOURCE} from "./bundled-snippets-source";
import {parseSnippets, parseTextMacros} from "./core/snippet-parser";
import {DEFAULT_MATHLESS_MACROS} from "./core/context";
import {DEFAULT_KEYBINDINGS, parseKeybindings} from "./core/keyboard";
import type {Keybindings, LatexSuiteSettings} from "./types";

export const DEFAULT_SETTINGS: LatexSuiteSettings = {
    enabled: true,
    autoSnippets: true,
    tabSnippets: true,
    autoFraction: true,
    matrixShortcuts: true,
    tabOut: true,
    visualSnippets: true,
    snippetsSource: BUNDLED_SNIPPETS_SOURCE,
    snippetVariablesSource: BUNDLED_SNIPPET_VARIABLES_SOURCE,
    snippetRecursion: 0,
    removeSnippetWhitespace: true,
    suppressSnippetTriggerOnIME: true,
    textMacros: DEFAULT_MATHLESS_MACROS,
    keybindings: {...DEFAULT_KEYBINDINGS},
    wordDelimiters: "., +-\\n\\t:;!?\\/{}[]()=~$'\"|`<>*^%#@&",
    autoFractionSymbol: "\\frac",
    autoFractionBreakingChars: "+-=\\t",
    autoFractionExcludedEnvironments: [["^{", "}"], ["\\pu{", "}"]],
    matrixEnvironments: ["pmatrix", "cases", "align", "gather", "bmatrix", "Bmatrix", "vmatrix", "Vmatrix", "array", "matrix", "aligned"],
    matrixMacros: ["eqalign"],
    tabOutClosingSymbols: [")", "]", "\\rbrack", "\\}", "\\rbrace", "\\rangle", "\\rvert", "\\rVert", "\\rfloor", "\\rceil", "\\urcorner", "}"],
    tabOutExitOnlyAtEnd: false,
    autoEnlargeBrackets: true,
    autoEnlargeBracketTriggers: ["\\sum", "\\int", "\\frac", "\\prod", "\\bigcup", "\\bigcap"],
    autoEnlargeBracketSpace: false,
};

export interface Labels {
    enabled: string;
    enabledDescription: string;
    autoSnippets: string;
    autoSnippetsDescription: string;
    tabSnippets: string;
    tabSnippetsDescription: string;
    autoFraction: string;
    autoFractionDescription: string;
    matrixShortcuts: string;
    matrixShortcutsDescription: string;
    tabOut: string;
    tabOutDescription: string;
    visualSnippets: string;
    visualSnippetsDescription: string;
    customSnippets: string;
    customSnippetsDescription: string;
    invalidSnippets: string;
    saved: string;
    saveFailed?: string;
}

function checkbox(): HTMLInputElement {
    const element = document.createElement("input");
    element.type = "checkbox";
    element.className = "b3-switch fn__flex-center";
    return element;
}

function textField(type: "text" | "number" = "text"): HTMLInputElement {
    const element = document.createElement("input");
    element.type = type;
    element.className = "b3-text-field fn__flex-center";
    if (type === "number") {
        element.min = "0";
        element.step = "1";
    }
    return element;
}

function parseList(value: string): string[] {
    return value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
}

function parseExcludedEnvironments(value: string): Array<[string, string]> {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed) || parsed.some((pair) => !Array.isArray(pair)
        || pair.length !== 2 || pair.some((item) => typeof item !== "string"))) {
        throw new Error("自动分数排除区域必须是 [[\"开头\", \"结尾\"]] 格式");
    }
    return parsed.map((pair) => [pair[0], pair[1]] as [string, string]);
}

export function validateSnippetSources(snippetsSource: string, variablesSource: string): void {
    parseSnippets(snippetsSource, variablesSource);
}

export function createSettingsUI(
    plugin: Plugin,
    labels: Labels,
    getSettings: () => LatexSuiteSettings,
    saveSettings: (settings: LatexSuiteSettings) => Promise<void>,
    openSnippetReference?: () => void,
): {setting: Setting; refresh: () => void} {
    const controls = {
        enabled: checkbox(),
        autoSnippets: checkbox(),
        tabSnippets: checkbox(),
        autoFraction: checkbox(),
        matrixShortcuts: checkbox(),
        tabOut: checkbox(),
        visualSnippets: checkbox(),
        removeSnippetWhitespace: checkbox(),
        suppressSnippetTriggerOnIME: checkbox(),
        autoEnlargeBrackets: checkbox(),
        tabOutExitOnlyAtEnd: checkbox(),
        autoEnlargeBracketSpace: checkbox(),
    };
    const fields = {
        snippetRecursion: textField("number"),
        wordDelimiters: textField(),
        autoFractionSymbol: textField(),
        autoFractionBreakingChars: textField(),
        autoFractionExcludedEnvironments: textField(),
        matrixEnvironments: textField(),
        matrixMacros: textField(),
        tabOutClosingSymbols: textField(),
        autoEnlargeBracketTriggers: textField(),
        textMacros: textField(),
    };
    const keyFields = Object.fromEntries(Object.keys(DEFAULT_KEYBINDINGS).map((key) => [key, textField()])) as Record<keyof Keybindings, HTMLInputElement>;
    const snippetsSource = document.createElement("textarea");
    snippetsSource.className = "b3-text-field fn__block latex-suite__snippets";
    snippetsSource.spellcheck = false;
    const variablesSource = document.createElement("textarea");
    variablesSource.className = "b3-text-field fn__block latex-suite__snippets latex-suite__variables";
    variablesSource.spellcheck = false;

    const setting = new Setting({
        confirmCallback: () => {
            try {
                validateSnippetSources(snippetsSource.value, variablesSource.value);
                const current = getSettings();
                const recursion = Number(fields.snippetRecursion.value);
                if (!Number.isInteger(recursion) || recursion < 0) throw new Error("递归次数必须是非负整数");
                const next: LatexSuiteSettings = {
                    ...current,
                    enabled: controls.enabled.checked,
                    autoSnippets: controls.autoSnippets.checked,
                    tabSnippets: controls.tabSnippets.checked,
                    autoFraction: controls.autoFraction.checked,
                    matrixShortcuts: controls.matrixShortcuts.checked,
                    tabOut: controls.tabOut.checked,
                    visualSnippets: controls.visualSnippets.checked,
                    removeSnippetWhitespace: controls.removeSnippetWhitespace.checked,
                    suppressSnippetTriggerOnIME: controls.suppressSnippetTriggerOnIME.checked,
                    autoEnlargeBrackets: controls.autoEnlargeBrackets.checked,
                    tabOutExitOnlyAtEnd: controls.tabOutExitOnlyAtEnd.checked,
                    autoEnlargeBracketSpace: controls.autoEnlargeBracketSpace.checked,
                    snippetsSource: snippetsSource.value,
                    snippetVariablesSource: variablesSource.value,
                    snippetRecursion: recursion,
                    textMacros: parseTextMacros(fields.textMacros.value),
                    keybindings: parseKeybindings(JSON.stringify(Object.fromEntries(
                        Object.entries(keyFields).map(([key, field]) => [key, field.value]),
                    ))),
                    wordDelimiters: fields.wordDelimiters.value,
                    autoFractionSymbol: fields.autoFractionSymbol.value.trim() || "\\frac",
                    autoFractionBreakingChars: fields.autoFractionBreakingChars.value,
                    autoFractionExcludedEnvironments: parseExcludedEnvironments(fields.autoFractionExcludedEnvironments.value),
                    matrixEnvironments: parseList(fields.matrixEnvironments.value),
                    matrixMacros: parseList(fields.matrixMacros.value),
                    tabOutClosingSymbols: parseList(fields.tabOutClosingSymbols.value),
                    autoEnlargeBracketTriggers: parseList(fields.autoEnlargeBracketTriggers.value),
                };
                void saveSettings(next).then(() => showMessage(labels.saved)).catch((error) => {
                    console.warn("[Latex Suite] Failed to save settings", error);
                    showMessage(labels.saveFailed ?? "设置保存失败，仍使用上一次有效配置；请重试。", 7000, "error");
                });
            } catch (error) {
                showMessage(`${labels.invalidSnippets}: ${error instanceof Error ? error.message : String(error)}`, 7000, "error");
            }
        },
    });

    const addSwitch = (key: keyof typeof controls, title: string, description: string) => {
        setting.addItem({title, description, actionElement: controls[key]});
    };
    addSwitch("enabled", labels.enabled, labels.enabledDescription);
    addSwitch("autoSnippets", labels.autoSnippets, labels.autoSnippetsDescription);
    addSwitch("tabSnippets", labels.tabSnippets, labels.tabSnippetsDescription);
    addSwitch("autoFraction", labels.autoFraction, labels.autoFractionDescription);
    addSwitch("matrixShortcuts", labels.matrixShortcuts, labels.matrixShortcutsDescription);
    addSwitch("tabOut", labels.tabOut, labels.tabOutDescription);
    addSwitch("visualSnippets", labels.visualSnippets, labels.visualSnippetsDescription);
    addSwitch("removeSnippetWhitespace", "行级公式移除片段尾随空格", "与 Latex Suite 的 removeSnippetWhitespace 一致。");
    addSwitch("suppressSnippetTriggerOnIME", "输入法组合期间抑制片段", "组合期间暂停展开，上屏后执行一次自动片段。");
    addSwitch("autoEnlargeBrackets", "自动放大括号", "片段包含分数、求和、积分等命令时自动加入 \\left / \\right。");
    addSwitch("tabOutExitOnlyAtEnd", "仅在公式边界退出", "启用后，Tab 仅在末尾、Shift+Tab 仅在开头关闭面板；忽略边界空白。");
    addSwitch("autoEnlargeBracketSpace", "放大括号内侧留空格", "自动生成 \\left / \\right 时在括号内侧保留空格。");
    const addField = (key: keyof typeof fields, title: string, description: string) => {
        setting.addItem({title, description, actionElement: fields[key]});
    };
    addField("snippetRecursion", "Snippet 递归次数", "一次触发后继续执行自动 snippets 的最大次数；0 表示不递归。");
    addField("wordDelimiters", "单词分隔符", "用于 w 选项。支持字面量 \\n 与 \\t。");
    addField("autoFractionSymbol", "分数命令", "通常为 \\frac，也可改为其他双参数命令。");
    addField("autoFractionBreakingChars", "自动分数终止字符", "向左查找分子时遇到这些字符停止；支持 \\t。");
    addField("autoFractionExcludedEnvironments", "自动分数排除区域", "JSON 二元字符串数组，例如 [[\"^{\",\"}\"],[\"\\\\pu{\",\"}\"]]。");
    addField("matrixEnvironments", "矩阵环境", "用逗号分隔；这些环境内启用 Tab 换列和 Enter 换行。");
    addField("matrixMacros", "矩阵宏", "用逗号分隔，例如 eqalign。");
    addField("tabOutClosingSymbols", "Tab 可跳过的闭合符号", "用逗号分隔，例如 ), ], \\rangle。");
    addField("autoEnlargeBracketTriggers", "自动放大触发命令", "用逗号分隔，例如 \\frac, \\sum, \\int。");
    addField("textMacros", "文本宏与禁用片段区域", 'JSON 对象：{"text":["mytext"],"restricted":["operatorname"]}。字符串仅匹配首个参数；用 {"name":"foo","arguments":[1]} 指定参数，省略 arguments 匹配全部参数。');
    const shortcutTitles: Record<keyof Keybindings, string> = {
        snippetsTrigger: "展开手动片段",
        snippetNextTabstopTrigger: "下一个停靠点",
        snippetPreviousTabstopTrigger: "上一个停靠点",
        taboutTrigger: "向右跳出",
        reverseTaboutTrigger: "向左跳出",
        autofractionTrigger: "自动分数快捷键",
        matrixShortcutsCellTrigger: "矩阵换列",
        matrixShortcutsNewlineTrigger: "矩阵换行",
        matrixShortcutsExitTrigger: "矩阵下一行末尾 / 跳出",
    };
    for (const key of Object.keys(keyFields) as Array<keyof Keybindings>) {
        keyFields[key].setAttribute("aria-label", shortcutTitles[key]);
        setting.addItem({
            title: shortcutTitles[key],
            description: `默认 ${DEFAULT_KEYBINDINGS[key]}；支持 Ctrl-j、Mod-/ 等格式，留空禁用此动作。`,
            actionElement: keyFields[key],
        });
    }
    if (openSnippetReference) {
        const referenceButton = document.createElement("button");
        referenceButton.className = "b3-button b3-button--outline";
        referenceButton.textContent = "打开片段速查";
        referenceButton.addEventListener("click", openSnippetReference);
        setting.addItem({title: "片段速查", description: "搜索当前已保存片段的触发词、说明和模板，并查看模式及宏范围。", actionElement: referenceButton});
    }
    setting.addItem({
        title: "Snippets（Latex Suite JavaScript 格式）",
        description: "支持注释、RegExp、replacement 函数、${VISUAL}、triggerAfter、priority 与排除字段。此处是受信任代码配置。",
        // SiYuan's Setting API calls the vertically stacked layout "row".
        // Using "column" places the textarea beside the label and gives it
        // fn__flex-center/fn__size200, which creates a very tall blank area.
        direction: "row",
        createActionElement: () => snippetsSource,
    });
    setting.addItem({
        title: "Snippet 变量",
        description: "支持 ${GREEK}、${SYMBOL} 等触发器变量，格式与 Latex Suite 一致。",
        direction: "row",
        createActionElement: () => variablesSource,
    });

    const refresh = () => {
        const current = getSettings();
        for (const key of Object.keys(controls) as Array<keyof typeof controls>) controls[key].checked = current[key];
        snippetsSource.value = current.snippetsSource;
        variablesSource.value = current.snippetVariablesSource;
        fields.snippetRecursion.value = String(current.snippetRecursion);
        fields.wordDelimiters.value = current.wordDelimiters;
        fields.autoFractionSymbol.value = current.autoFractionSymbol;
        fields.autoFractionBreakingChars.value = current.autoFractionBreakingChars;
        fields.autoFractionExcludedEnvironments.value = JSON.stringify(current.autoFractionExcludedEnvironments);
        fields.matrixEnvironments.value = current.matrixEnvironments.join(", ");
        fields.matrixMacros.value = current.matrixMacros.join(", ");
        fields.tabOutClosingSymbols.value = current.tabOutClosingSymbols.join(", ");
        fields.autoEnlargeBracketTriggers.value = current.autoEnlargeBracketTriggers.join(", ");
        fields.textMacros.value = JSON.stringify(current.textMacros);
        for (const key of Object.keys(keyFields) as Array<keyof Keybindings>) keyFields[key].value = current.keybindings[key];
    };
    refresh();
    return {setting, refresh};
}
