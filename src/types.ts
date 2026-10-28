export type EditorMode = "inline" | "block";

export interface MacroArea {
    name: string;
    arguments?: number[];
}

export interface ActiveMacroArea {
    name: string;
    argument: number;
}

export interface MathlessMacros {
    text: MacroArea[];
    restricted: MacroArea[];
}

export interface Keybindings {
    snippetsTrigger: string;
    snippetNextTabstopTrigger: string;
    snippetPreviousTabstopTrigger: string;
    taboutTrigger: string;
    reverseTaboutTrigger: string;
    autofractionTrigger: string;
    matrixShortcutsCellTrigger: string;
    matrixShortcutsNewlineTrigger: string;
    matrixShortcutsExitTrigger: string;
}

export interface LatexScope {
    kind: "macro" | "environment";
    name: string;
    from: number;
}

export type SnippetReplacementResult = string | false;
export type SnippetReplacement = string | ((match: string | RegExpExecArray) => unknown);

export interface SnippetDefinition {
    trigger: string | RegExp;
    triggerAfter?: string | RegExp;
    replacement: SnippetReplacement;
    options?: string;
    priority?: number;
    description?: string;
    flags?: string;
    triggerKey?: string;
    language?: string;
    excludedMacros?: MacroArea[];
    includedMacros?: MacroArea[];
    excludedEnvironments?: string[];
}

export interface LatexSuiteSettings {
    enabled: boolean;
    autoSnippets: boolean;
    tabSnippets: boolean;
    autoFraction: boolean;
    matrixShortcuts: boolean;
    tabOut: boolean;
    visualSnippets: boolean;
    snippetsSource: string;
    snippetVariablesSource: string;
    snippetRecursion: number;
    removeSnippetWhitespace: boolean;
    suppressSnippetTriggerOnIME: boolean;
    textMacros: MathlessMacros;
    keybindings: Keybindings;
    wordDelimiters: string;
    autoFractionSymbol: string;
    autoFractionBreakingChars: string;
    autoFractionExcludedEnvironments: Array<[string, string]>;
    matrixEnvironments: string[];
    matrixMacros: string[];
    tabOutClosingSymbols: string[];
    tabOutExitOnlyAtEnd: boolean;
    autoEnlargeBrackets: boolean;
    autoEnlargeBracketTriggers: string[];
    autoEnlargeBracketSpace: boolean;
}

export interface TabstopRange {
    index: number;
    from: number;
    to: number;
}

export interface RenderedTemplate {
    text: string;
    tabstops: TabstopRange[];
}

export interface Expansion {
    from: number;
    to: number;
    text: string;
    tabstops: TabstopRange[];
    description?: string;
}

export interface TemplateContext {
    selection?: string;
    captures?: readonly string[];
    namedCaptures?: Readonly<Record<string, string>>;
}

export interface SnippetContext {
    mode: EditorMode;
    textEnvironment: boolean;
    snippetlessEnvironment: boolean;
    environments: readonly string[];
    macros: readonly string[];
    macroAreas: readonly ActiveMacroArea[];
    scopes: readonly LatexScope[];
}
