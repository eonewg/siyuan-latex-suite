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

    it.each([false, true])("defers linked tabstop edits until IME commits (final input follows: %s)", async (finalInput) => {
        const textarea = new TestTextarea("dup");
        const controller = new MathEditorController(textarea as unknown as HTMLTextAreaElement, "inline", () => ({
            ...TEST_SETTINGS, snippetsSource: '[{trigger:"dup",replacement:"$0+$0$1",options:"m"}]',
        }));
        textarea.dispatchEvent(new TestKeyboardEvent("Tab"));
        textarea.dispatchEvent(new Event("compositionstart"));
        for (const word of ["zh", "zhong", "中文"]) {
            textarea.value = `${word}+`;
            textarea.setSelectionRange(word.length, word.length);
            textarea.dispatchEvent(new TestInputEvent("input", {inputType: "insertCompositionText", data: word}));
            expect(textarea.value).toBe(`${word}+`);
        }
        textarea.dispatchEvent(new Event("compositionend"));
        if (finalInput) textarea.dispatchEvent(new TestInputEvent("input", {inputType: "insertText", data: "中文"}));
        await Promise.resolve();
        expect(textarea.value).toBe("中文+中文");
        expect(textarea.selectionStart).toBe(2);
        controller.destroy();
    });

    it("drops linked state while disabled and does not reuse it after re-enabling", () => {
        const textarea = new TestTextarea("dup");
        let settings = {...TEST_SETTINGS, snippetsSource: '[{trigger:"dup",replacement:"$0+$0$1",options:"m"}]'};
        const controller = new MathEditorController(textarea as unknown as HTMLTextAreaElement, "inline", () => settings);
        textarea.dispatchEvent(new TestKeyboardEvent("Tab"));
        settings = {...settings, enabled: false};
        textarea.value = "x+";
        textarea.setSelectionRange(1, 1);
        textarea.dispatchEvent(new TestInputEvent("input", {inputType: "insertText", data: "x"}));
        expect(textarea.value).toBe("x+");
        settings = {...settings, enabled: true};
        textarea.value = "xy+";
        textarea.setSelectionRange(2, 2);
        textarea.dispatchEvent(new TestInputEvent("input", {inputType: "insertText", data: "y"}));
        expect(textarea.value).toBe("xy+");
        controller.destroy();
    });

    it("keeps valid linked ranges when an IME composition is cancelled", () => {
        const textarea = new TestTextarea("dup");
        const controller = new MathEditorController(textarea as unknown as HTMLTextAreaElement, "inline", () => ({
            ...TEST_SETTINGS, snippetsSource: '[{trigger:"dup",replacement:"$0+$0$1",options:"m"}]',
        }));
        textarea.dispatchEvent(new TestKeyboardEvent("Tab"));
        textarea.dispatchEvent(new Event("compositionstart"));
        textarea.value = "zh+";
        textarea.setSelectionRange(2, 2);
        textarea.dispatchEvent(new TestInputEvent("input", {inputType: "insertCompositionText"}));
        textarea.value = "+";
        textarea.setSelectionRange(0, 0);
        textarea.dispatchEvent(new Event("compositionend"));
        textarea.value = "x+";
        textarea.setSelectionRange(1, 1);
        textarea.dispatchEvent(new TestInputEvent("input", {inputType: "insertText", data: "x"}));
        expect(textarea.value).toBe("x+x");
        controller.destroy();
    });

    it("does not mirror stale tabstops when native history restores a trigger", () => {
        const textarea = new TestTextarea("dup");
        const controller = new MathEditorController(textarea as unknown as HTMLTextAreaElement, "inline", () => ({
            ...TEST_SETTINGS, snippetsSource: '[{trigger:"dup",replacement:"${0:f}+${0:f}$1",options:"m"}]',
        }));
        textarea.dispatchEvent(new TestKeyboardEvent("Tab"));
        expect(textarea.value).toBe("f+f");
        textarea.value = "dup";
        textarea.setSelectionRange(3, 3);
        textarea.dispatchEvent(new TestInputEvent("input", {inputType: "historyUndo"}));
        expect(textarea.value).toBe("dup");
        textarea.value = "dupx";
        textarea.setSelectionRange(4, 4);
        textarea.dispatchEvent(new TestInputEvent("input", {inputType: "insertText", data: "x"}));
        expect(textarea.value).toBe("dupx");
        controller.destroy();
    });

    it("expands manual snippets and moves between stops with independent configured keys", () => {
        const textarea = new TestTextarea("frac");
        const settings = {...TEST_SETTINGS, tabOut: false, keybindings: {...TEST_SETTINGS.keybindings,
            snippetsTrigger: "Ctrl-j", snippetNextTabstopTrigger: "Ctrl-k", snippetPreviousTabstopTrigger: "Ctrl-h",
        }};
        const controller = new MathEditorController(textarea as unknown as HTMLTextAreaElement, "block", () => settings);
        const oldKey = new TestKeyboardEvent("Tab");
        textarea.dispatchEvent(oldKey);
        expect(oldKey.defaultPrevented).toBe(false);
        expect(textarea.value).toBe("frac");
        textarea.dispatchEvent(new TestKeyboardEvent("j", false, true));
        expect(textarea.value).toBe("\\frac{}{}");
        expect(textarea.selectionStart).toBe(6);
        textarea.dispatchEvent(new TestKeyboardEvent("k", false, true));
        expect(textarea.selectionStart).toBe(8);
        textarea.dispatchEvent(new TestKeyboardEvent("h", false, true));
        expect(textarea.selectionStart).toBe(6);
        controller.destroy();
    });

    it("uses the configured fraction shortcut and leaves literal slashes intact", () => {
        const textarea = new TestTextarea("x");
        const controller = new MathEditorController(textarea as unknown as HTMLTextAreaElement, "block", () => ({
            ...TEST_SETTINGS, keybindings: {...TEST_SETTINGS.keybindings, autofractionTrigger: "Ctrl-/"},
        }));
        const shortcut = new TestKeyboardEvent("/", false, true);
        textarea.dispatchEvent(shortcut);
        expect(shortcut.defaultPrevented).toBe(true);
        expect(textarea.value).toBe("\\frac{x}{}");
        textarea.value = "x/";
        textarea.setSelectionRange(2, 2);
        textarea.dispatchEvent(new TestInputEvent("input", {inputType: "insertText", data: "/"}));
        expect(textarea.value).toBe("x/");
        controller.destroy();
    });

    it("wraps selected text with the configured fraction shortcut", () => {
        const textarea = new TestTextarea("a+x+y+z");
        textarea.setSelectionRange(2, 5);
        const controller = new MathEditorController(textarea as unknown as HTMLTextAreaElement, "block", () => ({
            ...TEST_SETTINGS, keybindings: {...TEST_SETTINGS.keybindings, autofractionTrigger: "Ctrl-/"},
        }));
        textarea.dispatchEvent(new TestKeyboardEvent("/", false, true));
        expect(textarea.value).toBe("a+\\frac{x+y}{}+z");
        controller.destroy();
    });

    it("does not apply the selected-fraction shortcut inside text macros", () => {
        const textarea = new TestTextarea("\\text{path}");
        textarea.setSelectionRange(6, 10);
        const controller = new MathEditorController(textarea as unknown as HTMLTextAreaElement, "block", () => TEST_SETTINGS);
        const shortcut = new TestKeyboardEvent("/");
        textarea.dispatchEvent(shortcut);
        expect(shortcut.defaultPrevented).toBe(false);
        expect(textarea.value).toBe("\\text{path}");
        controller.destroy();
    });

    it("skips a matching typed closer without changing the formula", () => {
        const textarea = new TestTextarea("(x)");
        textarea.setSelectionRange(2, 2);
        const controller = new MathEditorController(textarea as unknown as HTMLTextAreaElement, "block", () => TEST_SETTINGS);
        const closer = new TestKeyboardEvent(")", true);
        textarea.dispatchEvent(closer);
        expect(closer.defaultPrevented).toBe(true);
        expect(textarea.value).toBe("(x)");
        expect(textarea.selectionStart).toBe(3);
        controller.destroy();
    });

    it("navigates nested macro braces in matrices without inserting a column", () => {
        const textarea = new TestTextarea("\\begin{matrix}\\frac{x}{y}\\end{matrix}");
        textarea.setSelectionRange(textarea.value.indexOf("{x}") + 2, textarea.value.indexOf("{x}") + 2);
        const controller = new MathEditorController(textarea as unknown as HTMLTextAreaElement, "block", () => TEST_SETTINGS);
        const before = textarea.value;
        textarea.dispatchEvent(new TestKeyboardEvent("Tab"));
        expect(textarea.value).toBe(before);
        expect(textarea.selectionStart).toBe(before.indexOf("{x}") + 3);
        controller.destroy();
    });

    it("makes single-line matrix rows without newlines and exits to the environment end", () => {
        const textarea = new TestTextarea("\\begin{matrix}x\\end{matrix}+z");
        const cursor = textarea.value.indexOf("x\\end");
        textarea.setSelectionRange(cursor, cursor);
        const controller = new MathEditorController(textarea as unknown as HTMLTextAreaElement, "inline", () => TEST_SETTINGS);
        textarea.dispatchEvent(new TestKeyboardEvent("Enter"));
        expect(textarea.value).not.toContain("\n");
        expect(textarea.value).toContain("\\\\");
        textarea.dispatchEvent(new TestKeyboardEvent("Enter", true));
        expect(textarea.selectionStart).toBe(textarea.value.indexOf("+z"));
        controller.destroy();
    });

    it.each([false, true])("expands once after IME commits (final input follows: %s)", async (finalInput) => {
        const textarea = new TestTextarea("");
        const controller = new MathEditorController(textarea as unknown as HTMLTextAreaElement, "inline", () => ({
            ...TEST_SETTINGS,
            snippetsSource: '[{trigger:"aa",replacement:"bb",options:"mA"},{trigger:"bb",replacement:"cc",options:"mA"}]',
        }));
        textarea.dispatchEvent(new Event("compositionstart"));
        textarea.value = "aa";
        textarea.setSelectionRange(2, 2);
        textarea.dispatchEvent(new TestInputEvent("input", {inputType: "insertCompositionText"}));
        expect(textarea.value).toBe("aa");
        textarea.dispatchEvent(new Event("compositionend"));
        if (finalInput) textarea.dispatchEvent(new TestInputEvent("input", {inputType: "insertText"}));
        await Promise.resolve();
        expect(textarea.value).toBe("bb");
        controller.destroy();
    });

    it("cancels pending IME expansion when the editor is destroyed", async () => {
        const textarea = new TestTextarea("");
        const controller = new MathEditorController(textarea as unknown as HTMLTextAreaElement, "inline", () => TEST_SETTINGS);
        textarea.dispatchEvent(new Event("compositionstart"));
        textarea.value = "@a";
        textarea.setSelectionRange(2, 2);
        textarea.dispatchEvent(new Event("compositionend"));
        controller.destroy();
        await Promise.resolve();
        expect(textarea.value).toBe("@a");
    });

    it("supports reverse tabout and leaves selections intact", () => {
        const textarea = new TestTextarea("a+\\left(x\\right)");
        textarea.setSelectionRange(9, 9);
        const controller = new MathEditorController(textarea as unknown as HTMLTextAreaElement, "inline", () => TEST_SETTINGS);
        const reverse = new TestKeyboardEvent("Tab", true);
        textarea.dispatchEvent(reverse);
        expect(reverse.defaultPrevented).toBe(true);
        expect(textarea.selectionStart).toBe(2);
        textarea.setSelectionRange(8, 9);
        const selected = new TestKeyboardEvent("Tab", true);
        textarea.dispatchEvent(selected);
        expect(selected.defaultPrevented).toBe(false);
        expect([textarea.selectionStart, textarea.selectionEnd]).toEqual([8, 9]);
        controller.destroy();
    });

    it("passes custom text macro configuration through the editor", () => {
        const textarea = new TestTextarea("\\caption{aa");
        const controller = new MathEditorController(textarea as unknown as HTMLTextAreaElement, "inline", () => ({
            ...TEST_SETTINGS, textMacros: {text: [{name: "caption", arguments: [0]}], restricted: []},
            snippetsSource: '[{trigger:"aa",replacement:"ok",options:"TA"}]',
        }));
        textarea.dispatchEvent(new TestInputEvent("input", {data: "a"}));
        expect(textarea.value).toBe("\\caption{ok");
        controller.destroy();
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
