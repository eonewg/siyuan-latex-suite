import {Dialog, Plugin, showMessage} from "siyuan";
import "./index.css";
import {EditorSessionManager} from "./editor/session-manager";
import {TextModeShortcutController} from "./editor/text-mode-shortcuts";
import {createSettingsUI, DEFAULT_SETTINGS, type Labels} from "./settings";
import type {IProtyle} from "siyuan";
import type {LatexSuiteSettings} from "./types";
import {migrateBundledSnippets} from "./bundled-snippets-source";
import {parseKeybindings} from "./core/keyboard";
import {getCompiledSnippets} from "./core/snippet-parser";
import {createSnippetReference} from "./ui/snippet-reference";
import {SettingsPersistence} from "./core/settings-persistence";

const STORAGE_NAME = "settings.json";

export default class SiyuanLatexSuite extends Plugin {
    private settingsValue: LatexSuiteSettings = {...DEFAULT_SETTINGS};
    private readonly persistence = new SettingsPersistence<LatexSuiteSettings>(
        (value) => this.saveData(STORAGE_NAME, value),
        (value) => {this.settingsValue = value;},
    );
    private sessions!: EditorSessionManager;
    private textModeShortcuts!: TextModeShortcutController;
    private refreshSettingsUI: () => void = () => undefined;
    private connectionNotified = false;
    private scanTimers: number[] = [];
    private referenceDialog: Dialog | null = null;
    private lifecycle = 0;
    private initialized = false;
    private readonly openEditorHandler = (event: Event) => this.sessions.open(event as CustomEvent);
    private readonly registerProtyleHandler = (event: CustomEvent<{protyle: IProtyle}>) => {
        this.textModeShortcuts.register(event.detail.protyle);
    };
    private readonly unregisterProtyleHandler = (event: CustomEvent<{protyle: IProtyle}>) => {
        this.textModeShortcuts.unregister(event.detail.protyle);
    };

    public async onload(): Promise<void> {
        const lifecycle = ++this.lifecycle;
        await this.loadSettings(lifecycle);
        if (lifecycle !== this.lifecycle) return;
        this.initialized = true;
        this.sessions = new EditorSessionManager(
            () => this.settingsValue,
            (kind) => {
                if (this.connectionNotified) return;
                this.connectionNotified = true;
                showMessage(kind === "mathlive"
                    ? (this.i18n.mathLiveConnected ?? "Latex Suite connected to MathLive")
                    : (this.i18n.editorConnected ?? "Latex Suite connected to the math editor"), 2500);
            },
            (snippet, error) => {
                console.warn(`[${this.name}] Snippet failed: ${String(snippet.trigger)}`, error);
                showMessage(`Latex Suite：片段 ${String(snippet.trigger) || snippet.triggerKey} 执行失败，已在当前编辑器跳过。`, 6000, "error");
            },
        );
        this.textModeShortcuts = new TextModeShortcutController(() => this.settingsValue);
        this.eventBus.on("open-noneditableblock", this.openEditorHandler);
        this.eventBus.on("click-editorcontent", this.registerProtyleHandler);
        this.eventBus.on("loaded-protyle-dynamic", this.registerProtyleHandler);
        this.eventBus.on("loaded-protyle-static", this.registerProtyleHandler);
        this.eventBus.on("switch-protyle", this.registerProtyleHandler);
        this.eventBus.on("destroy-protyle", this.unregisterProtyleHandler);
        this.scanTimers = [50, 500].map((delay) => window.setTimeout(
            () => this.sessions.scanOpenEditors(),
            delay,
        ));
        this.addCommand({
            langKey: "openSnippetReference",
            callback: () => this.openSnippetReference(),
        });
        this.addCommand({
            langKey: "toggleLatexSuite",
            hotkey: "⌥⇧L",
            callback: () => {
                void this.persistence.update(() => ({...this.settingsValue, enabled: !this.settingsValue.enabled})).then(() => {
                    showMessage(this.settingsValue.enabled
                        ? (this.i18n.enabledMessage ?? "Latex Suite enabled")
                        : (this.i18n.disabledMessage ?? "Latex Suite disabled"));
                    this.refreshSettingsUI();
                }).catch((error) => this.showSaveFailure(error));
            },
        });

        const ui = createSettingsUI(
            this,
            this.i18n as unknown as Labels,
            () => this.settingsValue,
            (settings) => this.saveSettings(settings),
            () => this.openSnippetReference(),
        );
        this.setting = ui.setting;
        this.refreshSettingsUI = ui.refresh;
    }

    public onunload(): void {
        this.lifecycle += 1;
        if (!this.initialized) return;
        this.initialized = false;
        this.eventBus.off("open-noneditableblock", this.openEditorHandler);
        this.eventBus.off("click-editorcontent", this.registerProtyleHandler);
        this.eventBus.off("loaded-protyle-dynamic", this.registerProtyleHandler);
        this.eventBus.off("loaded-protyle-static", this.registerProtyleHandler);
        this.eventBus.off("switch-protyle", this.registerProtyleHandler);
        this.eventBus.off("destroy-protyle", this.unregisterProtyleHandler);
        for (const timer of this.scanTimers) window.clearTimeout(timer);
        this.scanTimers = [];
        this.sessions?.destroy();
        this.textModeShortcuts?.destroy();
        this.referenceDialog?.destroy();
        this.referenceDialog = null;
    }

    private async loadSettings(lifecycle: number): Promise<void> {
        try {
            const saved = await this.loadData(STORAGE_NAME) as (Partial<LatexSuiteSettings> & {customSnippets?: unknown}) | null;
            if (lifecycle !== this.lifecycle) return;
            let snippetsSource = migrateBundledSnippets(saved?.snippetsSource);
            if (!saved?.snippetsSource && Array.isArray(saved?.customSnippets) && saved.customSnippets.length > 0) {
                snippetsSource = `[...(${DEFAULT_SETTINGS.snippetsSource}), ...(${JSON.stringify(saved.customSnippets, null, 2)})]`;
            }
            this.settingsValue = {
                ...DEFAULT_SETTINGS,
                ...(saved ?? {}),
                snippetsSource,
                snippetVariablesSource: saved?.snippetVariablesSource ?? DEFAULT_SETTINGS.snippetVariablesSource,
                keybindings: parseKeybindings(JSON.stringify(saved?.keybindings ?? {})),
            };
            const previousMatrixDefaults = DEFAULT_SETTINGS.matrixEnvironments.filter((name) => name !== "aligned");
            if (JSON.stringify(saved?.matrixEnvironments) === JSON.stringify(previousMatrixDefaults)) {
                this.settingsValue.matrixEnvironments = [...DEFAULT_SETTINGS.matrixEnvironments];
            }
            this.refreshSettingsUI();
        } catch (error) {
            console.warn(`[${this.name}] Failed to load settings`, error);
        }
    }

    private async saveSettings(settings: LatexSuiteSettings): Promise<void> {
        const next: LatexSuiteSettings = {
            ...settings,
            keybindings: {...settings.keybindings},
            autoFractionExcludedEnvironments: settings.autoFractionExcludedEnvironments.map((pair) => [...pair] as [string, string]),
            matrixEnvironments: [...settings.matrixEnvironments],
            matrixMacros: [...settings.matrixMacros],
            tabOutClosingSymbols: [...settings.tabOutClosingSymbols],
            autoEnlargeBracketTriggers: [...settings.autoEnlargeBracketTriggers],
            textMacros: {
                text: settings.textMacros.text.map((area) => ({...area, arguments: area.arguments && [...area.arguments]})),
                restricted: settings.textMacros.restricted.map((area) => ({...area, arguments: area.arguments && [...area.arguments]})),
            },
        };
        await this.persistence.save(next);
    }

    private showSaveFailure(error: unknown): void {
        console.warn(`[${this.name}] Failed to save settings`, error);
        showMessage(this.i18n.saveFailed ?? "Latex Suite 设置保存失败，继续使用上一次成功保存的配置。", 7000, "error");
    }

    private openSnippetReference(): void {
        try {
            const settings = this.settingsValue;
            const snippets = getCompiledSnippets(settings.snippetsSource, settings.snippetVariablesSource);
            const reference = createSnippetReference(snippets, settings.keybindings);
            this.referenceDialog?.destroy();
            const dialog = new Dialog({
                title: this.i18n.openSnippetReference ?? "Latex Suite 片段速查",
                content: '<div class="latex-suite__reference-mount"></div>',
                width: "min(840px, 94vw)",
                destroyCallback: () => {this.referenceDialog = null;},
            });
            dialog.element.querySelector(".latex-suite__reference-mount")?.append(reference);
            this.referenceDialog = dialog;
            reference.querySelector("input")?.focus();
        } catch (error) {
            showMessage(`Latex Suite: ${error instanceof Error ? error.message : String(error)}`, 7000, "error");
        }
    }
}
