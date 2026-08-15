import {describe, expect, it} from "vitest";
import {TabstopSession} from "../src/core/tabstops";

describe("TabstopSession", () => {
    it("shifts later ranges when the current placeholder grows", () => {
        const session = new TabstopSession([
            {index: 1, from: 6, to: 6},
            {index: 2, from: 8, to: 8},
        ]);
        session.update("before{}", "before{xyz}");
        expect(session.ranges[1]).toEqual({index: 2, from: 11, to: 11});
    });

    it("mirrors repeated tabstop numbers in a textarea", () => {
        const session = new TabstopSession([
            {index: 0, from: 0, to: 1},
            {index: 0, from: 5, to: 6},
            {index: 1, from: 2, to: 3},
            {index: 1, from: 7, to: 8},
        ]);
        const result = session.synchronize("f(x)+f(x)", "foo(x)+f(x)", 3);
        expect(result).toEqual({value: "foo(x)+foo(x)", cursor: 3});
    });
});
