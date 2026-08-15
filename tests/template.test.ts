import {describe, expect, it} from "vitest";
import {renderTemplate} from "../src/core/template";

describe("renderTemplate", () => {
    it("renders placeholders in LaTeX Suite numeric order starting at zero", () => {
        const result = renderTemplate("\\frac{${1:x}}{$2}$0");
        expect(result.text).toBe("\\frac{x}{}");
        expect(result.tabstops).toEqual([
            {index: 0, from: 10, to: 10},
            {index: 1, from: 6, to: 7},
            {index: 2, from: 9, to: 9},
        ]);
    });

    it("injects regex captures and selections as literal text", () => {
        expect(renderTemplate("\\hat{[[0]]}", {captures: ["x"]}).text).toBe("\\hat{x}");
        expect(renderTemplate("\\cancel{[[selection]]}", {selection: "x_$1"}).text).toBe("\\cancel{x_$1}");
    });
});
