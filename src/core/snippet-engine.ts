import {renderTemplate} from "./template";
import {createSnippetContext, matchesMacroArea} from "./context";
import {prepareSnippets} from "./compiled-snippets";
import type {EditorMode, Expansion, MathlessMacros, SnippetContext, SnippetDefinition} from "../types";

type TriggerKind = "auto" | "tab";
export type SnippetErrorHandler = (snippet: SnippetDefinition, error: unknown) => void;
const FORMULA_START_BOUNDARY = "\u0000";

function isModeEligible(options: string, context: SnippetContext, included = false): boolean {
    if (context.snippetlessEnvironment && !included) return false;
    if (context.textEnvironment) return options.includes("T") && (!/[mnM]/.test(options)
        || options.includes("m") || options.includes(context.mode === "block" ? "M" : "n"));
    if (options.includes("T")) return false;
    if (options.includes("m")) return true;
    if (options.includes("M") && context.mode === "block") return true;
    if (options.includes("n") && context.mode === "inline") return true;
    const hasMode = /[tTmnMcC]/.test(options);
    return !hasMode;
}

function isWordBoundary(value: string, from: number, to: number, delimiters: string): boolean {
    const expanded = delimiters.replaceAll("\\n", "\n").replaceAll("\\t", "\t");
    const before = from <= 0 ? "" : value[from - 1] ?? "";
    const after = to >= value.length ? "" : value[to] ?? "";
    return (before === "" || expanded.includes(before)) && (after === "" || expanded.includes(after));
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

function matchRegexAtCursor(pattern: RegExp, before: string): RegExpExecArray | null {
    const direct = pattern.exec(before);
    if (direct) return direct;

    // Obsidian matches against the Markdown math span, so a formula at the beginning still has a
    // `$`-like character before it. SiYuan gives us only the formula body. A private sentinel makes
    // boundary-consuming snippets such as /([^\\])(sin)/ behave the same without leaking a `$`.
    const boundaryMatch = pattern.exec(FORMULA_START_BOUNDARY + before);
    if (!boundaryMatch || boundaryMatch.index > FORMULA_START_BOUNDARY.length) return null;
    return stripFormulaBoundary(boundaryMatch, before);
}

function visual(options: string, replacement: SnippetDefinition["replacement"]): boolean {
    return options.includes("v") || (typeof replacement === "string" && replacement.includes("${VISUAL}"));
}

function inExcludedScope(snippet: SnippetDefinition, context: SnippetContext): boolean {
    if (snippet.excludedEnvironments?.some((name) => context.environments.includes(name))) return true;
    if (snippet.excludedMacros?.some((area) => context.macroAreas.some((active) =>
        active.name === area.name && (!area.arguments || area.arguments.includes(active.argument))))) return true;
    const trigger = typeof snippet.trigger === "string" ? snippet.trigger : snippet.trigger.source;
    if (trigger === "([A-Za-z])(\\d)" && context.macroAreas.some((area) => area.argument === 0
        && (area.name === "ce" || area.name === "pu"))) return true;
    return trigger === "->" && context.macroAreas.some((area) => area.name === "ce" && area.argument === 0);
}

function isScopeEligible(snippet: SnippetDefinition, context: SnippetContext): boolean {
    const included = snippet.includedMacros;
    const active = context.macroAreas.at(-1);
    if (included?.length && (!active || !included.some((area) => matchesMacroArea(active, area)))) return false;
    return isModeEligible(snippet.options ?? "m", context, !!included?.length) && !inExcludedScope(snippet, context);
}

function replacementValue(
    replacement: SnippetDefinition["replacement"],
    argument: string | RegExpExecArray,
    onError: (error: unknown) => void,
): string | null {
    if (typeof replacement === "string") return replacement;
    const result = replacement(argument);
    if (result && typeof (result as PromiseLike<unknown>).then === "function") {
        void Promise.resolve(result).catch(onError);
        onError(new Error("Asynchronous snippet replacements are not supported"));
        return null;
    }
    return typeof result === "string" ? result : null;
}

export class SnippetEngine {
    private readonly failed = new WeakSet<SnippetDefinition>();

    constructor(private readonly onError: SnippetErrorHandler = (snippet, error) => {
        console.warn(`[Latex Suite] Skipped snippet ${String(snippet.trigger)}`, error);
    }) {}

    private quarantine(snippet: SnippetDefinition, error: unknown): void {
        if (this.failed.has(snippet)) return;
        this.failed.add(snippet);
        try { this.onError(snippet, error); } catch { /* Diagnostics must not interrupt editing. */ }
    }

    public find(
        value: string,
        cursor: number,
        mode: EditorMode,
        kind: TriggerKind,
        snippets: readonly SnippetDefinition[],
        wordDelimiters = "., +-\\n\\t:;!?\\/{}[]()=~$'\"|`<>*^%#@&",
        textMacros?: MathlessMacros,
    ): Expansion | null {
        const ordered = prepareSnippets(snippets);
        const context = createSnippetContext(value, cursor, mode, textMacros);
        const before = value.slice(0, cursor);
        for (const compiled of ordered) {
            const {snippet} = compiled;
            if (this.failed.has(snippet)) continue;
            const options = snippet.options ?? "m";
            if (visual(options, snippet.replacement) || !isScopeEligible(snippet, context)) continue;
            if (kind === "auto" && !options.includes("A")) continue;
            if (compiled.error) {this.quarantine(snippet, compiled.error); continue;}

            let from = -1;
            let captures: readonly string[] | undefined;
            let namedCaptures: Readonly<Record<string, string>> | undefined;
            let replacementArgument: string | RegExpExecArray;
            if (compiled.trigger) {
                const match = matchRegexAtCursor(compiled.trigger, before);
                if (!match || match.index < 0) continue;
                from = match.index;
                captures = match.slice(1);
                namedCaptures = match.groups;
                replacementArgument = match;
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
                    const match = compiled.triggerAfter!.exec(after);
                    if (!match) continue;
                    to += match[0].length;
                } else {
                    if (!after.startsWith(snippet.triggerAfter)) continue;
                    to += snippet.triggerAfter.length;
                }
            }
            if (options.includes("w") && !isWordBoundary(value, from, to, wordDelimiters)) continue;

            let replacement: string | null;
            try { replacement = replacementValue(snippet.replacement, replacementArgument!, (error) => this.quarantine(snippet, error)); }
            catch (error) { this.quarantine(snippet, error); continue; }
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
        textMacros?: MathlessMacros,
    ): Expansion | null {
        const context = createSnippetContext(contextValue, contextCursor, mode, textMacros);
        for (const compiled of prepareSnippets(snippets)) {
            const {snippet} = compiled;
            if (this.failed.has(snippet) || !visual(snippet.options ?? "", snippet.replacement)
                || snippet.trigger !== key || !isScopeEligible(snippet, context)) continue;
            if (compiled.error) {this.quarantine(snippet, compiled.error); continue;}
            let replacement: string | null;
            try { replacement = replacementValue(snippet.replacement, selection, (error) => this.quarantine(snippet, error)); }
            catch (error) { this.quarantine(snippet, error); continue; }
            if (replacement === null) continue;
            const rendered = renderTemplate(replacement.replaceAll("${VISUAL}", "[[selection]]"), {selection});
            return {from, to, text: rendered.text, tabstops: rendered.tabstops, description: snippet.description};
        }
        return null;
    }
}
