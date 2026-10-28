import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {detectEditorMode, EditorSessionManager} from "../src/editor/session-manager";
import {TEST_SETTINGS} from "./settings-fixture";

class Field extends EventTarget {
    tagName = "TEXTAREA";
    value = "";
    selectionStart = 0;
    selectionEnd = 0;
    setSelectionRange(from: number, to: number): void {this.selectionStart = from; this.selectionEnd = to;}
}

class MathField extends EventTarget {
    tagName = "MATH-FIELD";
    value = "";
    position = 0;
    selection = 0;
    lastOffset = 0;
    selectionIsCollapsed = true;
    getValue(): string {return this.value;}
    insert(): boolean {return true;}
}

class Root {
    isConnected = true;
    hidden = false;
    hiddenClass = false;
    classList = {contains: (name: string) => name === "fn__none" && this.hiddenClass};
    textarea: Field | null = null;
    mathField: MathField | null = null;
    querySelector(selector: string): Field | MathField | {innerText: string} | null {
        if (selector === ".fn__flex-1.resize__move") return {innerText: "公式块"};
        return selector === "textarea" ? this.textarea : selector === "math-field" ? this.mathField : null;
    }
}

describe("editor session lifecycle", () => {
    let frames: Map<number, FrameRequestCallback>;
    let observers: Array<{callback: () => void; disconnect: ReturnType<typeof vi.fn>}>;
    beforeEach(() => {
        frames = new Map();
        observers = [];
        let sequence = 0;
        vi.stubGlobal("window", {siyuan: {languages: {}}});
        vi.stubGlobal("HTMLTextAreaElement", Field);
        vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {frames.set(++sequence, callback); return sequence;});
        vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
        vi.stubGlobal("MutationObserver", class {
            disconnect = vi.fn();
            constructor(readonly callback: () => void) {observers.push(this);}
            observe(): void {}
        });
    });
    afterEach(() => vi.unstubAllGlobals());
    const open = (manager: EditorSessionManager, root: Root, close = vi.fn()) => {
        const toolbar = {subElement: root as unknown as HTMLElement, subElementCloseCB: close};
        manager.open({detail: {toolbar, renderElement: {getAttribute: () => "NodeMathBlock"}}} as unknown as CustomEvent);
        return toolbar;
    };

    it("cancels pending attachment on destroy, including a callback already queued", () => {
        const connected = vi.fn();
        const manager = new EditorSessionManager(() => TEST_SETTINGS, connected);
        const root = new Root();
        open(manager, root);
        const queued = [...frames.values()][0]!;
        manager.destroy();
        root.textarea = new Field();
        queued(0);
        observers[0]!.callback();
        expect(frames.size).toBe(0);
        expect(connected).not.toHaveBeenCalled();
        expect(observers[0]!.disconnect).toHaveBeenCalled();
    });

    it("tracks close callbacks before an editor appears", () => {
        const connected = vi.fn();
        const close = vi.fn();
        const manager = new EditorSessionManager(() => TEST_SETTINGS, connected);
        const root = new Root();
        const toolbar = open(manager, root, close);
        const queued = [...frames.values()][0]!;
        toolbar.subElementCloseCB();
        root.textarea = new Field();
        queued(0);
        expect(connected).not.toHaveBeenCalled();
        expect(close).toHaveBeenCalledTimes(1);
        expect(toolbar.subElementCloseCB).toBe(close);
        manager.destroy();
    });

    it("does not call a stale close handler after its session has ended", () => {
        const close = vi.fn();
        const manager = new EditorSessionManager(() => TEST_SETTINGS);
        const root = new Root();
        root.textarea = new Field();
        const toolbar = open(manager, root, close);
        const staleClose = toolbar.subElementCloseCB;
        staleClose();
        staleClose();
        expect(close).toHaveBeenCalledTimes(1);
        manager.destroy();
    });

    it("does not reattach a closed hidden panel during a delayed startup scan", () => {
        const connected = vi.fn();
        const manager = new EditorSessionManager(() => TEST_SETTINGS, connected);
        const root = new Root();
        root.textarea = new Field();
        const toolbar = open(manager, root);
        toolbar.subElementCloseCB();
        root.hiddenClass = true;
        vi.stubGlobal("document", {querySelectorAll: () => [root]});
        manager.scanOpenEditors();
        expect(connected).toHaveBeenCalledTimes(1);
        manager.destroy();
    });

    it("allows only the newest session to attach when a panel is reused", () => {
        const connected = vi.fn();
        const manager = new EditorSessionManager(() => TEST_SETTINGS, connected);
        const root = new Root();
        open(manager, root);
        const oldFrame = [...frames.values()][0]!;
        open(manager, root);
        root.textarea = new Field();
        oldFrame(0);
        expect(connected).not.toHaveBeenCalled();
        [...frames.values()][0]!(0);
        expect(connected).toHaveBeenCalledTimes(1);
        manager.destroy();
    });

    it("unbinds replaced editors and switches between native and MathLive", () => {
        const connected = vi.fn();
        const manager = new EditorSessionManager(() => TEST_SETTINGS, connected);
        const root = new Root();
        const first = root.textarea = new Field();
        const removed = vi.spyOn(first, "removeEventListener");
        open(manager, root);
        const mathField = root.mathField = new MathField();
        const mathRemoved = vi.spyOn(mathField, "removeEventListener");
        observers[0]!.callback();
        expect(removed).toHaveBeenCalledTimes(4);
        root.mathField = null;
        root.textarea = new Field();
        observers[0]!.callback();
        expect(mathRemoved).toHaveBeenCalledTimes(4);
        expect(connected.mock.calls.map(([kind]) => kind)).toEqual(["native", "mathlive", "native"]);
        manager.destroy();
    });

    it("rejects detached panels and ignores opens after manager destruction", () => {
        const connected = vi.fn();
        const manager = new EditorSessionManager(() => TEST_SETTINGS, connected);
        const root = new Root();
        root.isConnected = false;
        root.textarea = new Field();
        open(manager, root);
        expect(connected).not.toHaveBeenCalled();
        manager.destroy();
        root.isConnected = true;
        open(manager, root);
        expect(connected).not.toHaveBeenCalled();
    });
});

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
