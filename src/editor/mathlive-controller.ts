import {createAutoFraction, createSelectionFraction} from "../core/fraction";
import {autoEnlargeBrackets} from "../core/auto-enlarge";
import {activeMatrixEnvironment, currentMatrixLinePrefix} from "../core/navigation";
import {getCompiledSnippets} from "../core/snippet-parser";
import {SnippetEngine} from "../core/snippet-engine";
import {matchesKeyBinding} from "../core/keyboard";
import {isInsertionInput} from "../core/input";
import {applyWithRecursion} from "../core/recursion";
import type {EditorMode, Expansion, LatexSuiteSettings, SnippetDefinition, TabstopRange} from "../types";

type MathLiveRange = [number, number];

interface MathLiveSelection {
    ranges: MathLiveRange[];
    direction?: "forward" | "backward" | "none";
}

export interface MathFieldElementLike extends HTMLElement {
    value: string;
    position: number;
    readonly lastOffset: number;
    selection: MathLiveSelection | number;
    readonly selectionIsCollapsed: boolean;
    getValue(format?: string): string;
    getValue(start: number, end: number, format?: string): string;
    getValue(selection: MathLiveSelection, format?: string): string;
    insert(value: string, options?: {
        format?: "latex" | "auto";
        insertionMode?: "replaceSelection" | "replaceAll" | "insertBefore" | "insertAfter";
        selectionMode?: "placeholder" | "after" | "before" | "item";
        focus?: boolean;
        feedback?: boolean;
        scrollIntoView?: boolean;
    }): boolean;
}

function isMathFieldElement(element: Element): element is MathFieldElementLike {
    const candidate = element as Partial<MathFieldElementLike>;
    return element.tagName.toLowerCase() === "math-field"
        && typeof candidate.getValue === "function"
        && typeof candidate.insert === "function";
}

function mathLiveTemplate(text: string, tabstops: readonly TabstopRange[]): string {
    let result = text;
    const ordered = [...tabstops].sort((a, b) => b.from - a.from || b.to - a.to);
    for (const range of ordered) {
        const content = result.slice(range.from, range.to);
        result = `${result.slice(0, range.from)}\\placeholder{${content}}${result.slice(range.to)}`;
    }
    return result;
}

export class MathLiveController {
    private readonly engine = new SnippetEngine();
    private composing = false;
    private internalUpdate = false;

    public static supports(element: Element): element is MathFieldElementLike {
        return isMathFieldElement(element);
    }

    constructor(
        private readonly field: MathFieldElementLike,
        private readonly mode: EditorMode,
        private readonly getSettings: () => LatexSuiteSettings,
    ) {
        field.addEventListener("input", this.onInput);
        field.addEventListener("keydown", this.onKeydown, true);
        field.addEventListener("compositionstart", this.onCompositionStart);
        field.addEventListener("compositionend", this.onCompositionEnd);
    }

    public destroy(): void {
        this.field.removeEventListener("input", this.onInput);
        this.field.removeEventListener("keydown", this.onKeydown, true);
        this.field.removeEventListener("compositionstart", this.onCompositionStart);
        this.field.removeEventListener("compositionend", this.onCompositionEnd);
    }

    private readonly onCompositionStart = () => {
        this.composing = true;
    };

    private readonly onCompositionEnd = () => {
        this.composing = false;
    };

    private snippets(settings: LatexSuiteSettings): readonly SnippetDefinition[] {
        return getCompiledSnippets(settings.snippetsSource, settings.snippetVariablesSource);
    }

    private latexContext(): {latex: string; cursor: number; offset: number} {
        const offset = Math.max(0, Math.min(this.field.position, this.field.lastOffset));
        const before = this.field.getValue(0, offset, "latex");
        return {latex: this.field.getValue("latex"), cursor: before.length, offset};
    }

    private readonly onInput = (event: Event) => {
        const settings = this.getSettings();
        if (this.internalUpdate || (settings.suppressSnippetTriggerOnIME && this.composing)
            || !settings.enabled || !this.field.selectionIsCollapsed) return;
        if (!isInsertionInput(event)) return;
        const context = this.latexContext();
        if (settings.autoSnippets) {
            const expansion = this.engine.find(
                context.latex,
                context.cursor,
                this.mode,
                "auto",
                this.snippets(settings),
                settings.wordDelimiters,
            );
            if (expansion) {
                this.commit(expansion, context.latex);
                return;
            }
        }
        const input = event as InputEvent;
        if (settings.autoFraction && (input.data === "/" || context.latex[context.cursor - 1] === "/")) {
            const expansion = createAutoFraction(context.latex, context.cursor, settings);
            if (expansion) this.commit(expansion, context.latex);
        }
    };

    private readonly onKeydown = (event: KeyboardEvent) => {
        const settings = this.getSettings();
        if (!settings.enabled || (settings.suppressSnippetTriggerOnIME && (this.composing || event.isComposing))) return;
        const selection = this.field.selection;
        const selectedLatex = typeof selection === "number" ? "" : this.field.getValue(selection, "latex");
        const snippets = this.snippets(settings);
        const context = this.latexContext();

        if (settings.autoFraction && selectedLatex && event.key === "/") {
            const expansion = createSelectionFraction(selectedLatex, 0, selectedLatex.length, settings.autoFractionSymbol);
            if (expansion) {
                this.consume(event);
                this.insert(expansion);
                return;
            }
        }

        if (settings.visualSnippets && selectedLatex && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
            const expansion = this.engine.findVisual(
                event.key,
                selectedLatex,
                0,
                selectedLatex.length,
                this.mode,
                snippets,
                context.latex,
                typeof selection === "number"
                    ? context.cursor
                    : this.field.getValue(0, Math.min(...(selection.ranges[0] ?? [context.offset, context.offset])), "latex").length,
            );
            if (expansion) {
                this.consume(event);
                this.insert(expansion);
                return;
            }
        }

        if (settings.tabSnippets && !selectedLatex) {
            const keyedSnippets = snippets.filter((snippet) => snippet.triggerKey
                && matchesKeyBinding(event, snippet.triggerKey));
            if (keyedSnippets.length > 0) {
                const expansion = this.engine.find(
                    context.latex,
                    context.cursor,
                    this.mode,
                    "tab",
                    keyedSnippets,
                    settings.wordDelimiters,
                );
                if (expansion) {
                    this.consume(event);
                    this.commit(expansion, context.latex);
                    return;
                }
            }
        }

        if (event.key === "Tab" && !event.ctrlKey && !event.metaKey && !event.altKey) {
            const value = this.field.getValue("latex");
            if (value.includes("\\placeholder")) return;
            if (!event.shiftKey && settings.tabSnippets) {
                const expansion = this.engine.find(
                    context.latex,
                    context.cursor,
                    this.mode,
                    "tab",
                    snippets.filter((snippet) => !snippet.triggerKey && !(snippet.options ?? "").includes("A")),
                    settings.wordDelimiters,
                );
                if (expansion) {
                    this.consume(event);
                    this.commit(expansion, context.latex);
                    return;
                }
            }
            if (!event.shiftKey && settings.matrixShortcuts
                && activeMatrixEnvironment(context.latex, context.cursor, settings.matrixEnvironments, settings.matrixMacros)) {
                this.consume(event);
                this.insert({from: 0, to: 0, text: " & ", tabstops: []});
                return;
            }
            if (!event.shiftKey && settings.tabOut
                && (!settings.tabOutExitOnlyAtEnd || this.field.position >= this.field.lastOffset)) {
                this.consume(event);
                requestAnimationFrame(() => this.field.dispatchEvent(new KeyboardEvent("keydown", {
                    key: "Escape",
                    bubbles: true,
                    cancelable: true,
                })));
            }
            return;
        }

        if (event.key === "Enter" && settings.matrixShortcuts) {
            if (activeMatrixEnvironment(context.latex, context.cursor, settings.matrixEnvironments, settings.matrixMacros)) {
                this.consume(event);
                const text = " \\\\" + "\n" + currentMatrixLinePrefix(context.latex, context.cursor);
                this.insert({from: 0, to: 0, text, tabstops: []});
            }
        }
    };

    private commit(expansion: Expansion, latex: string): void {
        const startOffset = this.findOffsetForLatexIndex(latex, expansion.from);
        const endOffset = this.findOffsetForLatexIndex(latex, expansion.to);
        this.field.selection = {ranges: [[startOffset, endOffset]], direction: "forward"};
        this.insert(expansion);
    }

    private findOffsetForLatexIndex(latex: string, index: number): number {
        const prefix = latex.slice(0, index);
        let nearest = 0;
        let nearestLength = 0;
        for (let offset = 0; offset <= this.field.lastOffset; offset += 1) {
            const candidate = this.field.getValue(0, offset, "latex");
            if (candidate === prefix) return offset;
            if (candidate.length <= index && candidate.length >= nearestLength) {
                nearest = offset;
                nearestLength = candidate.length;
            }
        }
        return nearest;
    }

    private insert(expansion: Expansion): void {
        const settings = this.getSettings();
        const applied = applyWithRecursion(
            "",
            {...expansion, from: 0, to: 0},
            this.mode,
            this.snippets(settings),
            settings.wordDelimiters,
            settings.snippetRecursion,
            this.engine,
        );
        expansion = {...expansion, text: applied.value, tabstops: applied.tabstops};
        if (this.mode === "inline" && settings.removeSnippetWhitespace && /\s$/.test(expansion.text)) {
            const text = expansion.text.trimEnd();
            expansion = {
                ...expansion,
                text,
                tabstops: expansion.tabstops.map((range) => ({
                    ...range,
                    from: Math.min(range.from, text.length),
                    to: Math.min(range.to, text.length),
                })),
            };
        }
        if (settings.autoEnlargeBrackets) {
            const enlarged = autoEnlargeBrackets(expansion.text, settings.autoEnlargeBracketTriggers, settings.autoEnlargeBracketSpace);
            expansion = {
                ...expansion,
                text: enlarged.value,
                tabstops: expansion.tabstops.map((range) => ({
                    ...range,
                    from: enlarged.mapPosition(range.from),
                    to: enlarged.mapPosition(range.to),
                })),
            };
        }
        this.internalUpdate = true;
        try {
            this.field.insert(mathLiveTemplate(expansion.text, expansion.tabstops), {
                format: "latex",
                insertionMode: "replaceSelection",
                selectionMode: expansion.tabstops.length > 0 ? "placeholder" : "after",
                focus: true,
                feedback: false,
                scrollIntoView: true,
            });
            this.field.dispatchEvent(new InputEvent("input", {
                bubbles: true,
                cancelable: true,
                inputType: "insertReplacementText",
                data: expansion.text,
            }));
        } finally {
            this.internalUpdate = false;
        }
    }

    private consume(event: KeyboardEvent): void {
        event.preventDefault();
        event.stopPropagation();
    }
}
