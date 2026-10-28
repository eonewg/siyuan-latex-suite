import {describe, expect, it, vi} from "vitest";
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
    it("quarantines a throwing replacement once and keeps lower-priority rules working", () => {
        const onError = vi.fn();
        const replacement = vi.fn(() => {throw new Error("broken replacement");});
        const engine = new SnippetEngine(onError);
        const rules: SnippetDefinition[] = [
            {trigger: "aa", replacement, options: "mA", priority: 10},
            {trigger: "aa", replacement: "ok", options: "mA"},
        ];
        expect(engine.find("aa", 2, "inline", "auto", rules)?.text).toBe("ok");
        expect(engine.find("aa", 2, "inline", "auto", rules)?.text).toBe("ok");
        expect(replacement).toHaveBeenCalledTimes(1);
        expect(onError).toHaveBeenCalledTimes(1);
        expect(onError.mock.calls[0]?.[0]).toBe(rules[0]);
        expect(engine.find("aa", 2, "inline", "auto", [{...rules[0]!, replacement: "fixed"}])?.text).toBe("fixed");
    });

    it("preserves input when the only rule throws and isolates visual failures", () => {
        const engine = new SnippetEngine(() => {throw new Error("reporter failure");});
        const bad: SnippetDefinition = {trigger: "aa", replacement: () => {throw new Error("bad");}, options: "mA"};
        expect(engine.find("aa", 2, "inline", "auto", [bad])).toBeNull();
        const visual = [
            {...bad, trigger: "U", options: "mv", priority: 2},
            {trigger: "U", replacement: "[${VISUAL}]", options: "mv"},
        ];
        expect(engine.findVisual("U", "x", 0, 1, "inline", visual)?.text).toBe("[x]");
    });

    it("handles rejected async replacements without an unhandled rejection", async () => {
        const onError = vi.fn();
        const engine = new SnippetEngine(onError);
        const rule: SnippetDefinition = {trigger: "aa", replacement: async () => {throw new Error("async");}, options: "mA"};
        expect(engine.find("aa", 2, "inline", "auto", [rule])).toBeNull();
        await Promise.resolve();
        await Promise.resolve();
        expect(onError).toHaveBeenCalledTimes(1);
    });

    it("treats false as a normal skipped rule rather than an error", () => {
        const replacement = vi.fn(() => false);
        const onError = vi.fn();
        const engine = new SnippetEngine(onError);
        const rules = [{trigger: "aa", replacement, options: "mA"}];
        engine.find("aa", 2, "inline", "auto", rules);
        engine.find("aa", 2, "inline", "auto", rules);
        expect(replacement).toHaveBeenCalledTimes(2);
        expect(onError).not.toHaveBeenCalled();
    });
    it("distinguishes T inside text macros from t in document text", () => {
        const rules: SnippetDefinition[] = [
            {trigger: "aa", replacement: "text", options: "TA"},
            {trigger: "aa", replacement: "document", options: "tA"},
            {trigger: "aa", replacement: "math", options: "mA"},
        ];
        const value = "\\text{aa";
        expect(engine.find(value, value.length, "inline", "auto", rules)?.text).toBe("text");
        expect(engine.find("aa", 2, "inline", "auto", rules)?.text).toBe("math");
        expect(engine.find(value, value.length, "inline", "auto", [rules[1]!])).toBeNull();
    });

    it("uses includedMacros only for the innermost macro and still honors exclusions", () => {
        const rules: SnippetDefinition[] = [{trigger: "aa", replacement: "ok", options: "mA", includedMacros: [{name: "color", arguments: [0]}]}];
        for (const value of ["aa", "\\color{x}{aa", "\\color{\\foo{aa"]) {
            expect(engine.find(value, value.length, "inline", "auto", rules)).toBeNull();
        }
        const value = "\\color{aa";
        expect(engine.find(value, value.length, "inline", "auto", rules)?.text).toBe("ok");
        expect(engine.find(value, value.length, "inline", "auto", [{...rules[0]!, excludedMacros: [{name: "color"}]}])).toBeNull();
    });

    it("applies custom macro settings to automatic and visual snippets", () => {
        const custom = {text: [{name: "caption", arguments: [0]}], restricted: []};
        const rules: SnippetDefinition[] = [
            {trigger: "aa", replacement: "ok", options: "TA"},
            {trigger: "U", replacement: "[${VISUAL}]", options: "Tv"},
        ];
        const value = "\\caption{aa";
        expect(engine.find(value, value.length, "inline", "auto", rules, "", custom)?.text).toBe("ok");
        expect(engine.findVisual("U", "aa", 9, 11, "inline", rules, value, 9, custom)?.text).toBe("[aa]");
    });
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
