import {describe, expect, it, vi} from "vitest";
import {filterSnippetReference, snippetReferenceEntries} from "../src/ui/snippet-reference";
import {DEFAULT_KEYBINDINGS} from "../src/core/keyboard";

describe("snippet reference", () => {
    it("never executes dynamic replacements to build the reference", () => {
        const replacement = vi.fn(() => {throw new Error("must not execute");});
        const [entry] = snippetReferenceEntries([{trigger: /foo(\d+)/, options: "mA", replacement}]);
        expect(entry?.template).toContain("动态函数");
        expect(replacement).not.toHaveBeenCalled();
    });

    it("searches descriptions, templates and macro conditions together", () => {
        const entries = snippetReferenceEntries([
            {trigger: "hot", replacement: "ok", options: "m", description: "Example", includedMacros: [{name: "foo", arguments: [1]}]},
            {trigger: "U", replacement: "\\underbrace{${VISUAL}}", options: "m"},
        ], {...DEFAULT_KEYBINDINGS, snippetsTrigger: "Ctrl-j"});
        expect(entries[0]?.activation).toBe("Ctrl-j");
        expect(filterSnippetReference(entries, "EXAMPLE foo(1)")).toEqual([entries[0]]);
        expect(filterSnippetReference(entries, "underbrace", "visual")).toEqual([entries[1]]);
        expect(filterSnippetReference(entries, "", "auto")).toEqual([]);
    });
});
