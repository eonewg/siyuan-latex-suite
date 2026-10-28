import type {ActiveMacroArea, EditorMode, LatexScope, MacroArea, MathlessMacros, SnippetContext} from "../types";

const TEXT_MACROS: readonly MacroArea[] = [
    ...[
        "text", "textrm", "textup", "textit", "textbf", "textsf", "texttt", "textnormal",
        "clap", "textllap", "textrlap", "textclap", "hbox", "mbox", "fbox", "framebox",
    ].map((name) => ({name, arguments: [0]})),
    {name: "colorbox", arguments: [1]},
    {name: "fcolorbox", arguments: [2]},
];
const RESTRICTED_MACROS: readonly MacroArea[] = [
    ...["tag", "begin", "end", "unicode", "textcolor", "color", "colorbox", "style"]
        .map((name) => ({name, arguments: [0]})),
    {name: "mmlToken", arguments: [0, 1]},
    {name: "fcolorbox", arguments: [0, 1]},
];

export const DEFAULT_MATHLESS_MACROS: MathlessMacros = {
    text: [],
    restricted: [{name: "operatorname", arguments: [0]}],
};

export function matchesMacroArea(active: ActiveMacroArea, area: MacroArea): boolean {
    return active.name === area.name && (!area.arguments || area.arguments.includes(active.argument));
}

export function isMathInputContext(value: string, cursor: number, custom?: MathlessMacros): boolean {
    const context = createSnippetContext(value, cursor, "block", custom);
    return !context.textEnvironment && !context.snippetlessEnvironment;
}

interface BraceFrame {macro?: ActiveMacroArea; from: number;}

export function createSnippetContext(
    value: string,
    cursor: number,
    mode: EditorMode,
    custom: MathlessMacros = DEFAULT_MATHLESS_MACROS,
): SnippetContext {
    const environments: string[] = [];
    const environmentScopes: LatexScope[] = [];
    const braces: BraceFrame[] = [];
    const before = value.slice(0, cursor);
    let pendingMacro: ActiveMacroArea | undefined;
    let comment = false;

    for (let index = 0; index < before.length; index += 1) {
        const char = before[index];
        if (comment) {
            if (char === "\n") comment = false;
            continue;
        }
        if (char === "%") {
            comment = true;
            continue;
        }
        if (char === "\\") {
            const match = /^\\([A-Za-z]+\*?)/.exec(before.slice(index));
            if (match?.[1]) {
                const name = match[1];
                const tail = before.slice(index + match[0].length);
                const begin = /^\s*\{([^}]*)}/.exec(tail);
                if (name === "begin" && begin?.[1]) {
                    environments.push(begin[1]);
                    environmentScopes.push({kind: "environment", name: begin[1], from: index});
                }
                if (name === "end" && begin?.[1]) {
                    const envIndex = environments.lastIndexOf(begin[1]);
                    if (envIndex >= 0) {
                        environments.splice(envIndex, 1);
                        environmentScopes.splice(envIndex, 1);
                    }
                }
                pendingMacro = {name, argument: 0};
                index += match[0].length - 1;
            } else {
                // Escaped braces, percent signs and row separators are indivisible.
                pendingMacro = undefined;
                index += 1;
            }
            continue;
        }
        if (char === "[" && pendingMacro) {
            // Optional arguments do not change required brace argument indices.
            let depth = 1;
            while (++index < before.length && depth > 0) {
                if (before[index] === "\\") index += 1;
                else if (before[index] === "[") depth += 1;
                else if (before[index] === "]") depth -= 1;
            }
            index -= 1;
            continue;
        }
        if (char === "{") {
            braces.push({macro: pendingMacro, from: index});
            pendingMacro = undefined;
        } else if (char === "}") {
            const frame = braces.pop();
            pendingMacro = frame?.macro
                ? {name: frame.macro.name, argument: frame.macro.argument + 1}
                : undefined;
        } else if (char && !/\s/.test(char)) {
            pendingMacro = undefined;
        }
    }

    const macroAreas = braces.flatMap((frame) => frame.macro ? [frame.macro] : []);
    const textAreas = [...custom.text, ...TEXT_MACROS];
    const restrictedAreas = [...custom.restricted, ...RESTRICTED_MACROS];
    let kind: "text" | "restricted" | undefined;
    // The innermost matching region wins; nested environments retain outer scopes.
    for (const active of [...macroAreas].reverse()) {
        if (textAreas.some((area) => matchesMacroArea(active, area))) kind = "text";
        else if (restrictedAreas.some((area) => matchesMacroArea(active, area))) kind = "restricted";
        if (kind) break;
    }
    return {
        mode,
        textEnvironment: kind === "text",
        snippetlessEnvironment: comment || kind === "restricted",
        environments,
        macros: macroAreas.map((area) => area.name),
        macroAreas,
        scopes: [...environmentScopes, ...braces.flatMap((frame): LatexScope[] => frame.macro
            ? [{kind: "macro", name: frame.macro.name, from: frame.from}] : [])].sort((a, b) => a.from - b.from),
    };
}
