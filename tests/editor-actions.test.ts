import {describe, expect, it} from "vitest";
import {resolveMatrixAction, taboutDirection} from "../src/core/editor-actions";
import {activeMatrixScope, matrixExitPosition, matrixNewlineText} from "../src/core/navigation";
import {TEST_SETTINGS} from "./settings-fixture";

function key(key: string, shiftKey = false, ctrlKey = false): KeyboardEvent {
    return {key, shiftKey, ctrlKey, metaKey: false, altKey: false} as KeyboardEvent;
}

describe("matrix actions", () => {
    it("moves past a cell's closing bracket before inserting a column", () => {
        const value = "\\begin{matrix}(x) & y\\end{matrix}";
        const cursor = value.indexOf(")");
        expect(resolveMatrixAction(value, cursor, key("Tab"), TEST_SETTINGS)).toEqual({kind: "move", position: cursor + 1});
        expect(resolveMatrixAction(value, cursor + 1, key("Tab"), TEST_SETTINGS)).toEqual({kind: "insert", text: " & "});
        expect(resolveMatrixAction(value, cursor, key("Tab"), {...TEST_SETTINGS, tabOut: false})).toEqual({kind: "insert", text: " & "});
    });

    it.each([
        "\\begin{matrix}\\frac{x",
        "\\begin{matrix}\\text{x",
        "\\begin{matrix}\\color{red",
        "% \\begin{matrix} x",
        "\\\\begin{matrix} x",
        "\\begin{matrix}\\begin{unknown}x",
    ])("does not treat nested non-matrix context as a cell: %s", (value) => {
        expect(resolveMatrixAction(value, value.length, key("Tab"), TEST_SETTINGS)).toBeNull();
        expect(resolveMatrixAction(value, value.length, key("Enter"), TEST_SETTINGS)).toBeNull();
    });

    it("preserves the enclosing matrix after nested macros close", () => {
        const value = "\\begin{matrix}\\frac{x}{y}";
        expect(resolveMatrixAction(value, value.length, key("Tab"), TEST_SETTINGS)).toEqual({kind: "insert", text: " & "});
    });

    it("keeps custom text macros from receiving matrix shortcuts", () => {
        const value = "\\caption{\\begin{matrix}x";
        expect(resolveMatrixAction(value, value.length, key("Tab"), {
            ...TEST_SETTINGS, textMacros: {text: [{name: "caption"}], restricted: []},
        })).toBeNull();
    });

    it("uses spaces in single-line matrices and preserves indent/cells in multiline matrices", () => {
        for (const value of ["\\begin{matrix}x\\end{matrix}", "\\eqalign{x}"]) {
            const cursor = value.includes("\\end") ? value.indexOf("x\\end") : value.indexOf("{x") + 1;
            const scope = activeMatrixScope(value, cursor, TEST_SETTINGS)!;
            expect(matrixNewlineText(value, cursor, scope)).toBe(" \\\\  ");
            expect(matrixExitPosition(value, cursor, scope)).toBe(value.length);
        }
        const value = "\\begin{matrix}\n  & x\\end{matrix}";
        const cursor = value.indexOf("x\\end");
        const scope = activeMatrixScope(value, cursor, TEST_SETTINGS)!;
        expect(matrixNewlineText(value, cursor, scope)).toBe(" \\\\\n  & ");
    });

    it("stops at the closing environment even when more text follows on the same line", () => {
        const value = "\\begin{matrix}\na\n\\end{matrix} + z";
        const cursor = value.indexOf("\na") + 2;
        const scope = activeMatrixScope(value, cursor, TEST_SETTINGS)!;
        expect(matrixExitPosition(value, cursor, scope)).toBe(value.indexOf(" + z"));
    });

    it("does not scan another cell for an unrelated closing bracket", () => {
        const value = "\\begin{matrix}x & y)\\end{matrix}";
        expect(resolveMatrixAction(value, value.indexOf("x &"), key("Tab"), TEST_SETTINGS)).toEqual({kind: "insert", text: " & "});
    });

    it("uses independent configurable keys for cell, row and exit", () => {
        const settings = {...TEST_SETTINGS, keybindings: {...TEST_SETTINGS.keybindings,
            matrixShortcutsCellTrigger: "Ctrl-j", matrixShortcutsNewlineTrigger: "Ctrl-k", matrixShortcutsExitTrigger: "Ctrl-l",
        }};
        const value = "\\begin{matrix}x\\end{matrix}";
        const cursor = value.indexOf("x\\end");
        expect(resolveMatrixAction(value, cursor, key("Tab"), settings)).toBeNull();
        expect(resolveMatrixAction(value, cursor, key("j", false, true), settings)).toEqual({kind: "insert", text: " & "});
        expect(resolveMatrixAction(value, cursor, key("k", false, true), settings)?.kind).toBe("insert");
        expect(resolveMatrixAction(value, cursor, key("l", false, true), settings)).toEqual({kind: "move", position: value.length});
    });

    it("supports typing over matching closers and disabling tabout", () => {
        expect(taboutDirection("(x)", 2, key(")", true), TEST_SETTINGS)).toBe("forward");
        expect(taboutDirection("(x)", 1, key(")", true), TEST_SETTINGS)).toBeNull();
        expect(taboutDirection("(x)", 2, key(")", true), {...TEST_SETTINGS, tabOut: false})).toBeNull();
        expect(taboutDirection("(x)", 2, key(")", false, true), TEST_SETTINGS)).toBeNull();
        expect(taboutDirection("(x)", 2, key(")"), {...TEST_SETTINGS, tabOutClosingSymbols: ["}"]})).toBeNull();
    });
});
