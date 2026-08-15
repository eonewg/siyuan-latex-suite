import {describe, expect, it} from "vitest";
import {detectEditorMode} from "../src/editor/session-manager";

describe("detectEditorMode", () => {
    it("uses SiYuan render metadata when available", () => {
        expect(detectEditorMode("inline-math")).toBe("inline");
        expect(detectEditorMode("NodeMathBlock")).toBe("block");
    });

    it("falls back to the visible Chinese editor title", () => {
        expect(detectEditorMode(undefined, "公式块")).toBe("block");
        expect(detectEditorMode(undefined, "行级公式")).toBe("inline");
    });

    it("uses localized labels supplied by SiYuan", () => {
        expect(detectEditorMode(undefined, "Mathematik", "Inline", "Mathematik")).toBe("block");
    });
});
