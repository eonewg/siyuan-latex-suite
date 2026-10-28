import {createAutoFraction, createSelectionFraction, createShortcutFraction} from "../core/fraction";
import {autoEnlargeBrackets} from "../core/auto-enlarge";
import {nextClosingPosition, previousOpeningPosition} from "../core/navigation";
import {getCompiledSnippets} from "../core/snippet-parser";
import {SnippetEngine, type SnippetErrorHandler} from "../core/snippet-engine";
import {DEFAULT_KEYBINDINGS, matchesKeyBinding} from "../core/keyboard";
import {resolveMatrixAction, taboutDirection} from "../core/editor-actions";
import {isMathInputContext} from "../core/context";
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
    executeCommand?(command: string): boolean;
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
    private readonly engine: SnippetEngine;
    private composing = false;
    private internalUpdate = false;
    private destroyed = false;
    private inputRevision = 0;
    private compositionValue = "";
    private offsetCache: {latex: string; lastOffset: number; next: number; positions: Map<number, number>} | null = null;

    public static supports(element: Element): element is MathFieldElementLike {
        return isMathFieldElement(element);
    }

    constructor(
        private readonly field: MathFieldElementLike,
        private readonly mode: EditorMode,
        private readonly getSettings: () => LatexSuiteSettings,
        onSnippetError?: SnippetErrorHandler,
    ) {
        this.engine = new SnippetEngine(onSnippetError);
        field.addEventListener("input", this.onInput);
        field.addEventListener("keydown", this.onKeydown, true);
        field.addEventListener("compositionstart", this.onCompositionStart);
        field.addEventListener("compositionend", this.onCompositionEnd);
    }

    public destroy(): void {
        this.destroyed = true;
        this.field.removeEventListener("input", this.onInput);
        this.field.removeEventListener("keydown", this.onKeydown, true);
        this.field.removeEventListener("compositionstart", this.onCompositionStart);
        this.field.removeEventListener("compositionend", this.onCompositionEnd);
    }

    private readonly onCompositionStart = () => {
        this.composing = true;
        this.compositionValue = this.field.getValue("latex");
    };

    private readonly onCompositionEnd = () => {
        this.composing = false;
        if (!this.getSettings().suppressSnippetTriggerOnIME || this.field.getValue("latex") === this.compositionValue) return;
        const revision = this.inputRevision;
        queueMicrotask(() => {
            if (!this.destroyed && !this.composing && this.inputRevision === revision) {
                this.onInput(new InputEvent("input", {inputType: "insertCompositionText"}));
            }
        });
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
        if (!this.internalUpdate) {
            this.inputRevision += 1;
            this.offsetCache = null;
        }
        const settings = this.getSettings();
        if (this.internalUpdate || (settings.suppressSnippetTriggerOnIME && (this.composing || (event as InputEvent).isComposing))
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
                settings.textMacros,
            );
            if (expansion) {
                this.commit(expansion, context.latex);
                return;
            }
        }
        const input = event as InputEvent;
        if (settings.autoFraction && (settings.keybindings ?? DEFAULT_KEYBINDINGS).autofractionTrigger === "/"
            && (input.data === "/" || context.latex[context.cursor - 1] === "/")) {
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
        const selectionStart = typeof selection === "number" ? context.cursor
            : this.field.getValue(0, Math.min(...(selection.ranges[0] ?? [context.offset, context.offset])), "latex").length;
        const keys = settings.keybindings ?? DEFAULT_KEYBINDINGS;

        if (settings.autoFraction && selectedLatex && matchesKeyBinding(event, keys.autofractionTrigger)
            && isMathInputContext(context.latex, selectionStart, settings.textMacros)) {
            const expansion = createSelectionFraction(selectedLatex, selectionStart, selectionStart + selectedLatex.length, settings.autoFractionSymbol);
            if (expansion) {
                this.consume(event);
                this.commit(expansion, context.latex);
                return;
            }
        }

        if (settings.visualSnippets && selectedLatex && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
            const expansion = this.engine.findVisual(
                event.key,
                selectedLatex,
                selectionStart,
                selectionStart + selectedLatex.length,
                this.mode,
                snippets,
                context.latex,
                selectionStart,
                settings.textMacros,
            );
            if (expansion) {
                this.consume(event);
                this.commit(expansion, context.latex);
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
                    settings.textMacros,
                );
                if (expansion) {
                    this.consume(event);
                    this.commit(expansion, context.latex);
                    return;
                }
            }
        }

        const previousStop = matchesKeyBinding(event, keys.snippetPreviousTabstopTrigger);
        if (this.field.getValue("latex").includes("\\placeholder")) {
            if (previousStop || matchesKeyBinding(event, keys.snippetNextTabstopTrigger)) {
                // Use native placeholders; do not close the panel if MathLive
                // cannot perform the configured navigation.
                if (this.field.executeCommand?.(previousStop ? "moveToPreviousPlaceholder" : "moveToNextPlaceholder")) this.consume(event);
                return;
            }
            if (event.key === "Tab") return;
        }

        if (this.field.selectionIsCollapsed && settings.tabSnippets && matchesKeyBinding(event, keys.snippetsTrigger)) {
            const expansion = this.engine.find(
                context.latex, context.cursor, this.mode, "tab",
                snippets.filter((snippet) => !snippet.triggerKey && !(snippet.options ?? "").includes("A")),
                settings.wordDelimiters, settings.textMacros,
            );
            if (expansion) {
                this.consume(event);
                this.commit(expansion, context.latex);
                return;
            }
        }
        if (!this.field.selectionIsCollapsed) return;

        if (settings.autoFraction && keys.autofractionTrigger !== "/" && matchesKeyBinding(event, keys.autofractionTrigger)) {
            const expansion = createShortcutFraction(context.latex, context.cursor, settings);
            if (expansion) {
                this.consume(event);
                this.commit(expansion, context.latex);
                return;
            }
        }

        const matrixAction = resolveMatrixAction(context.latex, context.cursor, event, settings);
        if (matrixAction) {
            if (matrixAction.kind === "move") {
                if (this.moveToLatexPosition(context.latex, matrixAction.position)) this.consume(event);
            } else {
                this.consume(event);
                this.insert({from: 0, to: 0, text: matrixAction.text, tabstops: []});
            }
            return;
        }

        const direction = taboutDirection(context.latex, context.cursor, event, settings);
        if (!direction) return;
        const destination = direction === "backward" ? previousOpeningPosition(context.latex, context.cursor)
            : nextClosingPosition(context.latex, context.cursor, new Set(settings.tabOutClosingSymbols));
        if (destination !== null) {
            if (this.moveToLatexPosition(context.latex, destination)) this.consume(event);
            return;
        }
        if (!settings.tabOutExitOnlyAtEnd || (direction === "backward"
            ? context.latex.slice(0, context.cursor).trim().length === 0
            : context.latex.slice(context.cursor).trim().length === 0)) {
            this.consume(event);
            requestAnimationFrame(() => {
                if (!this.destroyed) this.field.dispatchEvent(new KeyboardEvent("keydown", {
                    key: "Escape", bubbles: true, cancelable: true,
                }));
            });
        }
    };

    private moveToLatexPosition(latex: string, index: number): boolean {
        const offset = this.findOffsetForLatexIndex(latex, index);
        // Serialization positions inside a command may have no visual offset.
        if (offset === null || offset === this.field.position) return false;
        this.field.position = offset;
        return true;
    }

    private commit(expansion: Expansion, latex: string): void {
        this.insert(expansion, latex);
    }

    private findOffsetForLatexIndex(latex: string, index: number): number | null {
        if (index < 0 || index > latex.length) return null;
        if (!this.offsetCache || this.offsetCache.latex !== latex || this.offsetCache.lastOffset !== this.field.lastOffset) {
            this.offsetCache = {latex, lastOffset: this.field.lastOffset, next: 0, positions: new Map()};
        }
        const cache = this.offsetCache;
        if (cache.positions.has(index)) {
            const offset = cache.positions.get(index)!;
            if (this.field.getValue(0, offset, "latex") === latex.slice(0, index)) return offset;
            this.offsetCache = null;
            return this.findOffsetForLatexIndex(latex, index);
        }
        while (cache.next <= cache.lastOffset) {
            const offset = cache.next++;
            const candidate = this.field.getValue(0, offset, "latex");
            if (candidate !== latex.slice(0, candidate.length)) continue;
            if (!cache.positions.has(candidate.length)) cache.positions.set(candidate.length, offset);
            if (candidate.length === index) return cache.positions.get(index)!;
        }
        return null;
    }

    private insert(expansion: Expansion, source?: string): void {
        if (source !== undefined && source !== this.field.getValue("latex")) return;
        const settings = this.getSettings();
        const applied = applyWithRecursion(
            source ?? "",
            source === undefined ? {...expansion, from: 0, to: 0} : expansion,
            this.mode,
            this.snippets(settings),
            settings.wordDelimiters,
            settings.snippetRecursion,
            this.engine,
            settings.textMacros,
        );
        if (source === undefined) {
            expansion = {...expansion, text: applied.value, tabstops: applied.tabstops};
        } else {
            // Recursive matches can extend into either side of the original
            // trigger. Derive the affected range in the full formula rather
            // than losing macro context by expanding an isolated fragment.
            let start = 0;
            while (start < source.length && start < applied.value.length
                && source[start] === applied.value[start]) start += 1;
            let oldEnd = source.length;
            let newEnd = applied.value.length;
            while (oldEnd > start && newEnd > start && source[oldEnd - 1] === applied.value[newEnd - 1]) {
                oldEnd -= 1;
                newEnd -= 1;
            }
            start = Math.min(start, expansion.from);
            for (const range of applied.tabstops) {
                start = Math.min(start, range.from);
                newEnd = Math.max(newEnd, range.to);
            }
            newEnd = Math.max(newEnd, expansion.to + applied.value.length - source.length);
            oldEnd = Math.max(oldEnd, newEnd - (applied.value.length - source.length));
            const startOffset = this.findOffsetForLatexIndex(source, start);
            const endOffset = this.findOffsetForLatexIndex(source, oldEnd);
            if (startOffset === null || endOffset === null || source !== this.field.getValue("latex")) return;
            this.field.selection = {ranges: [[startOffset, endOffset]], direction: "forward"};
            expansion = {
                ...expansion, text: applied.value.slice(start, newEnd),
                tabstops: applied.tabstops.map((range) => ({...range, from: range.from - start, to: range.to - start})),
            };
        }
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
