import type {EditorMode, LatexSuiteSettings} from "../types";
import {MathEditorController} from "./math-editor-controller";
import {MathLiveController} from "./mathlive-controller";
import type {SnippetErrorHandler} from "../core/snippet-engine";

interface EditorToolbar {
    subElement?: HTMLElement;
    subElementCloseCB?: (() => void) | null;
}

interface OpenEditorDetail {
    toolbar?: EditorToolbar;
    renderElement?: HTMLElement;
}

interface Session {
    destroy: () => void;
}

export function detectEditorMode(
    type: string | null | undefined,
    title = "",
    inlineLabel = "",
    blockLabel = "",
): EditorMode | null {
    if (type === "inline-math") return "inline";
    if (type === "NodeMathBlock") return "block";
    const normalized = title.trim();
    if (inlineLabel && normalized === inlineLabel) return "inline";
    if (blockLabel && normalized === blockLabel) return "block";
    if (/行级|inline/i.test(normalized) && /公式|math/i.test(normalized)) return "inline";
    if (/公式块|块级公式|block\s*math|math\s*block/i.test(normalized)) return "block";
    return null;
}

function detectMode(renderElement?: HTMLElement, root?: HTMLElement): EditorMode | null {
    const title = root?.querySelector<HTMLElement>(".fn__flex-1.resize__move")?.innerText ?? "";
    const languages = (window as typeof window & {
        siyuan?: {languages?: Record<string, string>};
    }).siyuan?.languages;
    return detectEditorMode(
        renderElement?.getAttribute("data-type"),
        title,
        languages?.["inline-math"],
        languages?.math,
    );
}

export class EditorSessionManager {
    private readonly sessions = new Map<HTMLElement, Session>();
    private destroyed = false;

    constructor(
        private readonly getSettings: () => LatexSuiteSettings,
        private readonly onConnected: (kind: "native" | "mathlive") => void = () => undefined,
        private readonly onSnippetError?: SnippetErrorHandler,
    ) {}

    public open(event: CustomEvent<OpenEditorDetail>): void {
        if (this.destroyed) return;
        const detail = event.detail;
        const root = detail.toolbar?.subElement;
        if (!root) return;
        this.sessions.get(root)?.destroy();
        const mode = detectMode(detail.renderElement, root);
        if (!mode) return;

        const toolbar = detail.toolbar;
        const originalClose = toolbar?.subElementCloseCB;
        let closed = false;
        let frame: number | null = null;
        let observer: MutationObserver | null = null;
        let controller: {destroy: () => void} | null = null;
        let boundElement: HTMLElement | null = null;
        const destroy = () => {
            if (closed) return;
            closed = true;
            if (frame !== null) cancelAnimationFrame(frame);
            frame = null;
            observer?.disconnect();
            controller?.destroy();
            controller = null;
            boundElement = null;
            if (toolbar && toolbar.subElementCloseCB === wrappedClose) toolbar.subElementCloseCB = originalClose;
            if (this.sessions.get(root) === session) this.sessions.delete(root);
        };
        const wrappedClose = () => {
            if (closed) return;
            try { originalClose?.(); } finally { destroy(); }
        };
        const session: Session = {destroy};
        this.sessions.set(root, session);
        if (toolbar) toolbar.subElementCloseCB = wrappedClose;

        const attach = () => {
            if (closed || this.destroyed || this.sessions.get(root) !== session) return;
            if (root.isConnected === false || toolbar?.subElement !== root) {
                destroy();
                return;
            }
            const mathField = root.querySelector("math-field");
            const textarea = root.querySelector("textarea");
            const element = mathField && MathLiveController.supports(mathField) ? mathField
                : textarea instanceof HTMLTextAreaElement ? textarea : null;
            if (element === boundElement) return;
            controller?.destroy();
            controller = null;
            boundElement = element;
            if (!element) return;
            if (MathLiveController.supports(element)) {
                controller = new MathLiveController(element, mode, this.getSettings, this.onSnippetError);
                this.onConnected("mathlive");
            } else {
                controller = new MathEditorController(element as HTMLTextAreaElement, mode, this.getSettings, this.onSnippetError);
                this.onConnected("native");
            }
        };
        observer = new MutationObserver(attach);
        observer.observe(root, {childList: true, subtree: true});
        attach();
        if (!boundElement && !closed) frame = requestAnimationFrame(() => {
            frame = null;
            attach();
        });
    }

    public scanOpenEditors(): void {
        if (this.destroyed) return;
        for (const root of document.querySelectorAll<HTMLElement>(".protyle-util")) {
            if (root.hidden || root.classList.contains("fn__none")) continue;
            if (this.sessions.has(root) || !root.querySelector("textarea")) continue;
            if (!detectMode(undefined, root)) continue;
            this.open(new CustomEvent<OpenEditorDetail>("latex-suite-scan", {
                detail: {toolbar: {subElement: root}},
            }));
        }
    }

    public destroy(): void {
        this.destroyed = true;
        for (const session of [...this.sessions.values()]) session.destroy();
        this.sessions.clear();
    }
}
