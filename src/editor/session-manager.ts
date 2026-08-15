import type {EditorMode, LatexSuiteSettings} from "../types";
import {MathEditorController} from "./math-editor-controller";
import {MathLiveController} from "./mathlive-controller";

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

    constructor(
        private readonly getSettings: () => LatexSuiteSettings,
        private readonly onConnected: (kind: "native" | "mathlive") => void = () => undefined,
    ) {}

    public open(event: CustomEvent<OpenEditorDetail>): void {
        const detail = event.detail;
        const root = detail.toolbar?.subElement;
        const mode = detectMode(detail.renderElement, root);
        if (!root || !mode) return;
        this.sessions.get(root)?.destroy();

        const attach = () => {
            const textarea = root.querySelector("textarea");
            if (!(textarea instanceof HTMLTextAreaElement)) return;
            const toolbar = detail.toolbar;
            let controller: {destroy: () => void} = new MathEditorController(textarea, mode, this.getSettings);
            this.onConnected("native");
            let mathLiveAttached = false;
            const attachMathLive = () => {
                if (mathLiveAttached) return;
                const mathField = root.querySelector("math-field");
                if (!mathField || !MathLiveController.supports(mathField)) return;
                controller.destroy();
                controller = new MathLiveController(mathField, mode, this.getSettings);
                mathLiveAttached = true;
                this.onConnected("mathlive");
            };
            const observer = new MutationObserver(attachMathLive);
            observer.observe(root, {childList: true, subtree: true});
            attachMathLive();
            const originalClose = toolbar?.subElementCloseCB;
            let closed = false;
            let wrappedClose: (() => void) | null = null;
            const destroy = () => {
                if (closed) return;
                closed = true;
                observer.disconnect();
                controller.destroy();
                if (toolbar && toolbar.subElementCloseCB === wrappedClose) toolbar.subElementCloseCB = originalClose;
                if (this.sessions.get(root)?.destroy === destroy) this.sessions.delete(root);
            };
            if (toolbar) {
                wrappedClose = () => {
                    try {
                        originalClose?.();
                    } finally {
                        destroy();
                    }
                };
                toolbar.subElementCloseCB = wrappedClose;
            }
            this.sessions.set(root, {destroy});
        };

        if (root.querySelector("textarea")) attach();
        else requestAnimationFrame(attach);
    }

    public scanOpenEditors(): void {
        for (const root of document.querySelectorAll<HTMLElement>(".protyle-util")) {
            if (this.sessions.has(root) || !root.querySelector("textarea")) continue;
            if (!detectMode(undefined, root)) continue;
            this.open(new CustomEvent<OpenEditorDetail>("latex-suite-scan", {
                detail: {toolbar: {subElement: root}},
            }));
        }
    }

    public destroy(): void {
        for (const session of [...this.sessions.values()]) session.destroy();
        this.sessions.clear();
    }
}
