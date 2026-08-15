const MODIFIERS = new Set(["alt", "ctrl", "control", "cmd", "meta", "mod", "shift"]);

function normalizedKey(key: string): string {
    const lower = key.toLowerCase();
    if (lower === " ") return "space";
    if (lower === "esc") return "escape";
    if (lower === "return") return "enter";
    return lower;
}

/** Matches the CodeMirror keymap spelling used by LaTeX Suite, e.g. Ctrl-a or Shift-Tab. */
export function matchesKeyBinding(event: KeyboardEvent, binding: string): boolean {
    const parts = binding.split("-").map((part) => part.trim().toLowerCase()).filter(Boolean);
    if (parts.length === 0) return false;
    const key = [...parts].reverse().find((part) => !MODIFIERS.has(part));
    if (!key || normalizedKey(event.key) !== normalizedKey(key)) return false;

    const wantsAlt = parts.includes("alt");
    const wantsCtrl = parts.includes("ctrl") || parts.includes("control");
    const wantsMeta = parts.includes("cmd") || parts.includes("meta");
    const wantsMod = parts.includes("mod");
    const wantsShift = parts.includes("shift");
    const modMatches = !wantsMod || event.ctrlKey || event.metaKey;
    return modMatches
        && event.altKey === wantsAlt
        && (!wantsMod ? event.ctrlKey === wantsCtrl : !wantsCtrl || event.ctrlKey)
        && (!wantsMod ? event.metaKey === wantsMeta : !wantsMeta || event.metaKey)
        && event.shiftKey === wantsShift;
}
