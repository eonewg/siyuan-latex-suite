import {describe, expect, it} from "vitest";
import {applyWithRecursion} from "../src/core/recursion";
import type {Expansion, SnippetDefinition} from "../src/types";

const initial: Expansion = {from: 0, to: 1, text: "b", tabstops: []};
const snippets: SnippetDefinition[] = [
    {trigger: "b", replacement: "c", options: "mA"},
    {trigger: "c", replacement: "d$0", options: "mA"},
];

describe("applyWithRecursion", () => {
    it("runs the configured number of additional automatic expansions", () => {
        expect(applyWithRecursion("a", initial, "inline", snippets, " ", 0).value).toBe("b");
        expect(applyWithRecursion("a", initial, "inline", snippets, " ", 1).value).toBe("c");
        const twice = applyWithRecursion("a", initial, "inline", snippets, " ", 2);
        expect(twice.value).toBe("d");
        expect(twice.tabstops).toEqual([{index: 0, from: 1, to: 1}]);
    });
});
