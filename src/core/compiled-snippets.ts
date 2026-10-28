import type {SnippetDefinition} from "../types";

export interface CompiledSnippet {
    snippet: SnippetDefinition;
    trigger?: RegExp;
    triggerAfter?: RegExp;
    error?: unknown;
}

const rules = new WeakMap<SnippetDefinition, CompiledSnippet>();
const lists = new WeakMap<readonly SnippetDefinition[], readonly CompiledSnippet[]>();

function safeFlags(flags: string): string {
    return [...new Set(flags)].filter((flag) => "imsuv".includes(flag)).join("");
}

function compile(snippet: SnippetDefinition): CompiledSnippet {
    const cached = rules.get(snippet);
    if (cached) return cached;
    const result: CompiledSnippet = {snippet};
    try {
        if ((snippet.options ?? "").includes("r") || snippet.trigger instanceof RegExp) {
            const source = snippet.trigger instanceof RegExp ? snippet.trigger.source : snippet.trigger;
            const flags = `${snippet.trigger instanceof RegExp ? snippet.trigger.flags : ""}${snippet.flags ?? ""}`;
            result.trigger = new RegExp(`(?:${source})$`, safeFlags(flags));
        }
        if (snippet.triggerAfter instanceof RegExp) {
            result.triggerAfter = new RegExp(`^(?:${snippet.triggerAfter.source})`, safeFlags(`${snippet.triggerAfter.flags}${snippet.flags ?? ""}`));
        }
    } catch (error) {
        result.error = error;
    }
    rules.set(snippet, result);
    return result;
}

/** Parsed definitions are immutable for a configuration revision. New source yields new identities. */
export function prepareSnippets(snippets: readonly SnippetDefinition[]): readonly CompiledSnippet[] {
    const cached = lists.get(snippets);
    if (cached) return cached;
    const length = (trigger: string | RegExp) => typeof trigger === "string" ? trigger.length : trigger.source.length;
    const ordered = [...snippets].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0)
        || length(b.trigger) - length(a.trigger)).map(compile);
    lists.set(snippets, ordered);
    return ordered;
}
