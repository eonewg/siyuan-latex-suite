import {describe, expect, it, vi} from "vitest";
import {prepareSnippets} from "../src/core/compiled-snippets";
import {getCompiledSnippets, parseSnippets} from "../src/core/snippet-parser";
import {SnippetEngine} from "../src/core/snippet-engine";
import type {SnippetDefinition} from "../src/types";

describe("compiled snippet configuration", () => {
    it("keeps healthy legacy rules usable while quarantining an invalid string regex", () => {
        const source = '[{trigger:"[",replacement:"x",options:"mrA",priority:10},{trigger:"aa",replacement:"ok",options:"mA"}]';
        const rules = getCompiledSnippets(source, '{}');
        const error = vi.fn();
        const engine = new SnippetEngine(error);
        expect(engine.find("aa", 2, "inline", "auto", rules)?.text).toBe("ok");
        engine.find("aa", 2, "inline", "auto", rules);
        expect(error).toHaveBeenCalledTimes(1);
        expect(() => parseSnippets(source, '{}')).toThrow();
    });
    it("reuses sorted lists and regex objects while preserving captures and repeated matches", () => {
        const snippets: SnippetDefinition[] = [
            {trigger: /(x)(\d)/g, replacement: "[[0]]_{[[1]]}", options: "mA", priority: 1},
            {trigger: "abc", replacement: "ok", options: "mA", priority: 2},
        ];
        const compiled = prepareSnippets(snippets);
        expect(prepareSnippets(snippets)).toBe(compiled);
        expect(compiled[0]?.snippet.trigger).toBe("abc");
        expect(prepareSnippets([snippets[0]!])[0]?.trigger).toBe(compiled[1]?.trigger);
        const engine = new SnippetEngine();
        expect(engine.find("x2", 2, "inline", "auto", snippets)?.text).toBe("x_{2}");
        expect(engine.find("x3", 2, "inline", "auto", snippets)?.text).toBe("x_{3}");
    });

    it("validates regex triggers and triggerAfter before accepting configuration", () => {
        expect(() => parseSnippets('[{trigger:"[",replacement:"x",options:"mrA"}]', '{}')).toThrow("Invalid regex");
        expect(() => parseSnippets('[{trigger:"x",triggerAfter:/y/u,flags:"v",replacement:"x",options:"mA"}]', '{}')).toThrow("Invalid regex");
    });

    it("invalidates compiled behavior when edited source produces new definitions", () => {
        const oldRules = parseSnippets('[{trigger:"aa",replacement:"old",options:"mA"}]', '{}');
        const newRules = parseSnippets('[{trigger:"aa",replacement:"new",options:"mA"}]', '{}');
        expect(prepareSnippets(oldRules)).not.toBe(prepareSnippets(newRules));
        const engine = new SnippetEngine();
        expect(engine.find("aa", 2, "inline", "auto", oldRules)?.text).toBe("old");
        expect(engine.find("aa", 2, "inline", "auto", newRules)?.text).toBe("new");
    });
});
