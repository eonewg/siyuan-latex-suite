import {describe, expect, it} from "vitest";
import {createAutoFraction, findNumeratorStart} from "../src/core/fraction";

describe("auto fraction", () => {
    it.each([
        ["x/", "\\frac{x}{}"],
        ["\\theta/", "\\frac{\\theta}{}"],
        ["(a + b(c + d))/", "\\frac{a + b(c + d)}{}"],
        ["x_{1}/", "\\frac{x_{1}}{}"],
        ["x^2/", "\\frac{x^2}{}"],
        ["x_1/", "\\frac{x_1}{}"],
    ])("converts %s", (source, expected) => {
        expect(createAutoFraction(source, source.length)?.text).toBe(expected);
    });

    it("does not convert an empty or operator-adjacent slash", () => {
        expect(createAutoFraction("/", 1)).toBeNull();
        expect(createAutoFraction("x + /", 5)).toBeNull();
        expect(findNumeratorStart("x+", 2)).toBe(-1);
    });
});
