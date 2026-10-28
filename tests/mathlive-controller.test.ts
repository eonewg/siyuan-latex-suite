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
    public readonly shiftKey: boolean;
    public readonly ctrlKey: boolean;
    public readonly metaKey = false;
    public readonly altKey = false;
    public readonly isComposing = false;

    constructor(key: string, shiftKey = false, ctrlKey = false) {
        super("keydown", {bubbles: true, cancelable: true});
        this.key = key;
        this.shiftKey = shiftKey;
        this.ctrlKey = ctrlKey;
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

    it("leaves a command intact when the trigger starts inside an unmappable MathLive atom", () => {
        class AtomField extends TestMathField {
            public get lastOffset(): number {return 1;}
            public getValue(arg1?: unknown, arg2?: unknown): string {
                if (typeof arg1 === "number" && typeof arg2 === "number") return arg2 === 0 ? "" : this.value;
                return super.getValue(arg1, arg2);
            }
        }
        const field = new AtomField("\\alpha");
        field.position = 1;
        field.selection = 1;
        const insert = vi.spyOn(field, "insert");
        const controller = new MathLiveController(field as unknown as MathFieldElementLike, "inline", () => ({
            ...SETTINGS, snippetsSource: '[{trigger:"alpha",replacement:"beta",options:"mA"}]',
        }));
        field.dispatchEvent(new TestInputEvent("input", {data: "a"}));
        expect(insert).not.toHaveBeenCalled();
        expect(field.value).toBe("\\alpha");
        expect(field.selection).toBe(1);
        controller.destroy();
    });

    it("keeps full trigger boundaries when a shared suffix has no visual offset", () => {
        class AtomField extends TestMathField {
            public get lastOffset(): number {return 1;}
            public getValue(arg1?: unknown, arg2?: unknown): string {
                if (typeof arg1 === "number" && typeof arg2 === "number") return arg2 === 0 ? "" : this.value;
                return super.getValue(arg1, arg2);
            }
            public insert(text: string): boolean {this.value = text; this.position = 1; this.selection = 1; return true;}
        }
        const field = new AtomField("@a");
        field.position = 1;
        field.selection = 1;
        const controller = new MathLiveController(field as unknown as MathFieldElementLike, "inline", () => SETTINGS);
        field.dispatchEvent(new TestInputEvent("input", {data: "a"}));
        expect(field.value).toBe("\\alpha");
        controller.destroy();
    });

    it("uses configured manual and native placeholder shortcuts", () => {
        const field = new TestMathField("frac");
        const execute = vi.fn(() => true);
        const element = field as unknown as MathFieldElementLike;
        element.executeCommand = execute;
        const controller = new MathLiveController(element, "block", () => ({
            ...SETTINGS, keybindings: {...SETTINGS.keybindings,
                snippetsTrigger: "Ctrl-j", snippetNextTabstopTrigger: "Ctrl-k", snippetPreviousTabstopTrigger: "Ctrl-h",
            },
        }));
        field.dispatchEvent(new TestKeyboardEvent("j", false, true));
        expect(field.value).toContain("\\placeholder");
        const next = new TestKeyboardEvent("k", false, true);
        field.dispatchEvent(next);
        expect(execute).toHaveBeenLastCalledWith("moveToNextPlaceholder");
        expect(next.defaultPrevented).toBe(true);
        field.dispatchEvent(new TestKeyboardEvent("h", false, true));
        expect(execute).toHaveBeenLastCalledWith("moveToPreviousPlaceholder");
        controller.destroy();
    });

    it("uses a configured fraction shortcut without retaining the shortcut character", () => {
        const field = new TestMathField("x");
        const controller = new MathLiveController(field as unknown as MathFieldElementLike, "block", () => ({
            ...SETTINGS, keybindings: {...SETTINGS.keybindings, autofractionTrigger: "Ctrl-/"},
        }));
        field.dispatchEvent(new TestKeyboardEvent("/", false, true));
        expect(field.value).toBe("\\frac{x}{\\placeholder{}}\\placeholder{}");
        controller.destroy();
    });

    it("moves to the environment end on Shift+Enter instead of adding a row", () => {
        const field = new TestMathField("\\begin{matrix}x\\end{matrix}+z");
        field.position = field.value.indexOf("x\\end");
        field.selection = field.position;
        const controller = new MathLiveController(field as unknown as MathFieldElementLike, "block", () => SETTINGS);
        const before = field.value;
        const shortcut = new TestKeyboardEvent("Enter", true);
        field.dispatchEvent(shortcut);
        expect(shortcut.defaultPrevented).toBe(true);
        expect(field.value).toBe(before);
        expect(field.position).toBe(before.indexOf("+z"));
        controller.destroy();
    });

    it("skips matching typed closing brackets", () => {
        const field = new TestMathField("[x]");
        field.position = 2;
        field.selection = 2;
        const controller = new MathLiveController(field as unknown as MathFieldElementLike, "inline", () => SETTINGS);
        const closer = new TestKeyboardEvent("]");
        field.dispatchEvent(closer);
        expect(closer.defaultPrevented).toBe(true);
        expect(field.value).toBe("[x]");
        expect(field.position).toBe(3);
        controller.destroy();
    });

    it.each([false, true])("expands once after IME commits (final input follows: %s)", async (finalInput) => {
        const field = new TestMathField("");
        const controller = new MathLiveController(field as unknown as MathFieldElementLike, "inline", () => ({
            ...SETTINGS, snippetsSource: '[{trigger:"aa",replacement:"bb",options:"mA"},{trigger:"bb",replacement:"cc",options:"mA"}]',
        }));
        field.dispatchEvent(new Event("compositionstart"));
        field.value = "aa";
        field.position = 2;
        field.selection = 2;
        field.dispatchEvent(new TestInputEvent("input", {inputType: "insertCompositionText"}));
        expect(field.value).toBe("aa");
        field.dispatchEvent(new Event("compositionend"));
        if (finalInput) field.dispatchEvent(new TestInputEvent("input", {inputType: "insertText"}));
        await Promise.resolve();
        expect(field.value).toBe("bb");
        controller.destroy();
    });

    it("navigates both ways through delimiters without exiting MathLive", () => {
        const field = new TestMathField("a+(x)");
        field.position = 4;
        field.selection = 4;
        const controller = new MathLiveController(field as unknown as MathFieldElementLike, "inline", () => SETTINGS);
        const forward = new TestKeyboardEvent("Tab");
        field.dispatchEvent(forward);
        expect(forward.defaultPrevented).toBe(true);
        expect(field.position).toBe(5);
        field.selection = 5;
        const reverse = new TestKeyboardEvent("Tab", true);
        field.dispatchEvent(reverse);
        expect(reverse.defaultPrevented).toBe(true);
        expect(field.position).toBe(2);
        controller.destroy();
    });

    it("preserves macro context during recursive MathLive expansion", () => {
        const field = new TestMathField("\\caption{aa}");
        field.position = field.value.length - 1;
        field.selection = field.position;
        const controller = new MathLiveController(field as unknown as MathFieldElementLike, "inline", () => ({
            ...SETTINGS, snippetRecursion: 1,
            textMacros: {text: [{name: "caption", arguments: [0]}], restricted: []},
            snippetsSource: '[{trigger:"aa",replacement:"bb",options:"TA"},{trigger:"bb",replacement:"cc",options:"TA"}]',
        }));
        field.dispatchEvent(new TestInputEvent("input", {data: "a"}));
        expect(field.value).toBe("\\caption{cc}");
        controller.destroy();
    });

    it("keeps unchanged text around a recursive match that extends before the initial trigger", () => {
        const field = new TestMathField("z+ab)");
        field.position = 4;
        field.selection = 4;
        const controller = new MathLiveController(field as unknown as MathFieldElementLike, "inline", () => ({
            ...SETTINGS, snippetRecursion: 1,
            snippetsSource: '[{trigger:"b",replacement:"c",options:"mA"},{trigger:"ac",replacement:"done",options:"mA"}]',
        }));
        field.dispatchEvent(new TestInputEvent("input", {data: "b"}));
        expect(field.value).toBe("z+done)");
        controller.destroy();
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
