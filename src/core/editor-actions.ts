import {DEFAULT_KEYBINDINGS, matchesKeyBinding} from "./keyboard";
import {activeMatrixScope, matrixCellClosingPosition, matrixExitPosition, matrixNewlineText} from "./navigation";
import type {LatexSuiteSettings} from "../types";

export type MatrixAction = {kind: "insert"; text: string} | {kind: "move"; position: number};

export function resolveMatrixAction(value: string, cursor: number, event: KeyboardEvent, settings: LatexSuiteSettings): MatrixAction | null {
    if (!settings.matrixShortcuts) return null;
    const keys = settings.keybindings ?? DEFAULT_KEYBINDINGS;
    const cell = matchesKeyBinding(event, keys.matrixShortcutsCellTrigger);
    const newline = matchesKeyBinding(event, keys.matrixShortcutsNewlineTrigger);
    const exit = matchesKeyBinding(event, keys.matrixShortcutsExitTrigger);
    if (!cell && !newline && !exit) return null;
    const scope = activeMatrixScope(value, cursor, settings);
    if (!scope) return null;
    if (cell && settings.tabOut && matchesKeyBinding(event, keys.taboutTrigger)) {
        const position = matrixCellClosingPosition(value, cursor, scope, new Set(settings.tabOutClosingSymbols));
        if (position !== null) return {kind: "move", position};
    }
    if (newline) return {kind: "insert", text: matrixNewlineText(value, cursor, scope)};
    if (cell) return {kind: "insert", text: " & "};
    return {kind: "move", position: matrixExitPosition(value, cursor, scope)};
}

/** Return the direction of navigation, including typing over an existing closer. */
export function taboutDirection(value: string, cursor: number, event: KeyboardEvent, settings: LatexSuiteSettings): "forward" | "backward" | null {
    if (!settings.tabOut) return null;
    const keys = settings.keybindings ?? DEFAULT_KEYBINDINGS;
    if (matchesKeyBinding(event, keys.taboutTrigger)) return "forward";
    if (matchesKeyBinding(event, keys.reverseTaboutTrigger)) return "backward";
    if ([")", "]", "}"].includes(event.key) && value[cursor] === event.key
        && settings.tabOutClosingSymbols.includes(event.key)
        && !event.ctrlKey && !event.metaKey && !event.altKey) return "forward";
    return null;
}
