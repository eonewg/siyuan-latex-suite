import type {EditorMode, SnippetContext} from "../types";

const TEXT_MACROS = new Set([
    "text", "textrm", "textup", "textit", "textbf", "textsf", "texttt", "textnormal",
    "clap", "textllap", "textrlap", "textclap", "hbox", "mbox", "fbox", "framebox",
]);
const SNIPPETLESS_MACROS = new Set([
    "tag", "begin", "end", "mmlToken", "unicode", "textcolor", "color", "colorbox", "fcolorbox",
]);

interface PendingMacro {name: string; argument: number;}
interface BraceFrame { macro?: PendingMacro; }

export function createSnippetContext(value: string, cursor: number, mode: EditorMode): SnippetContext {
    const environments: string[] = [];
    const braces: BraceFrame[] = [];
    const macros: string[] = [];
    const macroAreas: Array<{name: string; argument: number}> = [];
    const before = value.slice(0, cursor);
    let pendingMacro: PendingMacro | undefined;

    for (let index = 0; index < before.length; index += 1) {
        const char = before[index];
        if (char === "\\") {
            const match = /^\\([A-Za-z]+\*?)/.exec(before.slice(index));
            if (match?.[1]) {
                const name = match[1];
                const tail = before.slice(index + match[0].length);
                const begin = /^\s*\{([^}]*)}/.exec(tail);
                if (name === "begin" && begin?.[1]) environments.push(begin[1]);
                if (name === "end" && begin?.[1]) {
                    const envIndex = environments.lastIndexOf(begin[1]);
                    if (envIndex >= 0) environments.splice(envIndex, 1);
                }
                pendingMacro = {name, argument: 0};
                index += match[0].length - 1;
                continue;
            }
        }
        if (char === "{") {
            braces.push({macro: pendingMacro});
            if (pendingMacro) {
                macros.push(pendingMacro.name);
                macroAreas.push({...pendingMacro});
            }
            pendingMacro = undefined;
        } else if (char === "}") {
            const frame = braces.pop();
            if (frame?.macro) {
                const macroIndex = macros.lastIndexOf(frame.macro.name);
                if (macroIndex >= 0) macros.splice(macroIndex, 1);
                let areaIndex = -1;
                for (let index = macroAreas.length - 1; index >= 0; index -= 1) {
                    const area = macroAreas[index];
                    if (area?.name === frame.macro.name && area.argument === frame.macro.argument) {
                        areaIndex = index;
                        break;
                    }
                }
                if (areaIndex >= 0) macroAreas.splice(areaIndex, 1);
                pendingMacro = {name: frame.macro.name, argument: frame.macro.argument + 1};
            } else {
                pendingMacro = undefined;
            }
        } else if (char && !/\s/.test(char)) {
            pendingMacro = undefined;
        }
    }

    return {
        mode,
        textEnvironment: macros.some((name) => TEXT_MACROS.has(name)),
        snippetlessEnvironment: macros.some((name) => SNIPPETLESS_MACROS.has(name)),
        environments,
        macros,
        macroAreas,
    };
}
