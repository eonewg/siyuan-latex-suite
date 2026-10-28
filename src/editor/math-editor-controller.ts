import {createAutoFraction, createSelectionFraction, createShortcutFraction} from "../core/fraction";
import {autoEnlargeBrackets} from "../core/auto-enlarge";
import {nextClosingPosition, previousOpeningPosition} from "../core/navigation";
import {getCompiledSnippets} from "../core/snippet-parser";
import {SnippetEngine, type SnippetErrorHandler} from "../core/snippet-engine";
import {TabstopSession} from "../core/tabstops";
import {DEFAULT_KEYBINDINGS, matchesKeyBinding} from "../core/keyboard";
import {resolveMatrixAction, taboutDirection} from "../core/editor-actions";
import {isMathInputContext} from "../core/context";
import {isInsertionInput} from "../core/input";
import {applyWithRecursion} from "../core/recursion";
import {editTextarea} from "./textarea-edit";
import type {EditorMode, Expansion, LatexSuiteSettings, SnippetDefinition} from "../types";

export class MathEditorController {
    private readonly engine: SnippetEngine;
    private tabstops: TabstopSession | null = null;
    private lastValue: string;
    private composing = false;
    private internalUpdate = false;
    private destroyed = false;
    private inputRevision = 0;
    private compositionValue = "";

    constructor(
        private readonly textarea: HTMLTextAreaElement,
        private readonly mode: EditorMode,
        private readonly getSettings: () => LatexSuiteSettings,
        onSnippetError?: SnippetErrorHandler,
    ) {
        this.engine = new SnippetEngine(onSnippetError);
        this.lastValue = textarea.value;
        textarea.addEventListener("input", this.onInput);
        textarea.addEventListener("keydown", this.onKeydown, true);
        textarea.addEventListener("compositionstart", this.onCompositionStart);
        textarea.addEventListener("compositionend", this.onCompositionEnd);
    }

    public destroy(): void {
        this.destroyed = true;
        this.textarea.removeEventListener("input", this.onInput);
        this.textarea.removeEventListener("keydown", this.onKeydown, true);
        this.textarea.removeEventListener("compositionstart", this.onCompositionStart);
        this.textarea.removeEventListener("compositionend", this.onCompositionEnd);
        this.tabstops = null;
    }

    private readonly onCompositionStart = () => {
        this.composing = true;
        this.compositionValue = this.textarea.value;
    };

    private readonly onCompositionEnd = () => {
        this.composing = false;
        if (!this.getSettings().suppressSnippetTriggerOnIME || this.textarea.value === this.compositionValue) return;
        const revision = this.inputRevision;
        // Browsers emit the final input before or after compositionend. Let a
        // final input do the work, or process it once here if none follows.
        queueMicrotask(() => {
            if (!this.destroyed && !this.composing && this.inputRevision === revision) {
                this.onInput(new InputEvent("input", {inputType: "insertCompositionText"}));
            }
        });
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
        this.inputRevision += 1;
        const inputType = (event as InputEvent).inputType;
        if (inputType === "historyUndo" || inputType === "historyRedo") {
            // Native history edits must not be mistaken for linked-placeholder
            // edits or cause another automatic expansion.
            this.tabstops = null;
            this.lastValue = current;
            return;
        }
        const settings = this.getSettings();
        if (!settings.enabled) {
            this.tabstops = null;
            this.lastValue = current;
            return;
        }
        // Keep the pre-composition value and ranges until the committed input
        // arrives. Updating or mirroring them here would rewrite an active IME.
        if (settings.suppressSnippetTriggerOnIME && (this.composing || (event as InputEvent).isComposing)) return;
        const mirrored = this.tabstops?.synchronize(this.lastValue, current, this.textarea.selectionStart);
        if (mirrored) {
            this.internalUpdate = true;
            try {
                if (!editTextarea(this.textarea, mirrored.value, {from: mirrored.cursor, to: mirrored.cursor}, mirrored.value)) this.tabstops = null;
                current = this.textarea.value;
            } finally {
                this.internalUpdate = false;
            }
        }
        this.lastValue = current;
        if (!isInsertionInput(event)) return;

        const cursor = this.textarea.selectionStart;
        if (cursor !== this.textarea.selectionEnd) return;
        if (settings.autoSnippets) {
            const expansion = this.engine.find(current, cursor, this.mode, "auto", this.snippets(settings), settings.wordDelimiters, settings.textMacros);
            if (expansion) {
                this.commit(expansion);
                return;
            }
        }
        const inputEvent = event as InputEvent;
        if (settings.autoFraction && (settings.keybindings ?? DEFAULT_KEYBINDINGS).autofractionTrigger === "/"
            && (inputEvent.data === "/" || current[cursor - 1] === "/")) {
            const expansion = createAutoFraction(current, cursor, settings);
            if (expansion) this.commit(expansion);
        }
    };

    private readonly onKeydown = (event: KeyboardEvent) => {
        const settings = this.getSettings();
        if (!settings.enabled) {
            this.tabstops = null;
            this.lastValue = this.textarea.value;
            return;
        }
        if (settings.suppressSnippetTriggerOnIME && (this.composing || event.isComposing)) return;
        const {selectionStart: from, selectionEnd: to, value} = this.textarea;
        const snippets = this.snippets(settings);
        const keys = settings.keybindings ?? DEFAULT_KEYBINDINGS;

        if (settings.autoFraction && from !== to && matchesKeyBinding(event, keys.autofractionTrigger)
            && isMathInputContext(value, from, settings.textMacros)) {
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
                settings.textMacros,
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
                const expansion = this.engine.find(value, from, this.mode, "tab", keyedSnippets, settings.wordDelimiters, settings.textMacros);
                if (expansion) {
                    this.consume(event);
                    this.commit(expansion);
                    return;
                }
            }
        }

        const previousStop = matchesKeyBinding(event, keys.snippetPreviousTabstopTrigger);
        if ((previousStop || matchesKeyBinding(event, keys.snippetNextTabstopTrigger))
            && this.moveToNextTabstop(event, previousStop)) return;

        if (from === to && settings.tabSnippets && matchesKeyBinding(event, keys.snippetsTrigger)) {
            const expansion = this.engine.find(
                value, from, this.mode, "tab",
                snippets.filter((snippet) => !snippet.triggerKey && !(snippet.options ?? "").includes("A")),
                settings.wordDelimiters, settings.textMacros,
            );
            if (expansion) {
                this.consume(event);
                this.commit(expansion);
                return;
            }
        }
        if (from !== to) return;

        if (settings.autoFraction && keys.autofractionTrigger !== "/" && matchesKeyBinding(event, keys.autofractionTrigger)) {
            const expansion = createShortcutFraction(value, from, settings);
            if (expansion) {
                this.consume(event);
                this.commit(expansion);
                return;
            }
        }

        const matrixAction = resolveMatrixAction(value, from, event, settings);
        if (matrixAction) {
            this.consume(event);
            if (matrixAction.kind === "move") this.textarea.setSelectionRange(matrixAction.position, matrixAction.position);
            else this.commit({from, to, text: matrixAction.text, tabstops: []});
            return;
        }

        const direction = taboutDirection(value, from, event, settings);
        if (!direction) return;
        const destination = direction === "backward" ? previousOpeningPosition(value, from)
            : nextClosingPosition(value, from, new Set(settings.tabOutClosingSymbols));
        if (destination !== null) {
            this.consume(event);
            this.textarea.setSelectionRange(destination, destination);
            return;
        }
        if (!settings.tabOutExitOnlyAtEnd || (direction === "backward"
            ? value.slice(0, from).trim().length === 0 : value.slice(from).trim().length === 0)) {
            this.consume(event);
            requestAnimationFrame(() => {
                if (!this.destroyed) this.textarea.dispatchEvent(new KeyboardEvent("keydown", {
                    key: "Escape", bubbles: true, cancelable: true,
                }));
            });
        }
    };

    private moveToNextTabstop(event: KeyboardEvent, previous: boolean): boolean {
        if (!this.tabstops) return false;
        const target = previous ? this.tabstops.previous() : this.tabstops.next();
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
            settings.textMacros,
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
        try {
            this.tabstops = ranges.length > 0 ? new TabstopSession(ranges) : null;
            const target = this.tabstops?.first();
            if (!editTextarea(this.textarea, nextValue, {from: target?.from ?? cursor, to: target?.to ?? cursor}, expansion.text)) this.tabstops = null;
            this.lastValue = this.textarea.value;
        } finally {
            this.internalUpdate = false;
        }
    }
}
