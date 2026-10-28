import type {Keybindings} from "../types";

export const DEFAULT_KEYBINDINGS: Keybindings = {
    snippetsTrigger: "Tab",
    snippetNextTabstopTrigger: "Tab",
    snippetPreviousTabstopTrigger: "Shift-Tab",
    taboutTrigger: "Tab",
    reverseTaboutTrigger: "Shift-Tab",
    autofractionTrigger: "/",
    matrixShortcutsCellTrigger: "Tab",
    matrixShortcutsNewlineTrigger: "Enter",
    matrixShortcutsExitTrigger: "Shift-Enter",
};

function parseBinding(binding: string): {key: string; modifiers: Set<string>} | null {
    let key = binding.trim();
    if (binding === " ") key = "Space";
    const modifiers = new Set<string>();
    let match: RegExpExecArray | null;
    while ((match = /^(alt|ctrl|control|cmd|meta|mod|shift)-/i.exec(key))) {
        modifiers.add(match[1]!.toLowerCase());
        key = key.slice(match[0].length);
    }
    const named = /^(?:Tab|Enter|Return|Escape|Esc|Space|Backspace|Delete|Insert|Home|End|PageUp|PageDown|Arrow(?:Left|Right|Up|Down)|F(?:[1-9]|1\d|2[0-4]))$/i;
    return [...key].length === 1 || named.test(key) ? {key, modifiers} : null;
}

/** Missing entries inherit defaults; an empty entry disables that action. */
export function parseKeybindings(source: string): Keybindings {
    const raw: unknown = JSON.parse(source);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Keybindings must be an object");
    const result = {...DEFAULT_KEYBINDINGS};
    for (const [key, value] of Object.entries(raw)) {
        if (!Object.hasOwn(DEFAULT_KEYBINDINGS, key)) throw new Error(`Unknown shortcut action: ${key}`);
        if (typeof value !== "string" || (value !== "" && !parseBinding(value))) {
            throw new Error(`Invalid shortcut for ${key}: use Tab, Shift-Enter, Ctrl-j, Mod-/ or an empty string`);
        }
        result[key as keyof Keybindings] = value;
    }
    return result;
}

function normalizedKey(key: string): string {
    const lower = key.toLowerCase();
    if (lower === " ") return "space";
    if (lower === "esc") return "escape";
    if (lower === "return") return "enter";
    return lower;
}

/** Matches the CodeMirror keymap spelling used by LaTeX Suite, e.g. Ctrl-a or Shift-Tab. */
export function matchesKeyBinding(event: KeyboardEvent, binding: string): boolean {
    const parsed = parseBinding(binding);
    if (!parsed) return false;
    const {key, modifiers} = parsed;
    if (normalizedKey(event.key) !== normalizedKey(key)) return false;

    const wantsAlt = modifiers.has("alt");
    const wantsCtrl = modifiers.has("ctrl") || modifiers.has("control");
    const wantsMeta = modifiers.has("cmd") || modifiers.has("meta");
    const wantsMod = modifiers.has("mod");
    const letter = key.toLowerCase() !== key.toUpperCase() && [...key].length === 1;
    const wantsShift = modifiers.has("shift") || (letter && key === key.toUpperCase());
    // Layouts differ in whether punctuation requires Shift. Match the produced
    // character unless Shift is explicitly requested.
    const flexibleShift = [...key].length === 1 && !letter && !modifiers.has("shift");
    const modMatches = !wantsMod || event.ctrlKey || event.metaKey;
    return modMatches
        && event.altKey === wantsAlt
        && (!wantsMod ? event.ctrlKey === wantsCtrl : !wantsCtrl || event.ctrlKey)
        && (!wantsMod ? event.metaKey === wantsMeta : !wantsMeta || event.metaKey)
        && (flexibleShift || event.shiftKey === wantsShift);
}
