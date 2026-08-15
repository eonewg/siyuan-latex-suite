import {describe, expect, it} from "vitest";
import {autoEnlargeBrackets} from "../src/core/auto-enlarge";

describe("autoEnlargeBrackets", () => {
    it("adds left/right around a trigger and maps cursor positions", () => {
        const result = autoEnlargeBrackets("(\\frac{x}{y})", ["\\frac"]);
        expect(result.value).toBe("\\left(\\frac{x}{y}\\right)");
        expect(result.mapPosition(6)).toBe(11);
    });

    it("does not enlarge an already controlled pair", () => {
        expect(autoEnlargeBrackets("\\left(\\sum x\\right)", ["\\sum"]).value)
            .toBe("\\left(\\sum x\\right)");
    });
});
