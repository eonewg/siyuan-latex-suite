import {describe, expect, it} from "vitest";
import {BUNDLED_SNIPPETS_SOURCE, BUNDLED_SNIPPET_VARIABLES_SOURCE, LEGACY_BUNDLED_SNIPPETS_SOURCE, migrateBundledSnippets} from "../src/bundled-snippets-source";
import {parseSnippets, parseSnippetVariables, parseTextMacros} from "../src/core/snippet-parser";
import {SnippetEngine} from "../src/core/snippet-engine";

describe("bundled snippets and LaTeX Suite source compatibility", () => {
    const snippets = parseSnippets(BUNDLED_SNIPPETS_SOURCE, BUNDLED_SNIPPET_VARIABLES_SOURCE);
    const engine = new SnippetEngine();

    it("upgrades the untouched bundled configuration while preserving custom source verbatim", () => {
        expect(migrateBundledSnippets(LEGACY_BUNDLED_SNIPPETS_SOURCE)).toBe(BUNDLED_SNIPPETS_SOURCE);
        expect(migrateBundledSnippets()).toBe(BUNDLED_SNIPPETS_SOURCE);
        const custom = LEGACY_BUNDLED_SNIPPETS_SOURCE + "\n// my custom rules";
        expect(migrateBundledSnippets(custom)).toBe(custom);
        expect(migrateBundledSnippets("[]")).toBe("[]");
    });

    it("accepts expression-style default exports and key-only snippets", () => {
        const parsed = parseSnippets('// imported settings\nexport default [{triggerKey: "Ctrl-q", replacement: "ok", options: "m"}];', 'export default {GREEK: "alpha"};');
        expect(parsed[0]).toMatchObject({trigger: "", triggerKey: "Ctrl-q"});
        expect(() => parseSnippets('[{replacement: "ok", options: "m"}]', '{}')).toThrow();
    });

    it("normalizes string macro entries to the first argument only", () => {
        const parsed = parseSnippets('[{trigger:"aa",replacement:"ok",options:"mA",excludedMacros:["foo"],includedMacros:["bar"]}]', '{}');
        expect(parsed[0]?.excludedMacros).toEqual([{name: "foo", arguments: [0]}]);
        expect(parsed[0]?.includedMacros).toEqual([{name: "bar", arguments: [0]}]);
        for (const [value, result] of [["\\foo{aa", null], ["\\foo{x}{aa", "ok"]] as const) {
            const rules = [{...parsed[0]!, includedMacros: []}];
            expect(engine.find(value, value.length, "inline", "auto", rules)?.text ?? null).toBe(result);
        }
    });

    it("validates text macro configuration before saving", () => {
        expect(parseTextMacros('{"text":["caption"],"restricted":[{"name":"foo"}]}')).toEqual({
            text: [{name: "caption", arguments: [0]}], restricted: [{name: "foo", arguments: undefined}],
        });
        for (const source of ['[]', '{"text":"foo"}', '{"text":[{"name":"foo","arguments":[-1]}]}']) {
            expect(() => parseTextMacros(source)).toThrow();
        }
    });

    it("uses inline spaces and block newlines for beg without expanding inside commands", () => {
        expect(engine.find("beg", 3, "inline", "auto", snippets)?.text).toBe("\\begin{}  \\end{}");
        expect(engine.find("beg", 3, "block", "auto", snippets)?.text).toBe("\\begin{}\n\n\\end{}");
        expect(engine.find("\\beg", 4, "inline", "auto", snippets)).toBeNull();
    });

    it("parses the user's complete JavaScript-style snippet source", () => {
        expect(snippets.length).toBeGreaterThan(150);
        expect(Object.keys(parseSnippetVariables(BUNDLED_SNIPPET_VARIABLES_SOURCE))).toContain("${GREEK}");
    });

    it("expands literal, variable regex, and priority-sensitive snippets", () => {
        expect(engine.find("@a", 2, "inline", "auto", snippets)?.text).toBe("\\alpha");
        expect(engine.find("xalpha", 6, "inline", "auto", snippets)?.text).toBe("x\\alpha");
        expect(engine.find("xddot", 5, "inline", "auto", snippets)?.text).toBe("\\ddot{x}");
    });

    it.each([
        ["sin", "\\sin"],
        ["cos", "\\cos"],
        ["tan", "\\tan"],
        ["exp", "\\exp"],
        ["log", "\\log"],
        ["det", "\\det"],
        ["int", "\\int"],
    ])("treats the start of SiYuan's formula body as an Obsidian math boundary: %s", (source, expected) => {
        expect(engine.find(source, source.length, "inline", "auto", snippets)?.text).toBe(expected);
    });

    it("runs function replacements such as identity matrices", () => {
        expect(engine.find("iden3", 5, "block", "auto", snippets)?.text).toBe(
            "\\begin{pmatrix}\n1 & 0 & 0 \\\\\n0 & 1 & 0 \\\\\n0 & 0 & 1\n\\end{pmatrix}",
        );
    });

    it("detects ${VISUAL} snippets without requiring the legacy v flag", () => {
        expect(engine.findVisual("U", "x+y", 2, 5, "inline", snippets)?.text)
            .toBe("\\underbrace{ x+y }_{  }");
    });

    it("honors default macro exclusions", () => {
        expect(engine.find("\\ce{x2", 6, "inline", "auto", snippets)).toBeNull();
    });
});
