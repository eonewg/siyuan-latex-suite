import {beforeEach, describe, expect, it, vi} from "vitest";
import {MathEditorController} from "../src/editor/math-editor-controller";
import {TEST_SETTINGS} from "./settings-fixture";

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
    public readonly metaKey: boolean;
    public readonly altKey: boolean;
    public readonly isComposing = false;

    constructor(key: string, shiftKey = false, ctrlKey = false, metaKey = false, altKey = false) {
        super("keydown", {bubbles: true, cancelable: true});
        this.key = key;
        this.shiftKey = shiftKey;
        this.ctrlKey = ctrlKey;
        this.metaKey = metaKey;
        this.altKey = altKey;
    }
}

class TestTextarea extends EventTarget {
    public value: string;
    public selectionStart: number;
    public selectionEnd: number;

    constructor(value: string) {
        super();
        this.value = value;
        this.selectionStart = value.length;
        this.selectionEnd = value.length;
    }

    public setSelectionRange(from: number, to: number): void {
        this.selectionStart = from;
        this.selectionEnd = to;
    }
}

describe("MathEditorController", () => {
    beforeEach(() => {
        vi.stubGlobal("InputEvent", TestInputEvent);
        vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
            callback(0);
            return 0;
        });
    });

    it("applies an auto-fraction through the input event pipeline", () => {
        const textarea = new TestTextarea("x");
        const controller = new MathEditorController(
            textarea as unknown as HTMLTextAreaElement,
            "inline",
            () => ({...TEST_SETTINGS}),
        );
        textarea.value = "x/";
        textarea.setSelectionRange(2, 2);
        textarea.dispatchEvent(new TestInputEvent("input", {data: "/", bubbles: true}));
        expect(textarea.value).toBe("\\frac{x}{}");
        expect([textarea.selectionStart, textarea.selectionEnd]).toEqual([9, 9]);
        controller.destroy();
    });

    it("expands a full Greek letter name as typed in SiYuan's source editor", () => {
        const textarea = new TestTextarea("alph");
        const controller = new MathEditorController(
            textarea as unknown as HTMLTextAreaElement,
            "block",
            () => ({...TEST_SETTINGS}),
        );
        textarea.value = "alpha";
        textarea.setSelectionRange(5, 5);
        textarea.dispatchEvent(new TestInputEvent("input", {data: "a", bubbles: true}));
        expect(textarea.value).toBe("\\alpha");
        controller.destroy();
    });

    it("expands a Tab snippet and advances through its tabstops", () => {
        const textarea = new TestTextarea("frac");
        const controller = new MathEditorController(
            textarea as unknown as HTMLTextAreaElement,
            "block",
            () => ({...TEST_SETTINGS}),
        );
        const expand = new TestKeyboardEvent("Tab");
        textarea.dispatchEvent(expand);
        expect(expand.defaultPrevented).toBe(true);
        expect(textarea.value).toBe("\\frac{}{}");
        expect([textarea.selectionStart, textarea.selectionEnd]).toEqual([6, 6]);

        textarea.value = "\\frac{x}{}";
        textarea.setSelectionRange(7, 7);
        textarea.dispatchEvent(new TestInputEvent("input", {data: "x", bubbles: true}));
        textarea.dispatchEvent(new TestKeyboardEvent("Tab"));
        expect([textarea.selectionStart, textarea.selectionEnd]).toEqual([9, 9]);
        controller.destroy();
    });

    it("honors a snippet-specific CodeMirror trigger key", () => {
        const textarea = new TestTextarea("hot");
        const controller = new MathEditorController(
            textarea as unknown as HTMLTextAreaElement,
            "block",
            () => ({
                ...TEST_SETTINGS,
                snippetsSource: `[{trigger: "hot", replacement: "\\\\operatorname{hot}", options: "m", triggerKey: "Ctrl-h"}]`,
            }),
        );
        const shortcut = new TestKeyboardEvent("h", false, true);
        textarea.dispatchEvent(shortcut);
        expect(shortcut.defaultPrevented).toBe(true);
        expect(textarea.value).toBe("\\operatorname{hot}");
        controller.destroy();
    });

    it("does not jump over a closing symbol when tabout is disabled", () => {
        const textarea = new TestTextarea("(x)");
        textarea.setSelectionRange(2, 2);
        const controller = new MathEditorController(
            textarea as unknown as HTMLTextAreaElement,
            "block",
            () => ({...TEST_SETTINGS, tabOut: false}),
        );
        const tab = new TestKeyboardEvent("Tab");
        textarea.dispatchEvent(tab);
        expect(tab.defaultPrevented).toBe(false);
        expect([textarea.selectionStart, textarea.selectionEnd]).toEqual([2, 2]);
        controller.destroy();
    });

    it("mirrors repeated tabstops without corrupting the following stop", () => {
        const textarea = new TestTextarea("dup");
        const controller = new MathEditorController(
            textarea as unknown as HTMLTextAreaElement,
            "block",
            () => ({
                ...TEST_SETTINGS,
                snippetsSource: `[{trigger: "dup", replacement: "\${0:f}(x)+\${0:f}(x)$1", options: "m"}]`,
            }),
        );
        textarea.dispatchEvent(new TestKeyboardEvent("Tab"));
        textarea.value = "foo(x)+f(x)";
        textarea.setSelectionRange(3, 3);
        textarea.dispatchEvent(new TestInputEvent("input", {data: "oo", bubbles: true}));
        expect(textarea.value).toBe("foo(x)+foo(x)");
        textarea.dispatchEvent(new TestKeyboardEvent("Tab"));
        expect([textarea.selectionStart, textarea.selectionEnd]).toEqual([13, 13]);
        controller.destroy();
    });

    it("does not re-expand a snippet when Backspace exposes its trigger", () => {
        const textarea = new TestTextarea("dot");
        const controller = new MathEditorController(
            textarea as unknown as HTMLTextAreaElement,
            "block",
            () => ({
                ...TEST_SETTINGS,
                snippetsSource: `[{trigger: "dot", replacement: "\\\\dot{$0}$1", options: "mA"}]`,
            }),
        );
        textarea.dispatchEvent(new TestInputEvent("input", {
            data: "t",
            inputType: "insertText",
            bubbles: true,
        }));
        expect(textarea.value).toBe("\\dot{}");
        expect([textarea.selectionStart, textarea.selectionEnd]).toEqual([5, 5]);

        // Browser result after deleting the opening brace at `\\dot{|}`.
        textarea.value = "\\dot}";
        textarea.setSelectionRange(4, 4);
        textarea.dispatchEvent(new TestInputEvent("input", {
            inputType: "deleteContentBackward",
            bubbles: true,
        }));
        expect(textarea.value).toBe("\\dot}");
        expect([textarea.selectionStart, textarea.selectionEnd]).toEqual([4, 4]);
        controller.destroy();
    });
});
