import {describe, expect, it} from "vitest";
import {createAutoFraction, createShortcutFraction, findNumeratorStart} from "../src/core/fraction";
import {TEST_SETTINGS} from "./settings-fixture";

describe("auto fraction", () => {
    it.each(["\\text{path/", "\\textcolor{red/", "\\operatorname{foo/", "% foo/"])(
        "does not transform slashes outside strict math: %s", (source) => {
            expect(createAutoFraction(source, source.length, TEST_SETTINGS)).toBeNull();
            expect(createShortcutFraction(source.slice(0, -1), source.length - 1, TEST_SETTINGS)).toBeNull();
        },
    );

    it("honors custom text macros and permits textcolor's math argument", () => {
        const custom = {...TEST_SETTINGS, textMacros: {text: [{name: "caption"}], restricted: []}};
        const value = "\\caption{path/";
        expect(createAutoFraction(value, value.length, custom)).toBeNull();
        const math = "\\textcolor{red}{x/";
        expect(createAutoFraction(math, math.length, custom)?.text).toBe("\\frac{x}{}");
    });
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
