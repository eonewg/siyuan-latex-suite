/** Apply an edit using the browser's undo buffer when available (as SiYuan does). */
export function editTextarea(
    textarea: HTMLTextAreaElement,
    value: string,
    selection: {from: number; to: number},
    data: string,
): boolean {
    if (textarea.readOnly || textarea.disabled) return false;
    const previous = textarea.value;
    if (previous === value) {
        textarea.setSelectionRange(selection.from, selection.to);
        return true;
    }
    const document = textarea.ownerDocument;
    let nativeInput = false;
    const markInput = () => {nativeInput = true;};
    if (document?.activeElement === textarea && typeof document.execCommand === "function") {
        let start = 0;
        let oldEnd = previous.length;
        let newEnd = value.length;
        while (start < oldEnd && start < newEnd && previous[start] === value[start]) start += 1;
        while (oldEnd > start && newEnd > start && previous[oldEnd - 1] === value[newEnd - 1]) {
            oldEnd -= 1;
            newEnd -= 1;
        }
        textarea.setSelectionRange(start, oldEnd);
        textarea.addEventListener("input", markInput);
        try {
            document.execCommand("insertText", false, value.slice(start, newEnd));
        } catch {
            // Non-Chromium frontends may not support this command.
        } finally {
            textarea.removeEventListener("input", markInput);
        }
    }
    if (textarea.value !== value) {
        textarea.value = value;
        nativeInput = false;
    }
    textarea.setSelectionRange(selection.from, selection.to);
    if (!nativeInput) {
        textarea.dispatchEvent(new InputEvent("input", {
            bubbles: true, cancelable: true, inputType: "insertReplacementText", data,
        }));
    }
    return true;
}
