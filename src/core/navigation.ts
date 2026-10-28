import {createSnippetContext} from "./context";
import type {LatexScope, LatexSuiteSettings} from "../types";

export const DEFAULT_MATRIX_ENVIRONMENTS = [
    "matrix", "pmatrix", "bmatrix", "Bmatrix", "vmatrix", "Vmatrix",
    "array", "aligned", "align", "align*", "cases", "gathered", "split",
];

export interface MatrixScope extends LatexScope {to: number; contentTo: number;}

export function activeMatrixScope(
    value: string,
    cursor: number,
    settings: Pick<LatexSuiteSettings, "matrixEnvironments" | "matrixMacros"> & Partial<Pick<LatexSuiteSettings, "textMacros">>,
): MatrixScope | null {
    const context = createSnippetContext(value, cursor, "block", settings.textMacros);
    if (context.textEnvironment || context.snippetlessEnvironment) return null;
    const active = context.scopes.at(-1);
    if (!active || !(active.kind === "environment" ? settings.matrixEnvironments : settings.matrixMacros).includes(active.name)) return null;
    let depth = 0;
    for (const token of tokenize(value)) {
        if (token.start < active.from) continue;
        if (active.kind === "macro") {
            if (token.text === "{") depth += 1;
            if (token.text === "}" && --depth === 0) return {...active, to: token.end, contentTo: token.start};
        } else if (token.text === "\\begin" || token.text === "\\end") {
            const match = /^\\(begin|end)\s*\{([^}]*)}/.exec(value.slice(token.start));
            if (match?.[2] !== active.name) continue;
            depth += token.text === "\\begin" ? 1 : -1;
            if (depth === 0) return {...active, to: token.start + match![0].length, contentTo: token.start};
        }
    }
    return {...active, to: value.length, contentTo: value.length};
}

export function activeMatrixEnvironment(
    value: string,
    cursor: number,
    environmentNames: readonly string[] = DEFAULT_MATRIX_ENVIRONMENTS,
    macroNames: readonly string[] = [],
): string | null {
    return activeMatrixScope(value, cursor, {matrixEnvironments: [...environmentNames], matrixMacros: [...macroNames]})?.name ?? null;
}

export function matrixCellClosingPosition(value: string, cursor: number, scope: MatrixScope, symbols: ReadonlySet<string>): number | null {
    let end = scope.contentTo;
    for (const token of tokenize(value)) {
        if (token.start < cursor) continue;
        if (token.text === "&" || token.text === "\\\\" || token.text === "\n") {
            end = Math.min(end, token.start);
            break;
        }
    }
    const closing = nextClosingPosition(value.slice(cursor, end), 0, symbols);
    return closing === null ? null : cursor + closing;
}

export function matrixNewlineText(value: string, cursor: number, scope: MatrixScope): string {
    const separator = value.slice(scope.from, scope.to).includes("\n") ? "\n" : "  ";
    return " \\\\" + separator + currentMatrixLinePrefix(value, cursor);
}

export function matrixExitPosition(value: string, cursor: number, scope: MatrixScope): number {
    if (!value.slice(scope.from, scope.to).includes("\n")) return scope.to;
    const nextStart = value.indexOf("\n", cursor);
    if (nextStart < 0 || nextStart >= scope.contentTo) return scope.to;
    const nextEnd = nextLineEnd(value, cursor);
    return Math.min(nextEnd, scope.to);
}

const LEFT_COMMANDS = new Set(["\\left", "\\bigl", "\\Bigl", "\\biggl", "\\Biggl"]);
const RIGHT_COMMANDS = new Set(["\\right", "\\bigr", "\\Bigr", "\\biggr", "\\Biggr"]);
const OPEN_TO_CLOSE = new Map([
    ["(", ")"], ["[", "]"], ["{", "}"], ["\\{", "\\}"],
    ["\\lbrack", "\\rbrack"], ["\\lbrace", "\\rbrace"], ["\\langle", "\\rangle"],
    ["\\lvert", "\\rvert"], ["\\lVert", "\\rVert"], ["\\lfloor", "\\rfloor"],
    ["\\lceil", "\\rceil"], ["\\ulcorner", "\\urcorner"],
    ["<", ">"],
]);
const SIZED_DELIMITERS = new Set([
    ...OPEN_TO_CLOSE.keys(), ...OPEN_TO_CLOSE.values(), ".", "|", "\\vert", "\\Vert", "\\|",
    "/", "\\\\", "\\backslash", "\\uparrow", "\\downarrow", "\\Uparrow", "\\Downarrow", "\\lt", "\\gt",
]);

interface Token {text: string; start: number; end: number;}

function tokenize(value: string): Token[] {
    const result: Token[] = [];
    const pattern = /\\[A-Za-z]+|\\.|%[^\n]*|[^\\]/gs;
    for (const match of value.matchAll(pattern)) {
        if (match[0].startsWith("%")) continue;
        const start = match.index ?? 0;
        result.push({text: match[0], start, end: start + match[0].length});
    }
    return result;
}

/** Shift+Tab moves before the nearest opening delimiter, including its sizing command. */
export function previousOpeningPosition(value: string, cursor: number): number | null {
    const tokens = tokenize(value);
    for (let index = tokens.length - 1; index >= 0; index -= 1) {
        const token = tokens[index]!;
        if (token.start >= cursor) continue;
        if (LEFT_COMMANDS.has(token.text)) return token.start;
        if (!OPEN_TO_CLOSE.has(token.text)) continue;
        let previous = index - 1;
        while (previous >= 0 && /^\s+$/.test(tokens[previous]!.text)) previous -= 1;
        const sizing = tokens[previous];
        return sizing && LEFT_COMMANDS.has(sizing.text) ? sizing.start : token.start;
    }
    return null;
}

export function nextClosingPosition(
    value: string,
    cursor: number,
    closingSymbols: ReadonlySet<string> = new Set([")", "]", "}", "\\rangle", "\\rvert"]),
): number | null {
    const tokens = tokenize(value);
    const stack: string[] = [];
    for (let index = 0; index < tokens.length; index += 1) {
        const token = tokens[index]!;
        if (token.end <= cursor) continue;
        if (LEFT_COMMANDS.has(token.text)) {
            let next = index + 1;
            while (next < tokens.length && /^\s+$/.test(tokens[next]!.text)) next += 1;
            const delimiter = tokens[next];
            if (delimiter && SIZED_DELIMITERS.has(delimiter.text)) {
                const close = OPEN_TO_CLOSE.get(delimiter.text);
                if (close) stack.push(close);
                index = next;
            }
            continue;
        }
        if (RIGHT_COMMANDS.has(token.text)) {
            let next = index + 1;
            while (next < tokens.length && /^\s+$/.test(tokens[next]!.text)) next += 1;
            const delimiter = tokens[next];
            if (!delimiter || !SIZED_DELIMITERS.has(delimiter.text)) return token.end;
            if (stack.length > 0) stack.pop();
            else return delimiter.end;
            index = next;
            continue;
        }
        const expected = OPEN_TO_CLOSE.get(token.text);
        if (expected) {
            stack.push(expected);
            continue;
        }
        if (stack.at(-1) === token.text) {
            stack.pop();
            continue;
        }
        if (stack.length === 0 && closingSymbols.has(token.text)) return token.end;
    }
    return null;
}

export function nextLineEnd(value: string, cursor: number): number {
    const currentEnd = value.indexOf("\n", cursor);
    if (currentEnd < 0) return value.length;
    const nextEnd = value.indexOf("\n", currentEnd + 1);
    return nextEnd < 0 ? value.length : nextEnd;
}

export function currentLineIndent(value: string, cursor: number): string {
    const lineStart = value.lastIndexOf("\n", cursor - 1) + 1;
    return /^\s*/.exec(value.slice(lineStart, cursor))?.[0] ?? "";
}

/** Preserves indentation and any leading empty matrix cells on a newly inserted row. */
export function currentMatrixLinePrefix(value: string, cursor: number): string {
    const lineStart = value.lastIndexOf("\n", cursor - 1) + 1;
    const line = value.slice(lineStart, cursor);
    const indent = /^\s*/.exec(line)?.[0] ?? "";
    const cells = /(?:\\begin\{[^}]*}|\\\\|^)((?:\s|&)+)/.exec(line)?.[1]?.trimStart() ?? "";
    return indent + cells;
}
