import {createAutoFraction, createSelectionFraction} from "../core/fraction";
import {autoEnlargeBrackets} from "../core/auto-enlarge";
import {activeMatrixEnvironment, currentMatrixLinePrefix, nextClosingPosition, nextLineEnd} from "../core/navigation";
import {getCompiledSnippets} from "../core/snippet-parser";
import {SnippetEngine} from "../core/snippet-engine";
import {TabstopSession} from "../core/tabstops";
import {matchesKeyBinding} from "../core/keyboard";
import {isInsertionInput} from "../core/input";
import {applyWithRecursion} from "../core/recursion";
import type {EditorMode, Expansion, LatexSuiteSettings, SnippetDefinition} from "../types";

export class MathEditorController {
    private readonly engine = new SnippetEngine();
    private tabstops: TabstopSession | null = null;
    private lastValue: string;
    private composing = false;
    private internalUpdate = false;

    constructor(
        private readonly textarea: HTMLTextAreaElement,
        private readonly mode: EditorMode,
        private readonly getSettings: () => LatexSuiteSettings,
    ) {
        this.lastValue = textarea.value;
        textarea.addEventListener("input", this.onInput);
        textarea.addEventListener("keydown", this.onKeydown, true);
        textarea.addEventListener("compositionstart", this.onCompositionStart);
        textarea.addEventListener("compositionend", this.onCompositionEnd);
    }

    public destroy(): void {
        this.textarea.removeEventListener("input", this.onInput);
        this.textarea.removeEventListener("keydown", this.onKeydown, true);
        this.textarea.removeEventListener("compositionstart", this.onCompositionStart);
        this.textarea.removeEventListener("compositionend", this.onCompositionEnd);
        this.tabstops = null;
    }

    private readonly onCompositionStart = () => {
        this.composing = true;
    };

    private readonly onCompositionEnd = () => {
        this.composing = false;
        this.lastValue = this.textarea.value;
    };

    private snippets(settings: LatexSuiteSettings): readonly SnippetDefinition[] {
        return getCompiledSnippets(settings.snippetsSource, settings.snippetVariablesSource);
    }

    private readonly onInput = (event: Event) => {
        let current = this.textarea.value;
        if (this.internalUpdate) {
            this.lastValue = current;
            return;
        }
        const mirrored = this.tabstops?.synchronize(this.lastValue, current, this.textarea.selectionStart);
        if (mirrored) {
            this.internalUpdate = true;
            this.textarea.value = mirrored.value;
            this.textarea.setSelectionRange(mirrored.cursor, mirrored.cursor);
            current = mirrored.value;
            this.textarea.dispatchEvent(new InputEvent("input", {
                bubbles: true,
                cancelable: true,
                inputType: "insertReplacementText",
                data: current,
            }));
            this.internalUpdate = false;
        }
        this.lastValue = current;
        const settings = this.getSettings();
        if (this.internalUpdate || (settings.suppressSnippetTriggerOnIME && this.composing) || !settings.enabled) return;
        if (!isInsertionInput(event)) return;

        const cursor = this.textarea.selectionStart;
        if (cursor !== this.textarea.selectionEnd) return;
        if (settings.autoSnippets) {
            const expansion = this.engine.find(current, cursor, this.mode, "auto", this.snippets(settings), settings.wordDelimiters);
            if (expansion) {
                this.commit(expansion);
                return;
            }
        }
        const inputEvent = event as InputEvent;
        if (settings.autoFraction && (inputEvent.data === "/" || current[cursor - 1] === "/")) {
            const expansion = createAutoFraction(current, cursor, settings);
            if (expansion) this.commit(expansion);
        }
    };

    private readonly onKeydown = (event: KeyboardEvent) => {
        const settings = this.getSettings();
        if (!settings.enabled || (settings.suppressSnippetTriggerOnIME && (this.composing || event.isComposing))) return;
        const {selectionStart: from, selectionEnd: to, value} = this.textarea;
        const snippets = this.snippets(settings);

        if (settings.autoFraction && from !== to && event.key === "/") {
            const expansion = createSelectionFraction(value.slice(from, to), from, to, settings.autoFractionSymbol);
            if (expansion) {
                this.consume(event);
                this.commit(expansion);
                return;
            }
        }

        if (settings.visualSnippets && from !== to && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
            const expansion = this.engine.findVisual(
                event.key,
                value.slice(from, to),
                from,
                to,
                this.mode,
                snippets,
                value,
                from,
            );
            if (expansion) {
                this.consume(event);
                this.commit(expansion);
                return;
            }
        }

        if (settings.tabSnippets && from === to) {
            const keyedSnippets = snippets.filter((snippet) => snippet.triggerKey
                && matchesKeyBinding(event, snippet.triggerKey));
            if (keyedSnippets.length > 0) {
                const expansion = this.engine.find(value, from, this.mode, "tab", keyedSnippets, settings.wordDelimiters);
                if (expansion) {
                    this.consume(event);
                    this.commit(expansion);
                    return;
                }
            }
        }

        if (event.key === "Tab" && !event.ctrlKey && !event.metaKey && !event.altKey) {
            if (this.moveToNextTabstop(event)) return;
            if (!event.shiftKey && settings.tabSnippets) {
                const expansion = this.engine.find(
                    value,
                    from,
                    this.mode,
                    "tab",
                    snippets.filter((snippet) => !snippet.triggerKey && !(snippet.options ?? "").includes("A")),
                    settings.wordDelimiters,
                );
                if (expansion) {
                    this.consume(event);
                    this.commit(expansion);
                    return;
                }
            }
            if (!event.shiftKey && settings.matrixShortcuts
                && activeMatrixEnvironment(value, from, settings.matrixEnvironments, settings.matrixMacros)) {
                this.consume(event);
                this.commit({from, to, text: " & ", tabstops: []});
                return;
            }
            if (!event.shiftKey && settings.tabOut) {
                const closing = nextClosingPosition(value, from, new Set(settings.tabOutClosingSymbols));
                if (closing !== null) {
                    this.consume(event);
                    this.textarea.setSelectionRange(closing, closing);
                    return;
                }
            }
            if (!event.shiftKey && settings.tabOut && to === from
                && (!settings.tabOutExitOnlyAtEnd || from === value.length)) {
                this.consume(event);
                requestAnimationFrame(() => this.textarea.dispatchEvent(new KeyboardEvent("keydown", {
                    key: "Escape",
                    bubbles: true,
                    cancelable: true,
                })));
            }
            return;
        }

        if (event.key === "Enter" && settings.matrixShortcuts
            && activeMatrixEnvironment(value, from, settings.matrixEnvironments, settings.matrixMacros)) {
            this.consume(event);
            if (event.shiftKey) {
                const destination = nextLineEnd(value, from);
                this.textarea.setSelectionRange(destination, destination);
            } else {
                const text = " \\\\" + "\n" + currentMatrixLinePrefix(value, from);
                this.commit({from, to, text, tabstops: []});
            }
        }
    };

    private moveToNextTabstop(event: KeyboardEvent): boolean {
        if (!this.tabstops) return false;
        const target = event.shiftKey ? this.tabstops.previous() : this.tabstops.next();
        if (!target) {
            this.tabstops = null;
            return false;
        }
        this.consume(event);
        this.textarea.setSelectionRange(target.from, target.to);
        return true;
    }

    private consume(event: KeyboardEvent): void {
        event.preventDefault();
        event.stopPropagation();
    }

    private commit(expansion: Expansion): void {
        const settings = this.getSettings();
        if (this.mode === "inline" && settings.removeSnippetWhitespace && /\s$/.test(expansion.text)) {
            const trimmed = expansion.text.trimEnd();
            expansion = {
                ...expansion,
                text: trimmed,
                tabstops: expansion.tabstops.map((range) => ({
                    ...range,
                    from: Math.min(range.from, trimmed.length),
                    to: Math.min(range.to, trimmed.length),
                })),
            };
        }
        const applied = applyWithRecursion(
            this.textarea.value,
            expansion,
            this.mode,
            this.snippets(settings),
            settings.wordDelimiters,
            settings.snippetRecursion,
            this.engine,
        );
        let nextValue = applied.value;
        let ranges = applied.tabstops;
        let cursor = applied.cursor;
        if (settings.autoEnlargeBrackets) {
            const enlarged = autoEnlargeBrackets(nextValue, settings.autoEnlargeBracketTriggers, settings.autoEnlargeBracketSpace);
            nextValue = enlarged.value;
            ranges = ranges.map((range) => ({
                ...range,
                from: enlarged.mapPosition(range.from),
                to: enlarged.mapPosition(range.to),
            }));
            cursor = enlarged.mapPosition(cursor);
        }
        this.internalUpdate = true;
        this.textarea.value = nextValue;
        this.lastValue = nextValue;
        this.tabstops = ranges.length > 0 ? new TabstopSession(ranges) : null;
        const target = this.tabstops?.first();
        this.textarea.setSelectionRange(target?.from ?? cursor, target?.to ?? cursor);
        this.textarea.dispatchEvent(new InputEvent("input", {
            bubbles: true,
            cancelable: true,
            inputType: "insertReplacementText",
            data: expansion.text,
        }));
        this.internalUpdate = false;
    }
}
