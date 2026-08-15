import {Setting, showMessage, type Plugin} from "siyuan";
import {BUNDLED_SNIPPETS_SOURCE, BUNDLED_SNIPPET_VARIABLES_SOURCE} from "./bundled-snippets-source";
import {parseSnippets} from "./core/snippet-parser";
import type {LatexSuiteSettings} from "./types";

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
    wordDelimiters: "., +-\\n\\t:;!?\\/{}[]()=~$'\"|`<>*^%#@&",
    autoFractionSymbol: "\\frac",
    autoFractionBreakingChars: "+-=\\t",
    autoFractionExcludedEnvironments: [["^{", "}"], ["\\pu{", "}"]],
    matrixEnvironments: ["pmatrix", "cases", "align", "gather", "bmatrix", "Bmatrix", "vmatrix", "Vmatrix", "array", "matrix"],
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
    };
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
                    wordDelimiters: fields.wordDelimiters.value,
                    autoFractionSymbol: fields.autoFractionSymbol.value.trim() || "\\frac",
                    autoFractionBreakingChars: fields.autoFractionBreakingChars.value,
                    autoFractionExcludedEnvironments: parseExcludedEnvironments(fields.autoFractionExcludedEnvironments.value),
                    matrixEnvironments: parseList(fields.matrixEnvironments.value),
                    matrixMacros: parseList(fields.matrixMacros.value),
                    tabOutClosingSymbols: parseList(fields.tabOutClosingSymbols.value),
                    autoEnlargeBracketTriggers: parseList(fields.autoEnlargeBracketTriggers.value),
                };
                void saveSettings(next).then(() => showMessage(labels.saved));
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
    addSwitch("suppressSnippetTriggerOnIME", "输入法组合期间抑制片段", "避免中文输入法尚未上屏时误触发自动片段。");
    addSwitch("autoEnlargeBrackets", "自动放大括号", "片段包含分数、求和、积分等命令时自动加入 \\left / \\right。");
    addSwitch("tabOutExitOnlyAtEnd", "仅在公式末尾退出", "启用后，Tab 只有在光标位于公式末尾时才关闭公式输入面板。");
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
    };
    refresh();
    return {setting, refresh};
}
