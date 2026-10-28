import type {MacroArea, MathlessMacros, SnippetDefinition} from "../types";
import {prepareSnippets} from "./compiled-snippets";

type RawRecord = Record<string, unknown>;

let cachedSource = "";
let cachedVariablesSource = "";
let cachedSnippets: readonly SnippetDefinition[] = [];

function evaluateSource(source: string, label: string): unknown {
    try {
        // LaTeX Suite intentionally treats this setting as trusted JavaScript so
        // users can use comments, RegExp literals, and replacement functions.
        const expression = source.replace(
            /^(\s*(?:(?:\/\/[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)\s*)*)export\s+default\s+/,
            "$1",
        ).replace(/;\s*$/, "");
        return Function(`"use strict"; return (${expression}\n);`)();
    } catch (error) {
        throw new Error(`${label}: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export function parseSnippetVariables(source: string): Record<string, string> {
    const raw = evaluateSource(source || "{}", "Invalid snippet variables");
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        throw new Error("Snippet variables must be an object");
    }
    const result: Record<string, string> = {};
    for (const [rawName, rawValue] of Object.entries(raw as RawRecord)) {
        if (typeof rawValue !== "string") throw new Error(`Snippet variable ${rawName} must be a string`);
        const name = rawName.startsWith("${") ? rawName : `\${${rawName}}`;
        if (!name.endsWith("}")) throw new Error(`Invalid snippet variable name: ${rawName}`);
        result[name] = rawValue;
    }
    return result;
}

function insertVariables(value: string, variables: Readonly<Record<string, string>>): string {
    let result = value;
    for (const [name, replacement] of Object.entries(variables)) result = result.replaceAll(name, replacement);
    return result;
}

function normalizeMacroArea(value: unknown, index: number): MacroArea {
    if (typeof value === "string") return {name: value, arguments: [0]};
    if (!value || typeof value !== "object" || typeof (value as RawRecord).name !== "string") {
        throw new Error(`Snippet ${index + 1} has an invalid excludedMacros entry`);
    }
    const record = value as RawRecord;
    if (record.arguments !== undefined && (!Array.isArray(record.arguments)
        || record.arguments.some((item) => !Number.isInteger(item) || (item as number) < 0))) {
        throw new Error(`Macro ${record.name} arguments must be non-negative integers`);
    }
    return {
        name: record.name as string,
        arguments: Array.isArray(record.arguments)
            ? record.arguments.filter((item): item is number => typeof item === "number")
            : undefined,
    };
}

export function parseTextMacros(source: string): MathlessMacros {
    const raw = JSON.parse(source) as unknown;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Text macros must be an object");
    const record = raw as RawRecord;
    const parseAreas = (key: string): MacroArea[] => {
        const entries = record[key] ?? [];
        if (!Array.isArray(entries)) throw new Error(`${key} must be an array`);
        return entries.map((entry, index) => normalizeMacroArea(entry, index));
    };
    return {text: parseAreas("text"), restricted: parseAreas("restricted")};
}

function normalizeSnippet(raw: unknown, index: number, variables: Readonly<Record<string, string>>): SnippetDefinition {
    if (!raw || typeof raw !== "object") throw new Error(`Snippet ${index + 1} must be an object`);
    const item = raw as RawRecord;
    if (!(typeof item.trigger === "string" || item.trigger instanceof RegExp)
        && !(item.trigger === undefined && typeof item.triggerKey === "string" && item.triggerKey.trim())) {
        throw new Error(`Snippet ${index + 1} requires a string or RegExp trigger`);
    }
    if (!(typeof item.replacement === "string" || typeof item.replacement === "function")) {
        throw new Error(`Snippet ${index + 1} requires a string or function replacement`);
    }
    if (typeof item.options !== "string") throw new Error(`Snippet ${index + 1} requires string options`);

    const rawTrigger = item.trigger ?? "";
    const trigger = typeof rawTrigger === "string"
        ? insertVariables(rawTrigger, variables)
        : new RegExp(insertVariables((rawTrigger as RegExp).source, variables), (rawTrigger as RegExp).flags);
    let triggerAfter: string | RegExp | undefined;
    if (typeof item.triggerAfter === "string") triggerAfter = insertVariables(item.triggerAfter, variables);
    else if (item.triggerAfter instanceof RegExp) {
        triggerAfter = new RegExp(insertVariables(item.triggerAfter.source, variables), item.triggerAfter.flags);
    } else if (item.triggerAfter !== undefined) {
        throw new Error(`Snippet ${index + 1} has an invalid triggerAfter`);
    }

    return {
        trigger,
        triggerAfter,
        replacement: item.replacement as SnippetDefinition["replacement"],
        options: item.options,
        priority: typeof item.priority === "number" ? item.priority : 0,
        description: typeof item.description === "string" ? item.description : undefined,
        flags: typeof item.flags === "string" ? item.flags : undefined,
        triggerKey: typeof item.triggerKey === "string" ? item.triggerKey : undefined,
        language: typeof item.language === "string" ? item.language : undefined,
        excludedMacros: Array.isArray(item.excludedMacros)
            ? item.excludedMacros.map((entry) => normalizeMacroArea(entry, index))
            : [],
        includedMacros: Array.isArray(item.includedMacros)
            ? item.includedMacros.map((entry) => normalizeMacroArea(entry, index))
            : [],
        excludedEnvironments: Array.isArray(item.excludedEnvironments)
            ? item.excludedEnvironments.filter((entry): entry is string => typeof entry === "string")
            : [],
    };
}

export function parseSnippets(source: string, variablesSource: string, options: {validateRegex?: boolean} = {}): readonly SnippetDefinition[] {
    const variables = parseSnippetVariables(variablesSource);
    const raw = evaluateSource(source || "[]", "Invalid snippets");
    if (!Array.isArray(raw)) throw new Error("Snippets must be an array");
    const snippets = raw.flat(Infinity).map((item, index) => normalizeSnippet(item, index, variables));
    if (options.validateRegex !== false) {
        for (const compiled of prepareSnippets(snippets)) {
            if (compiled.error) throw new Error(`Invalid regex in snippet ${String(compiled.snippet.trigger)}: ${String(compiled.error)}`);
        }
    }
    return snippets;
}

export function getCompiledSnippets(source: string, variablesSource: string): readonly SnippetDefinition[] {
    if (source === cachedSource && variablesSource === cachedVariablesSource) return cachedSnippets;
    // Legacy configurations may contain invalid string regexes that were
    // previously ignored. Keep healthy rules available; the engine reports
    // and quarantines the bad rule. New saves use strict validation above.
    cachedSnippets = parseSnippets(source, variablesSource, {validateRegex: false});
    cachedSource = source;
    cachedVariablesSource = variablesSource;
    return cachedSnippets;
}
