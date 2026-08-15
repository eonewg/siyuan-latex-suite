import {ProtyleMethod, type IProtyle} from "siyuan";
import type {LatexSuiteSettings} from "../types";

const ZERO_WIDTH_SPACE = "\u200b";

function previousTextNode(root: Node, current: Node): Text | null {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let previous: Text | null = null;
    let node = walker.nextNode() as Text | null;
    while (node) {
        if (node === current) return previous;
        previous = node;
        node = walker.nextNode() as Text | null;
    }
    return previous;
}

/** Return a range covering the requested UTF-16 characters immediately before a collapsed caret. */
export function rangeBeforeCaret(caret: Range, root: Node, length: number): Range | null {
    if (!caret.collapsed || length < 1 || !root.contains(caret.startContainer)) return null;

    let node: Text | null = caret.startContainer.nodeType === Node.TEXT_NODE
        ? caret.startContainer as Text
        : null;
    let offset = node ? caret.startOffset : 0;

    if (!node) {
        const prefix = caret.cloneRange();
        prefix.selectNodeContents(root);
        prefix.setEnd(caret.startContainer, caret.startOffset);
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let candidate = walker.nextNode() as Text | null;
        while (candidate) {
            const candidateRange = document.createRange();
            candidateRange.selectNodeContents(candidate);
            if (prefix.compareBoundaryPoints(Range.END_TO_END, candidateRange) >= 0) node = candidate;
            candidate = walker.nextNode() as Text | null;
        }
        if (!node) return null;
        offset = node.data.length;
    }

    const endNode = caret.startContainer;
    const endOffset = caret.startOffset;
    let remaining = length;
    while (node) {
        if (offset >= remaining) {
            const result = document.createRange();
            result.setStart(node, offset - remaining);
            result.setEnd(endNode, endOffset);
            return result;
        }
        remaining -= offset;
        node = previousTextNode(root, node);
        offset = node?.data.length ?? 0;
    }
    return null;
}

function isPlainEmptyParagraphAfterRemovingTrigger(block: HTMLElement, triggerRange: Range): boolean {
    if (block.getAttribute("data-type") !== "NodeParagraph") return false;
    const editable = block.firstElementChild;
    if (!editable || !editable.contains(triggerRange.commonAncestorContainer)) return false;

    const clone = editable.cloneNode(true) as HTMLElement;
    const relative = document.createRange();
    const startPath: number[] = [];
    let startNode: Node = triggerRange.startContainer;
    while (startNode !== editable) {
        const parent = startNode.parentNode;
        if (!parent) return false;
        startPath.unshift(Array.prototype.indexOf.call(parent.childNodes, startNode));
        startNode = parent;
    }
    let cloneStart: Node = clone;
    for (const index of startPath) {
        const child = cloneStart.childNodes[index];
        if (!child) return false;
        cloneStart = child;
    }
    relative.setStart(cloneStart, triggerRange.startOffset);
    relative.setEnd(cloneStart, triggerRange.endOffset);
    relative.deleteContents();
    clone.querySelectorAll("br, wbr").forEach((item) => item.remove());
    return clone.textContent.replaceAll(ZERO_WIDTH_SPACE, "").trim() === "" && clone.childElementCount === 0;
}

export class TextModeShortcutController {
    private readonly protyles = new Set<IProtyle>();
    private composing = false;

    constructor(private readonly getSettings: () => LatexSuiteSettings) {
        document.addEventListener("beforeinput", this.beforeInput, true);
        document.addEventListener("compositionstart", this.compositionStart, true);
        document.addEventListener("compositionend", this.compositionEnd, true);
    }

    public register(protyle: IProtyle): void {
        this.protyles.add(protyle);
    }

    public unregister(protyle: IProtyle): void {
        this.protyles.delete(protyle);
    }

    public destroy(): void {
        document.removeEventListener("beforeinput", this.beforeInput, true);
        document.removeEventListener("compositionstart", this.compositionStart, true);
        document.removeEventListener("compositionend", this.compositionEnd, true);
        this.protyles.clear();
    }

    private readonly compositionStart = () => {
        this.composing = true;
    };

    private readonly compositionEnd = () => {
        this.composing = false;
    };

    private readonly beforeInput = (event: InputEvent): void => {
        const settings = this.getSettings();
        if (!settings.enabled || !settings.autoSnippets || this.composing || event.isComposing
            || event.inputType !== "insertText" || (event.data !== "k" && event.data !== "m")) return;

        const selection = document.getSelection();
        if (!selection || selection.rangeCount === 0) return;
        const caret = selection.getRangeAt(0);
        if (!caret.collapsed) return;

        const protyle = this.findProtyle(caret.startContainer);
        const wysiwyg = protyle?.wysiwyg?.element;
        const toolbar = protyle?.toolbar;
        if (!protyle || !wysiwyg || !toolbar || !protyle.lute || protyle.disabled) return;

        const instance = protyle.getInstance?.();
        const block = instance?.hasClosestBlock(caret.startContainer);
        if (!instance || !block || block.closest('[data-type="NodeCodeBlock"], [data-type="NodeMathBlock"]')) return;
        if ((caret.startContainer.parentElement?.closest('[data-type~="inline-math"], [data-type~="code"]'))) return;

        const editable = block.firstElementChild;
        if (!editable || !editable.contains(caret.startContainer)) return;
        const triggerRange = rangeBeforeCaret(caret, editable, 1);
        if (!triggerRange) return;

        if (event.data === "k" && triggerRange.toString() === "m") {
            event.preventDefault();
            event.stopPropagation();
            triggerRange.deleteContents();
            triggerRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(triggerRange);
            toolbar.range = triggerRange.cloneRange();
            toolbar.setInlineMark(protyle, "inline-math", "range", {type: "inline-math"});
            return;
        }

        if (event.data === "m" && triggerRange.toString() === "d"
            && isPlainEmptyParagraphAfterRemovingTrigger(block, triggerRange)) {
            event.preventDefault();
            event.stopPropagation();
            triggerRange.deleteContents();
            this.turnIntoMathBlock(protyle, block);
        }
    };

    private findProtyle(node: Node): IProtyle | undefined {
        for (const protyle of this.protyles) {
            if (protyle.wysiwyg?.element?.contains(node)) return protyle;
        }
        return undefined;
    }

    private turnIntoMathBlock(protyle: IProtyle, block: HTMLElement): void {
        const lute = protyle.lute;
        const toolbar = protyle.toolbar;
        if (!lute || !toolbar) return;

        const oldElement = block.cloneNode(true) as HTMLElement;
        oldElement.classList.remove("protyle-wysiwyg--select");
        oldElement.removeAttribute("select-start");
        oldElement.removeAttribute("select-end");
        const oldHTML = oldElement.outerHTML;
        const editable = oldElement.firstElementChild;
        if (!editable) return;
        editable.textContent = "$$";

        const template = document.createElement("template");
        template.innerHTML = lute.SpinBlockDOM(oldElement.outerHTML);
        if (template.content.childElementCount !== 1) return;
        const newElement = template.content.firstElementChild as HTMLElement;
        const id = block.getAttribute("data-node-id");
        if (!id || newElement.getAttribute("data-node-id") !== id
            || newElement.getAttribute("data-type") !== "NodeMathBlock") return;

        block.replaceWith(newElement);
        newElement.setAttribute("data-editing", "true");
        protyle.getInstance().transaction(
            [{action: "update", id, data: newElement.outerHTML}],
            [{action: "update", id, data: oldHTML}],
        );
        ProtyleMethod.mathRender(newElement);
        toolbar.showRender(protyle, newElement);
    }
}
