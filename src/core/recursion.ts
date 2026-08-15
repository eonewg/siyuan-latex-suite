import {SnippetEngine} from "./snippet-engine";
import type {EditorMode, Expansion, SnippetDefinition, TabstopRange} from "../types";

export interface AppliedExpansion {
    value: string;
    cursor: number;
    tabstops: TabstopRange[];
}

function mapExistingRanges(ranges: readonly TabstopRange[], expansion: Expansion): TabstopRange[] {
    const delta = expansion.text.length - (expansion.to - expansion.from);
    return ranges.flatMap((range) => {
        if (range.to <= expansion.from) return [{...range}];
        if (range.from >= expansion.to) return [{...range, from: range.from + delta, to: range.to + delta}];
        return [];
    });
}

function applyOne(value: string, ranges: readonly TabstopRange[], expansion: Expansion): AppliedExpansion {
    return {
        value: value.slice(0, expansion.from) + expansion.text + value.slice(expansion.to),
        cursor: expansion.from + expansion.text.length,
        tabstops: [
            ...mapExistingRanges(ranges, expansion),
            ...expansion.tabstops.map((range) => ({
                ...range,
                from: range.from + expansion.from,
                to: range.to + expansion.from,
            })),
        ],
    };
}

/** Applies one requested expansion, then automatic snippets up to `recursion` additional times. */
export function applyWithRecursion(
    value: string,
    initial: Expansion,
    mode: EditorMode,
    snippets: readonly SnippetDefinition[],
    wordDelimiters: string,
    recursion: number,
    engine = new SnippetEngine(),
): AppliedExpansion {
    let result = applyOne(value, [], initial);
    for (let count = 0; count < Math.max(0, Math.floor(recursion)); count += 1) {
        const nested = engine.find(result.value, result.cursor, mode, "auto", snippets, wordDelimiters);
        if (!nested) break;
        result = applyOne(result.value, result.tabstops, nested);
    }
    return result;
}
