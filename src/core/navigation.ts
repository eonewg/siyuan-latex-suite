const DEFAULT_MATRIX_ENVIRONMENTS = [
    "matrix", "pmatrix", "bmatrix", "Bmatrix", "vmatrix", "Vmatrix",
    "array", "aligned", "align", "align*", "cases", "gathered", "split",
];

function activeMacro(value: string, cursor: number, macroNames: readonly string[]): string | null {
    const source = value.slice(0, cursor);
    const pattern = /\\([A-Za-z]+)\s*\{/g;
    const candidates = [...source.matchAll(pattern)].reverse();
    for (const match of candidates) {
        const name = match[1];
        if (!name || !macroNames.includes(name)) continue;
        const start = (match.index ?? 0) + match[0].length;
        let depth = 1;
        for (let index = start; index < source.length; index += 1) {
            if (source[index] === "{" && source[index - 1] !== "\\") depth += 1;
            if (source[index] === "}" && source[index - 1] !== "\\") depth -= 1;
        }
        if (depth > 0) return name;
    }
    return null;
}

export function activeMatrixEnvironment(
    value: string,
    cursor: number,
    environmentNames: readonly string[] = DEFAULT_MATRIX_ENVIRONMENTS,
    macroNames: readonly string[] = [],
): string | null {
    const matrixEnvironments = new Set(environmentNames);
    const stack: string[] = [];
    const pattern = /\\(begin|end)\{([^}]+)}/g;
    for (const match of value.slice(0, cursor).matchAll(pattern)) {
        const action = match[1];
        const name = match[2];
        if (!name) continue;
        if (action === "begin") stack.push(name);
        else {
            const index = stack.lastIndexOf(name);
            if (index >= 0) stack.splice(index, 1);
        }
    }
    const active = stack.at(-1);
    if (active && matrixEnvironments.has(active)) return active;
    return activeMacro(value, cursor, macroNames);
}

const LEFT_COMMANDS = new Set(["\\left", "\\bigl", "\\Bigl", "\\biggl", "\\Biggl"]);
const RIGHT_COMMANDS = new Set(["\\right", "\\bigr", "\\Bigr", "\\biggr", "\\Biggr"]);
const OPEN_TO_CLOSE = new Map([
    ["(", ")"], ["[", "]"], ["{", "}"], ["\\{", "\\}"],
    ["\\lbrack", "\\rbrack"], ["\\lbrace", "\\rbrace"], ["\\langle", "\\rangle"],
    ["\\lvert", "\\rvert"], ["\\lVert", "\\rVert"], ["\\lfloor", "\\rfloor"],
    ["\\lceil", "\\rceil"], ["\\ulcorner", "\\urcorner"],
]);

interface Token {text: string; start: number; end: number;}

function tokenize(value: string): Token[] {
    const result: Token[] = [];
    const pattern = /\\[A-Za-z]+|\\.|[^\\]/gs;
    for (const match of value.matchAll(pattern)) {
        const start = match.index ?? 0;
        result.push({text: match[0], start, end: start + match[0].length});
    }
    return result;
}

export function nextClosingPosition(
    value: string,
    cursor: number,
    closingSymbols: ReadonlySet<string> = new Set([")", "]", "}", "\\rangle", "\\rvert"]),
): number | null {
    const tokens = tokenize(value.slice(cursor));
    const stack: string[] = [];
    for (let index = 0; index < tokens.length; index += 1) {
        const token = tokens[index]!;
        if (LEFT_COMMANDS.has(token.text)) {
            const delimiter = tokens[index + 1];
            if (delimiter) {
                const close = OPEN_TO_CLOSE.get(delimiter.text);
                if (close) stack.push(close);
                index += 1;
            }
            continue;
        }
        if (RIGHT_COMMANDS.has(token.text)) {
            const delimiter = tokens[index + 1];
            if (!delimiter) return cursor + token.end;
            if (stack.length > 0) stack.pop();
            else return cursor + delimiter.end;
            index += 1;
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
        if (stack.length === 0 && closingSymbols.has(token.text)) return cursor + token.end;
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
