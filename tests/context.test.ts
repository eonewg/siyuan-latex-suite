import {describe, expect, it} from "vitest";
import {createSnippetContext} from "../src/core/context";

function context(value: string) {
    return createSnippetContext(value, value.length, "inline");
}

describe("LaTeX Suite 1.14.1 macro regions", () => {
    it.each(["text", "color", "textcolor", "tag", "begin", "end", "style", "operatorname"])(
        "does not consume a second argument of %s by default", (name) => {
            expect(context(`\\${name}{first}{x`)).toMatchObject({textEnvironment: false, snippetlessEnvironment: false});
        },
    );

    it.each([
        ["\\text{x", true, false],
        ["\\textcolor{red", false, true],
        ["\\textcolor{red}{x", false, false],
        ["\\colorbox{red}{x", true, false],
        ["\\fcolorbox{red}{blue", false, true],
        ["\\fcolorbox{red}{blue}{x", true, false],
        ["\\mmlToken{mi}{x", false, true],
        ["\\mmlToken{mi}{x}{y", false, false],
    ])("classifies %s by its argument", (value, textEnvironment, snippetlessEnvironment) => {
        expect(context(value)).toMatchObject({textEnvironment, snippetlessEnvironment});
    });

    it("retains the enclosing scope through nested environments", () => {
        expect(context("\\text{\\begin{aligned} x").textEnvironment).toBe(true);
        expect(context("\\color{\\begin{aligned} x").snippetlessEnvironment).toBe(true);
    });

    it("uses the innermost classified macro", () => {
        expect(context("\\text{\\color{red")).toMatchObject({textEnvironment: false, snippetlessEnvironment: true});
        expect(context("\\text{\\textcolor{red}{x")).toMatchObject({textEnvironment: true, snippetlessEnvironment: false});
    });

    it("ignores escaped braces and comment contents", () => {
        expect(context(String.raw`\text{\}x`).textEnvironment).toBe(true);
        expect(context(String.raw`\text{\{x}`).textEnvironment).toBe(false);
        expect(context("% \\text{ignored\nx")).toMatchObject({textEnvironment: false, snippetlessEnvironment: false});
        expect(context("% x").snippetlessEnvironment).toBe(true);
        expect(context(String.raw`\% x`).snippetlessEnvironment).toBe(false);
        expect(context(String.raw`\\text{x`).textEnvironment).toBe(false);
    });

    it("does not count optional arguments as required arguments", () => {
        expect(context("\\textcolor[rgb]{red}{x")).toMatchObject({textEnvironment: false, snippetlessEnvironment: false});
        expect(context("\\colorbox[rgb]{red}{x").textEnvironment).toBe(true);
    });

    it("supports custom first, specific and all argument scopes", () => {
        const custom = {text: [{name: "caption", arguments: [1]}], restricted: [{name: "secret"}]};
        expect(createSnippetContext("\\caption{x}{y", 14, "inline", custom).textEnvironment).toBe(true);
        expect(createSnippetContext("\\secret{x}{y", 13, "inline", custom).snippetlessEnvironment).toBe(true);
    });
});
