import {describe, expect, it} from "vitest";
import {SnippetEngine} from "../src/core/snippet-engine";
import type {SnippetDefinition} from "../src/types";

const engine = new SnippetEngine();
const snippets: SnippetDefinition[] = [
    {trigger: "@a", replacement: "\\alpha", options: "mA"},
    {trigger: "frac", replacement: "\\frac{$1}{$2}$0", options: "m"},
    {trigger: "([A-Za-z])sr", replacement: "[[0]]^{2}", options: "mrA"},
    {trigger: "U", replacement: "\\underbrace{[[selection]]}_{$1}$0", options: "mv"},
];

describe("SnippetEngine", () => {
    it("expands automatic literal snippets", () => {
        expect(engine.find("1+@a", 4, "inline", "auto", snippets)).toMatchObject({from: 2, to: 4, text: "\\alpha"});
    });

    it("reserves non-auto snippets for Tab", () => {
        expect(engine.find("frac", 4, "block", "auto", snippets)).toBeNull();
        expect(engine.find("frac", 4, "block", "tab", snippets)?.text).toBe("\\frac{}{}");
    });

    it("supports regex captures", () => {
        expect(engine.find("xsr", 3, "inline", "auto", snippets)?.text).toBe("x^{2}");
    });

    it("wraps a visual selection", () => {
        expect(engine.findVisual("U", "x+y", 2, 5, "inline", snippets)).toMatchObject({
            from: 2,
            to: 5,
            text: "\\underbrace{x+y}_{}",
        });
    });

    it("honors argument-specific macro exclusions", () => {
        const scoped: SnippetDefinition[] = [{
            trigger: "aa",
            replacement: "ok",
            options: "mA",
            excludedMacros: [{name: "foo", arguments: [1]}],
        }];
        expect(engine.find("\\foo{aa", 7, "inline", "auto", scoped)?.text).toBe("ok");
        expect(engine.find("\\foo{x}{aa", 10, "inline", "auto", scoped)).toBeNull();
    });

    it("uses the full formula context for visual exclusions", () => {
        const scoped: SnippetDefinition[] = [{
            trigger: "U",
            replacement: "\\underbrace{${VISUAL}}",
            options: "mv",
            excludedEnvironments: ["cases"],
        }];
        const value = "\\begin{cases}x\\end{cases}";
        expect(engine.findVisual("U", "x", 13, 14, "block", scoped, value, 13)).toBeNull();
    });
});
