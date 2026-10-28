import {describe, expect, it} from "vitest";
import {DEFAULT_KEYBINDINGS, matchesKeyBinding, parseKeybindings} from "../src/core/keyboard";

function keyEvent(key: string, modifiers: Partial<KeyboardEvent> = {}): KeyboardEvent {
    return {key, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, ...modifiers} as KeyboardEvent;
}

describe("matchesKeyBinding", () => {
    it("matches literal minus, modified minus and shifted punctuation", () => {
        expect(matchesKeyBinding(keyEvent("-"), "-")).toBe(true);
        expect(matchesKeyBinding(keyEvent("-", {ctrlKey: true}), "Ctrl--")).toBe(true);
        expect(matchesKeyBinding(keyEvent("}" , {shiftKey: true}), "}")).toBe(true);
        expect(matchesKeyBinding(keyEvent("a", {shiftKey: true}), "a")).toBe(false);
        expect(matchesKeyBinding(keyEvent("A", {shiftKey: true}), "A")).toBe(true);
        expect(matchesKeyBinding(keyEvent(" "), "Space")).toBe(true);
        expect(matchesKeyBinding(keyEvent("Tab"), "")).toBe(false);
    });

    it("inherits defaults and preserves explicit disabled actions", () => {
        expect(parseKeybindings('{"snippetsTrigger":"Ctrl-j","taboutTrigger":""}')).toEqual({
            ...DEFAULT_KEYBINDINGS, snippetsTrigger: "Ctrl-j", taboutTrigger: "",
        });
        for (const source of ['[]', 'null', '{"typo":"Tab"}', '{"toString":"Tab"}', '{"snippetsTrigger":3}', '{"snippetsTrigger":"Ctrl-"}']) {
            expect(() => parseKeybindings(source)).toThrow();
        }
    });
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
