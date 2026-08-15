import {renderTemplate} from "./template";
import type {Expansion, LatexSuiteSettings} from "../types";

const PAIRS: Record<string, string> = {")": "(", "]": "[", "}": "{"};

function matchingOpen(value: string, closeIndex: number): number {
    const close = value[closeIndex];
    const open = close ? PAIRS[close] : undefined;
    if (!open) return -1;
    let depth = 0;
    for (let index = closeIndex; index >= 0; index -= 1) {
        if (value[index] === close) depth += 1;
        if (value[index] === open) {
            depth -= 1;
            if (depth === 0) return index;
        }
    }
    return -1;
}

export function findNumeratorStart(value: string, end: number, breakingChars = "+-=\\t"): number {
    if (end <= 0) return -1;
    const last = value[end - 1];
    const breaks = new Set(` $([{\n${breakingChars.replaceAll("\\t", "\t").replaceAll("\\n", "\n")}`);
    if (!last || breaks.has(last) || /[,;&/]/.test(last)) return -1;
    if (last in PAIRS) {
        let start = matchingOpen(value, end - 1);
        if (start < 0) return -1;
        if (value[start] === "{" && start > 0 && /[_^]/.test(value[start - 1] ?? "")) {
            const baseStart = findNumeratorStart(value, start - 1, breakingChars);
            if (baseStart >= 0) start = baseStart;
        }
        return start;
    }
    let start = end - 1;
    while (start > 0 && /[A-Za-z0-9.]/.test(value[start - 1] ?? "")) start -= 1;
    if (start > 0 && value[start - 1] === "\\") start -= 1;
    if (start > 0 && /[_^]/.test(value[start - 1] ?? "")) {
        const baseStart = findNumeratorStart(value, start - 1, breakingChars);
        if (baseStart >= 0) start = baseStart;
    }
    return start;
}

function isInsideExcludedArea(value: string, cursor: number, areas: readonly (readonly [string, string])[]): boolean {
    for (const [open, close] of areas) {
        const start = value.lastIndexOf(open, cursor - 1);
        if (start < 0) continue;
        const end = value.indexOf(close, start + open.length);
        if (end < 0 || end >= cursor) return true;
    }
    return false;
}

function stripOuterParentheses(value: string): string {
    if (!value.startsWith("(") || !value.endsWith(")")) return value;
    return matchingOpen(value, value.length - 1) === 0 ? value.slice(1, -1) : value;
}

export function createAutoFraction(
    value: string,
    cursor: number,
    settings?: Pick<LatexSuiteSettings, "autoFractionSymbol" | "autoFractionBreakingChars" | "autoFractionExcludedEnvironments">,
): Expansion | null {
    const slash = cursor - 1;
    if (slash < 0 || value[slash] !== "/") return null;
    const symbol = settings?.autoFractionSymbol ?? "\\frac";
    const breakingChars = settings?.autoFractionBreakingChars ?? "+-=\\t";
    const excluded = settings?.autoFractionExcludedEnvironments ?? [["^{", "}"], ["\\pu{", "}"]];
    if (isInsideExcludedArea(value, slash, excluded)) return null;
    const from = findNumeratorStart(value, slash, breakingChars);
    if (from < 0) return null;
    const numerator = stripOuterParentheses(value.slice(from, slash));
    const rendered = renderTemplate(`${symbol}{${numerator}}{$1}$2`);
    return {from, to: cursor, text: rendered.text, tabstops: rendered.tabstops, description: "Auto fraction"};
}

export function createSelectionFraction(selection: string, from: number, to: number, symbol = "\\frac"): Expansion | null {
    if (!selection) return null;
    const rendered = renderTemplate(`${symbol}{${stripOuterParentheses(selection)}}{$1}$2`);
    return {from, to, text: rendered.text, tabstops: rendered.tabstops, description: "Selection fraction"};
}
