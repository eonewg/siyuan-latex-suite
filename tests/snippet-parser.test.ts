import {describe, expect, it} from "vitest";
import {BUNDLED_SNIPPETS_SOURCE, BUNDLED_SNIPPET_VARIABLES_SOURCE} from "../src/bundled-snippets-source";
import {parseSnippets, parseSnippetVariables} from "../src/core/snippet-parser";
import {SnippetEngine} from "../src/core/snippet-engine";

describe("LaTeX Suite 1.12.2 source compatibility", () => {
    const snippets = parseSnippets(BUNDLED_SNIPPETS_SOURCE, BUNDLED_SNIPPET_VARIABLES_SOURCE);
    const engine = new SnippetEngine();

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
