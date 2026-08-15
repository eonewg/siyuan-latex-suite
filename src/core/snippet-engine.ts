import {renderTemplate} from "./template";
import {createSnippetContext} from "./context";
import type {EditorMode, Expansion, SnippetContext, SnippetDefinition} from "../types";

type TriggerKind = "auto" | "tab";
const FORMULA_START_BOUNDARY = "\u0000";

function isModeEligible(options: string, context: SnippetContext): boolean {
    if (context.snippetlessEnvironment) return false;
    if (context.textEnvironment) return options.includes("t");
    if (options.includes("m")) return true;
    if (options.includes("M") && context.mode === "block") return true;
    if (options.includes("n") && context.mode === "inline") return true;
    const hasMode = /[tmnMcC]/.test(options);
    return !hasMode;
}

function isWordBoundary(value: string, from: number, to: number, delimiters: string): boolean {
    const expanded = delimiters.replaceAll("\\n", "\n").replaceAll("\\t", "\t");
    const before = from <= 0 ? "" : value[from - 1] ?? "";
    const after = to >= value.length ? "" : value[to] ?? "";
    return (before === "" || expanded.includes(before)) && (after === "" || expanded.includes(after));
}

function safeFlags(flags = ""): string {
    return [...new Set(flags)].filter((flag) => "imsuv".includes(flag)).join("");
}

function stripFormulaBoundary(match: RegExpExecArray, before: string): RegExpExecArray {
    const clean = (value: string | undefined): string | undefined =>
        typeof value === "string" ? value.replaceAll(FORMULA_START_BOUNDARY, "") : value;
    const adjusted = match.map((value) => clean(value)) as RegExpExecArray;
    adjusted.index = Math.max(0, match.index - FORMULA_START_BOUNDARY.length);
    adjusted.input = before;
    if (match.groups) {
        adjusted.groups = Object.fromEntries(Object.entries(match.groups).map(([name, value]) => [
            name,
            typeof value === "string" ? value.replaceAll(FORMULA_START_BOUNDARY, "") : "",
        ]));
    }
    return adjusted;
}

function matchRegexAtCursor(source: string, flags: string, before: string): RegExpExecArray | null {
    const pattern = new RegExp(`(?:${source})$`, safeFlags(flags));
    const direct = pattern.exec(before);
    if (direct) return direct;

    // Obsidian matches against the Markdown math span, so a formula at the beginning still has a
    // `$`-like character before it. SiYuan gives us only the formula body. A private sentinel makes
    // boundary-consuming snippets such as /([^\\])(sin)/ behave the same without leaking a `$`.
    const boundaryMatch = pattern.exec(FORMULA_START_BOUNDARY + before);
    if (!boundaryMatch || boundaryMatch.index > FORMULA_START_BOUNDARY.length) return null;
    return stripFormulaBoundary(boundaryMatch, before);
}

function triggerLength(trigger: string | RegExp): number {
    return typeof trigger === "string" ? trigger.length : trigger.source.length;
}

function visual(options: string, replacement: SnippetDefinition["replacement"]): boolean {
    return options.includes("v") || (typeof replacement === "string" && replacement.includes("${VISUAL}"));
}

function inExcludedScope(snippet: SnippetDefinition, context: SnippetContext): boolean {
    if (snippet.excludedEnvironments?.some((name) => context.environments.includes(name))) return true;
    if (snippet.excludedMacros?.some((area) => context.macroAreas.some((active) =>
        active.name === area.name && (!area.arguments || area.arguments.includes(active.argument))))) return true;
    const trigger = typeof snippet.trigger === "string" ? snippet.trigger : snippet.trigger.source;
    if (trigger === "([A-Za-z])(\\d)" && context.macros.some((name) => name === "ce" || name === "pu")) return true;
    return trigger === "->" && context.macros.includes("ce");
}

function replacementValue(
    replacement: SnippetDefinition["replacement"],
    argument: string | RegExpExecArray,
): string | null {
    if (typeof replacement === "string") return replacement;
    const result = replacement(argument);
    return typeof result === "string" ? result : null;
}

export class SnippetEngine {
    public find(
        value: string,
        cursor: number,
        mode: EditorMode,
        kind: TriggerKind,
        snippets: readonly SnippetDefinition[],
        wordDelimiters = "., +-\\n\\t:;!?\\/{}[]()=~$'\"|`<>*^%#@&",
    ): Expansion | null {
        const ordered = [...snippets].sort((a, b) =>
            (b.priority ?? 0) - (a.priority ?? 0) || triggerLength(b.trigger) - triggerLength(a.trigger),
        );
        const context = createSnippetContext(value, cursor, mode);
        for (const snippet of ordered) {
            const options = snippet.options ?? "m";
            if (visual(options, snippet.replacement) || !isModeEligible(options, context)) continue;
            if (kind === "auto" && !options.includes("A")) continue;
            if (inExcludedScope(snippet, context)) continue;

            const before = value.slice(0, cursor);
            let from = -1;
            let captures: readonly string[] | undefined;
            let namedCaptures: Readonly<Record<string, string>> | undefined;
            let replacementArgument: string | RegExpExecArray;
            const regexTrigger = options.includes("r") || snippet.trigger instanceof RegExp;
            if (regexTrigger) {
                try {
                    const source = snippet.trigger instanceof RegExp ? snippet.trigger.source : snippet.trigger;
                    const flags = `${snippet.trigger instanceof RegExp ? snippet.trigger.flags : ""}${snippet.flags ?? ""}`;
                    const match = matchRegexAtCursor(source, flags, before);
                    if (!match || match.index < 0) continue;
                    from = match.index;
                    captures = match.slice(1);
                    namedCaptures = match.groups;
                    replacementArgument = match;
                } catch {
                    continue;
                }
            } else {
                const trigger = String(snippet.trigger);
                if (!before.endsWith(trigger)) continue;
                from = cursor - trigger.length;
                replacementArgument = trigger;
            }
            let to = cursor;
            if (snippet.triggerAfter !== undefined) {
                const after = value.slice(cursor);
                if (snippet.triggerAfter instanceof RegExp) {
                    const flags = `${snippet.triggerAfter.flags}${snippet.flags ?? ""}`;
                    const match = new RegExp(`^(?:${snippet.triggerAfter.source})`, safeFlags(flags)).exec(after);
                    if (!match) continue;
                    to += match[0].length;
                } else {
                    if (!after.startsWith(snippet.triggerAfter)) continue;
                    to += snippet.triggerAfter.length;
                }
            }
            if (options.includes("w") && !isWordBoundary(value, from, to, wordDelimiters)) continue;

            const replacement = replacementValue(snippet.replacement, replacementArgument!);
            if (replacement === null) continue;
            const rendered = renderTemplate(replacement, {captures, namedCaptures});
            return {
                from,
                to,
                text: rendered.text,
                tabstops: rendered.tabstops,
                description: snippet.description,
            };
        }
        return null;
    }

    public findVisual(
        key: string,
        selection: string,
        from: number,
        to: number,
        mode: EditorMode,
        snippets: readonly SnippetDefinition[],
        contextValue = selection,
        contextCursor = contextValue.length,
    ): Expansion | null {
        const context = createSnippetContext(contextValue, contextCursor, mode);
        const snippet = [...snippets]
            .filter((item) => visual(item.options ?? "", item.replacement))
            .filter((item) => item.trigger === key
                && isModeEligible(item.options ?? "", context)
                && !inExcludedScope(item, context))
            .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || triggerLength(b.trigger) - triggerLength(a.trigger))[0];
        if (!snippet) return null;
        const replacement = replacementValue(snippet.replacement, selection);
        if (replacement === null) return null;
        const rendered = renderTemplate(replacement.replaceAll("${VISUAL}", "[[selection]]"), {selection});
        return {from, to, text: rendered.text, tabstops: rendered.tabstops, description: snippet.description};
    }
}
