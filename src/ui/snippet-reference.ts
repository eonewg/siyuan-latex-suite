import {DEFAULT_KEYBINDINGS} from "../core/keyboard";
import type {Keybindings, MacroArea, SnippetDefinition} from "../types";

export interface SnippetReferenceEntry {
    trigger: string;
    description: string;
    template: string;
    mode: string;
    activation: string;
    kind: "auto" | "manual" | "visual";
    scope: string;
}

function macroLabel(areas: readonly MacroArea[]): string {
    return areas.map((area) => `${area.name}(${area.arguments?.join(",") ?? "全部参数"})`).join("、");
}

/** Summarize configuration without executing dynamic replacements. */
export function snippetReferenceEntries(snippets: readonly SnippetDefinition[], keys: Keybindings = DEFAULT_KEYBINDINGS): SnippetReferenceEntry[] {
    return snippets.map((snippet) => {
        const options = snippet.options ?? "m";
        const visual = options.includes("v") || (typeof snippet.replacement === "string" && snippet.replacement.includes("${VISUAL}"));
        const kind = visual ? "visual" : options.includes("A") ? "auto" : "manual";
        const modes: string[] = [];
        if (options.includes("m") || (!/[mnMtTcC]/.test(options))) modes.push("行级 / 公式块");
        else {
            if (options.includes("n")) modes.push("行级");
            if (options.includes("M")) modes.push("公式块");
        }
        if (options.includes("T")) modes.push("文本宏内");
        if (options.includes("t")) modes.push("正文（仅 mk / dm 原生适配）");
        if (/[cC]/.test(options)) modes.push("代码模式（未适配）");
        const scope: string[] = [];
        if (snippet.includedMacros?.length) scope.push(`限定宏：${macroLabel(snippet.includedMacros)}`);
        if (snippet.excludedMacros?.length) scope.push(`排除宏：${macroLabel(snippet.excludedMacros)}`);
        if (snippet.excludedEnvironments?.length) scope.push(`排除环境：${snippet.excludedEnvironments.join("、")}`);
        if (snippet.triggerAfter !== undefined) scope.push(`光标后需匹配：${String(snippet.triggerAfter)}`);
        if (options.includes("w")) scope.push("单词边界");
        const activation = [kind === "visual" ? "选区片段" : kind === "auto" ? "自动展开"
            : snippet.triggerKey || keys.snippetsTrigger || "手动展开已禁用"];
        if (kind !== "manual" && snippet.triggerKey) activation.push(snippet.triggerKey);
        return {
            trigger: String(snippet.trigger) || "（无触发词）",
            description: snippet.description ?? "",
            template: typeof snippet.replacement === "string" ? snippet.replacement : "动态函数：输入时计算结果",
            mode: modes.join(" · "),
            activation: activation.join(" · "),
            kind,
            scope: scope.join("；"),
        };
    });
}

export function filterSnippetReference(entries: readonly SnippetReferenceEntry[], query: string, kind = "all"): SnippetReferenceEntry[] {
    const terms = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
    return entries.filter((entry) => {
        if (kind !== "all" && entry.kind !== kind) return false;
        const text = [entry.trigger, entry.description, entry.template, entry.mode, entry.activation, entry.scope].join(" ").toLocaleLowerCase();
        return terms.every((term) => text.includes(term));
    });
}

export function createSnippetReference(snippets: readonly SnippetDefinition[], keys: Keybindings): HTMLElement {
    const entries = snippetReferenceEntries(snippets, keys);
    const root = document.createElement("section");
    root.className = "latex-suite__reference";
    const search = document.createElement("input");
    search.type = "search";
    search.className = "b3-text-field";
    search.placeholder = "搜索触发词、说明、模板或宏范围";
    search.setAttribute("aria-label", "搜索片段");
    const filter = document.createElement("select");
    filter.className = "b3-select";
    filter.setAttribute("aria-label", "片段类型");
    for (const [value, label] of [["all", "全部类型"], ["auto", "自动展开"], ["manual", "手动展开"], ["visual", "选区片段"]]) {
        const option = document.createElement("option");
        option.value = value!;
        option.textContent = label!;
        filter.append(option);
    }
    const toolbar = document.createElement("div");
    toolbar.className = "latex-suite__reference-toolbar";
    toolbar.append(search, filter);
    const count = document.createElement("output");
    count.setAttribute("aria-live", "polite");
    const list = document.createElement("div");
    list.className = "latex-suite__reference-list";
    const hint = document.createElement("p");
    hint.className = "latex-suite__reference-meta";
    hint.textContent = "显示已保存的片段。T 表示文本宏内，m / n / M 表示公式范围；正文 mk / dm 使用思源原生公式。";
    root.append(toolbar, hint, count, list);

    const render = () => {
        const matches = filterSnippetReference(entries, search.value, filter.value);
        count.textContent = `${matches.length} / ${entries.length} 个片段`;
        const fragment = document.createDocumentFragment();
        for (const entry of matches) {
            const article = document.createElement("article");
            article.className = "latex-suite__reference-entry";
            const trigger = document.createElement("code");
            trigger.className = "latex-suite__reference-trigger";
            trigger.textContent = entry.trigger;
            const meta = document.createElement("div");
            meta.className = "latex-suite__reference-meta";
            meta.textContent = `${entry.activation} · ${entry.mode}`;
            const description = document.createElement("div");
            description.textContent = entry.description;
            const template = document.createElement("pre");
            template.textContent = entry.template;
            const scope = document.createElement("div");
            scope.className = "latex-suite__reference-meta";
            scope.textContent = entry.scope;
            article.append(trigger, meta, description, template, scope);
            fragment.append(article);
        }
        if (matches.length === 0) {
            const empty = document.createElement("p");
            empty.textContent = "没有匹配的片段。";
            fragment.append(empty);
        }
        list.replaceChildren(fragment);
    };
    search.addEventListener("input", render);
    filter.addEventListener("change", render);
    render();
    return root;
}
