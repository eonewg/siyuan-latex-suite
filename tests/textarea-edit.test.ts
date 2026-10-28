import {beforeEach, describe, expect, it, vi} from "vitest";
import {editTextarea} from "../src/editor/textarea-edit";

class Field extends EventTarget {
    value = "abc";
    selectionStart = 3;
    selectionEnd = 3;
    readOnly = false;
    disabled = false;
    ownerDocument?: {activeElement: Field; execCommand?: (command: string, ui: boolean, text: string) => boolean};
    setSelectionRange(from: number, to: number): void {this.selectionStart = from; this.selectionEnd = to;}
}

describe("textarea edit transaction", () => {
    beforeEach(() => {
        vi.stubGlobal("InputEvent", class extends Event {
            constructor(type: string, init: InputEventInit) {super(type, init);}
        });
    });

    it("uses a focused native editing command without emitting duplicate input events", () => {
        const field = new Field();
        const input = vi.fn();
        field.addEventListener("input", input);
        const command = vi.fn((_name: string, _ui: boolean, text: string) => {
            field.value = field.value.slice(0, field.selectionStart) + text + field.value.slice(field.selectionEnd);
            field.dispatchEvent(new Event("input"));
            return true;
        });
        field.ownerDocument = {activeElement: field, execCommand: command};
        expect(editTextarea(field as unknown as HTMLTextAreaElement, "axc", {from: 1, to: 2}, "x")).toBe(true);
        expect(command).toHaveBeenCalledWith("insertText", false, "x");
        expect(field.value).toBe("axc");
        expect([field.selectionStart, field.selectionEnd]).toEqual([1, 2]);
        expect(input).toHaveBeenCalledTimes(1);
    });

    it.each([false, true])("falls back when native commands are unsupported (throw: %s)", (throws) => {
        const field = new Field();
        field.ownerDocument = {activeElement: field, execCommand: () => {
            if (throws) throw new Error("unsupported");
            return false;
        }};
        const input = vi.fn();
        field.addEventListener("input", input);
        editTextarea(field as unknown as HTMLTextAreaElement, "next", {from: 4, to: 4}, "next");
        expect(field.value).toBe("next");
        expect(input).toHaveBeenCalledTimes(1);
    });

    it("preserves readonly content and does not create a history entry for a cursor-only change", () => {
        const field = new Field();
        const input = vi.fn();
        field.addEventListener("input", input);
        editTextarea(field as unknown as HTMLTextAreaElement, "abc", {from: 1, to: 1}, "");
        expect(field.selectionStart).toBe(1);
        expect(input).not.toHaveBeenCalled();
        field.readOnly = true;
        expect(editTextarea(field as unknown as HTMLTextAreaElement, "next", {from: 4, to: 4}, "next")).toBe(false);
        expect(field.value).toBe("abc");
    });
});
