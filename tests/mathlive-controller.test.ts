import {beforeEach, describe, expect, it, vi} from "vitest";
import {MathLiveController, type MathFieldElementLike} from "../src/editor/mathlive-controller";
import {TEST_SETTINGS as SETTINGS} from "./settings-fixture";

class TestInputEvent extends Event {
    public readonly data: string | null;
    public readonly inputType: string;

    constructor(type: string, init: InputEventInit = {}) {
        super(type, init);
        this.data = init.data ?? null;
        this.inputType = init.inputType ?? "";
    }
}

class TestKeyboardEvent extends Event {
    public readonly key: string;
    public readonly shiftKey = false;
    public readonly ctrlKey = false;
    public readonly metaKey = false;
    public readonly altKey = false;
    public readonly isComposing = false;

    constructor(key: string) {
        super("keydown", {bubbles: true, cancelable: true});
        this.key = key;
    }
}

class TestMathField extends EventTarget {
    public value: string;
    public position: number;
    public selection: number | {ranges: Array<[number, number]>; direction?: "forward" | "backward" | "none"};

    constructor(value: string) {
        super();
        this.value = value;
        this.position = value.length;
        this.selection = this.position;
    }

    public get lastOffset(): number {
        return this.value.length;
    }

    public get selectionIsCollapsed(): boolean {
        if (typeof this.selection === "number") return true;
        const range = this.selection.ranges[0];
        return !!range && range[0] === range[1];
    }

    public getValue(arg1?: unknown, arg2?: unknown): string {
        if (typeof arg1 === "number" && typeof arg2 === "number") return this.value.slice(arg1, arg2);
        if (arg1 && typeof arg1 === "object" && "ranges" in arg1) {
            const range = (arg1 as {ranges: Array<[number, number]>}).ranges[0];
            return range ? this.value.slice(range[0], range[1]) : "";
        }
        return this.value;
    }

    public insert(text: string): boolean {
        const range: [number, number] = typeof this.selection === "number"
            ? [this.position, this.position]
            : (this.selection.ranges[0] ?? [this.position, this.position]);
        this.value = this.value.slice(0, range[0]) + text + this.value.slice(range[1]);
        this.position = range[0] + text.length;
        this.selection = this.position;
        return true;
    }
}

describe("MathLiveController", () => {
    beforeEach(() => {
        vi.stubGlobal("InputEvent", TestInputEvent);
    });

    it("expands an automatic snippet in MathLive", () => {
        const field = new TestMathField("@a");
        const controller = new MathLiveController(
            field as unknown as MathFieldElementLike,
            "inline",
            () => SETTINGS,
        );
        field.dispatchEvent(new TestInputEvent("input", {data: "a", bubbles: true}));
        expect(field.value).toBe("\\alpha");
        controller.destroy();
    });

    it("uses native MathLive placeholders for Tab snippets", () => {
        const field = new TestMathField("frac");
        const controller = new MathLiveController(
            field as unknown as MathFieldElementLike,
            "block",
            () => SETTINGS,
        );
        const event = new TestKeyboardEvent("Tab");
        field.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(true);
        expect(field.value).toBe("\\frac{\\placeholder{}}{\\placeholder{}}\\placeholder{}");
        controller.destroy();
    });

    it("matches and replaces triggerAfter text after the MathLive cursor", () => {
        const field = new TestMathField("a)");
        field.position = 1;
        field.selection = 1;
        const controller = new MathLiveController(
            field as unknown as MathFieldElementLike,
            "inline",
            () => ({
                ...SETTINGS,
                snippetsSource: `[{trigger: "a", triggerAfter: ")", replacement: "b", options: "mA"}]`,
            }),
        );
        field.dispatchEvent(new TestInputEvent("input", {data: "a", bubbles: true}));
        expect(field.value).toBe("b");
        controller.destroy();
    });

    it("does not run automatic snippets for a MathLive deletion event", () => {
        const field = new TestMathField("\\dot}");
        field.position = 4;
        field.selection = 4;
        const controller = new MathLiveController(
            field as unknown as MathFieldElementLike,
            "block",
            () => ({
                ...SETTINGS,
                snippetsSource: `[{trigger: "dot", replacement: "\\\\dot{$0}$1", options: "mA"}]`,
            }),
        );
        field.dispatchEvent(new TestInputEvent("input", {
            inputType: "deleteContentBackward",
            bubbles: true,
        }));
        expect(field.value).toBe("\\dot}");
        controller.destroy();
    });
});
