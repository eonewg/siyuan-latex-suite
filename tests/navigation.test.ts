import {describe, expect, it} from "vitest";
import {activeMatrixEnvironment, currentMatrixLinePrefix, nextClosingPosition} from "../src/core/navigation";

describe("math navigation", () => {
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

    it("preserves indentation and leading empty matrix cells", () => {
        const row = "\\begin{matrix}\n  & x";
        expect(currentMatrixLinePrefix(row, row.length)).toBe("  & ");
    });
});
