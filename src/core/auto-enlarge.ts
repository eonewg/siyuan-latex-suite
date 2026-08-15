interface Insertion {at: number; text: string;}

export interface AutoEnlargeResult {
    value: string;
    mapPosition: (position: number) => number;
}

const SIZE_CONTROL = /\\(?:left|big|Big|bigg|Bigg|bigl|Bigl|biggl|Biggl)\s*$/;

export function autoEnlargeBrackets(
    value: string,
    triggers: readonly string[],
    addSpace = false,
): AutoEnlargeResult {
    const stack: Array<{char: "(" | "["; index: number}> = [];
    const pairs: Array<{open: number; close: number}> = [];
    for (let index = 0; index < value.length; index += 1) {
        const char = value[index];
        if ((char === "(" || char === "[") && value[index - 1] !== "\\") {
            stack.push({char, index});
        } else if ((char === ")" || char === "]") && value[index - 1] !== "\\") {
            const expected = char === ")" ? "(" : "[";
            const open = stack.at(-1);
            if (open?.char === expected) {
                stack.pop();
                pairs.push({open: open.index, close: index});
            }
        }
    }

    const insertions: Insertion[] = [];
    const space = addSpace ? " " : "";
    for (const pair of pairs) {
        const content = value.slice(pair.open + 1, pair.close);
        if (!triggers.some((trigger) => content.includes(trigger))) continue;
        if (SIZE_CONTROL.test(value.slice(Math.max(0, pair.open - 12), pair.open))) continue;
        insertions.push({at: pair.open, text: `\\left${space}`});
        insertions.push({at: pair.close, text: `${space}\\right`});
    }
    if (insertions.length === 0) return {value, mapPosition: (position) => position};
    insertions.sort((a, b) => a.at - b.at);
    let result = "";
    let cursor = 0;
    for (const insertion of insertions) {
        result += value.slice(cursor, insertion.at) + insertion.text;
        cursor = insertion.at;
    }
    result += value.slice(cursor);
    return {
        value: result,
        mapPosition: (position) => position + insertions
            .filter((insertion) => insertion.at <= position)
            .reduce((sum, insertion) => sum + insertion.text.length, 0),
    };
}
