/**
 * Automatic snippets must only react to text insertion. Running them after a
 * deletion can re-expand a trigger that Backspace merely exposed (for example
 * deleting "{" inside `\dot{}` exposes `dot` again).
 *
 * The empty inputType fallback keeps compatibility with older/custom editors
 * that dispatch a plain input event for inserted text.
 */
export function isInsertionInput(event: Event): boolean {
    const inputType = (event as InputEvent).inputType ?? "";
    return inputType === "" || inputType.startsWith("insert");
}
