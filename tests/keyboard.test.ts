import {describe, expect, it} from "vitest";
import {matchesKeyBinding} from "../src/core/keyboard";

function keyEvent(key: string, modifiers: Partial<KeyboardEvent> = {}): KeyboardEvent {
    return {key, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, ...modifiers} as KeyboardEvent;
}

describe("matchesKeyBinding", () => {
    it("matches CodeMirror modifier spelling", () => {
        expect(matchesKeyBinding(keyEvent("a", {ctrlKey: true}), "Ctrl-a")).toBe(true);
        expect(matchesKeyBinding(keyEvent("Tab", {shiftKey: true}), "Shift-Tab")).toBe(true);
        expect(matchesKeyBinding(keyEvent("a"), "Ctrl-a")).toBe(false);
    });

    it("supports Mod on Ctrl and Command platforms", () => {
        expect(matchesKeyBinding(keyEvent("k", {ctrlKey: true}), "Mod-k")).toBe(true);
        expect(matchesKeyBinding(keyEvent("k", {metaKey: true}), "Mod-k")).toBe(true);
    });
});
