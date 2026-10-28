import {describe, expect, it} from "vitest";
import {activeMatrixEnvironment, currentMatrixLinePrefix, nextClosingPosition, previousOpeningPosition} from "../src/core/navigation";

describe("math navigation", () => {
    it.each([
        ["(x)", 2, 0],
        ["a+\\left(x\\right)", 9, 2],
        ["a+\\bigl \\langle x\\bigr\\rangle", 18, 2],
        ["a+\\{x\\}", 5, 2],
        ["a+\\lVert x\\rVert", 10, 2],
        ["a+(b+[c])", 7, 5],
        ["abc", 3, null],
        ["(x)", 0, null],
    ])("moves backward to the opening token in %s", (value, cursor, expected) => {
        expect(previousOpeningPosition(value, cursor)).toBe(expected);
    });
    it("detects active matrix-like environments", () => {
        const open = "\\begin{pmatrix}\na & b";
        expect(activeMatrixEnvironment(open, open.length)).toBe("pmatrix");
        const closed = `${open}\n\\end{pmatrix}`;
        expect(activeMatrixEnvironment(closed, closed.length)).toBeNull();
        const macro = "\\eqalign{a &= b";
        expect(activeMatrixEnvironment(macro, macro.length, [], ["eqalign"])).toBe("eqalign");
    });

    it("moves after the nearest closing token", () => {
        expect(nextClosingPosition("\\frac{x}{}", 7)).toBe(8);
        expect(nextClosingPosition("\\left(x\\right)", 7)).toBe(14);
        expect(nextClosingPosition("abc", 3)).toBeNull();
    });

    it("handles sizing-command whitespace, partial commands and comments", () => {
        const spaced = "\\left (x\\right )";
        expect(nextClosingPosition(spaced, 8)).toBe(spaced.length);
        const command = "x\\rangle";
        expect(nextClosingPosition(command, 4, new Set(["\\rangle"]))).toBe(command.length);
        expect(nextClosingPosition("x\\right q", 1)).toBe(7);
        expect(nextClosingPosition("x% )\n+y}", 1)).toBe(8);
        expect(previousOpeningPosition("x% (\n+y", 7)).toBeNull();
    });

    it("preserves indentation and leading empty matrix cells", () => {
        const row = "\\begin{matrix}\n  & x";
        expect(currentMatrixLinePrefix(row, row.length)).toBe("  & ");
    });
});
