import type {LatexSuiteSettings} from "../src/types";

export const TEST_SETTINGS: LatexSuiteSettings = {
    enabled: true,
    autoSnippets: true,
    tabSnippets: true,
    autoFraction: true,
    matrixShortcuts: true,
    tabOut: true,
    visualSnippets: true,
    snippetsSource: `[
        {trigger: "@a", replacement: "\\\\alpha", options: "mA"},
        {trigger: "alpha", replacement: "\\\\alpha", options: "mA"},
        {trigger: "frac", replacement: "\\\\frac{$0}{$1}$2", options: "m"}
    ]`,
    snippetVariablesSource: "{}",
    snippetRecursion: 0,
    removeSnippetWhitespace: true,
    suppressSnippetTriggerOnIME: true,
    wordDelimiters: "., +-\\n\\t:;!?\\/{}[]()=~$",
    autoFractionSymbol: "\\frac",
    autoFractionBreakingChars: "+-=\\t",
    autoFractionExcludedEnvironments: [["^{", "}"], ["\\pu{", "}"]],
    matrixEnvironments: ["matrix", "pmatrix", "cases", "align"],
    matrixMacros: ["eqalign"],
    tabOutClosingSymbols: [")", "]", "}"],
    tabOutExitOnlyAtEnd: false,
    autoEnlargeBrackets: true,
    autoEnlargeBracketTriggers: ["\\frac", "\\sum", "\\int"],
    autoEnlargeBracketSpace: false,
};
