import {Plugin, showMessage} from "siyuan";
import "./index.css";
import {EditorSessionManager} from "./editor/session-manager";
import {TextModeShortcutController} from "./editor/text-mode-shortcuts";
import {createSettingsUI, DEFAULT_SETTINGS, type Labels} from "./settings";
import type {IProtyle} from "siyuan";
import type {LatexSuiteSettings} from "./types";

const STORAGE_NAME = "settings.json";

export default class SiyuanLatexSuite extends Plugin {
    private settingsValue: LatexSuiteSettings = {...DEFAULT_SETTINGS};
    private sessions!: EditorSessionManager;
    private textModeShortcuts!: TextModeShortcutController;
    private refreshSettingsUI: () => void = () => undefined;
    private connectionNotified = false;
    private scanTimers: number[] = [];
    private readonly openEditorHandler = (event: Event) => this.sessions.open(event as CustomEvent);
    private readonly registerProtyleHandler = (event: CustomEvent<{protyle: IProtyle}>) => {
        this.textModeShortcuts.register(event.detail.protyle);
    };
    private readonly unregisterProtyleHandler = (event: CustomEvent<{protyle: IProtyle}>) => {
        this.textModeShortcuts.unregister(event.detail.protyle);
    };

    public onload(): void {
        this.sessions = new EditorSessionManager(
            () => this.settingsValue,
            (kind) => {
                if (this.connectionNotified) return;
                this.connectionNotified = true;
                showMessage(kind === "mathlive"
                    ? (this.i18n.mathLiveConnected ?? "Latex Suite connected to MathLive")
                    : (this.i18n.editorConnected ?? "Latex Suite connected to the math editor"), 2500);
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
            langKey: "toggleLatexSuite",
            hotkey: "⌥⇧L",
            callback: () => {
                this.settingsValue.enabled = !this.settingsValue.enabled;
                void this.saveSettings(this.settingsValue).then(() => {
                    showMessage(this.settingsValue.enabled
                        ? (this.i18n.enabledMessage ?? "Latex Suite enabled")
                        : (this.i18n.disabledMessage ?? "Latex Suite disabled"));
                    this.refreshSettingsUI();
                });
            },
        });

        const ui = createSettingsUI(
            this,
            this.i18n as unknown as Labels,
            () => this.settingsValue,
            (settings) => this.saveSettings(settings),
        );
        this.setting = ui.setting;
        this.refreshSettingsUI = ui.refresh;
        void this.loadSettings();
    }

    public onunload(): void {
        this.eventBus.off("open-noneditableblock", this.openEditorHandler);
        this.eventBus.off("click-editorcontent", this.registerProtyleHandler);
        this.eventBus.off("loaded-protyle-dynamic", this.registerProtyleHandler);
        this.eventBus.off("loaded-protyle-static", this.registerProtyleHandler);
        this.eventBus.off("switch-protyle", this.registerProtyleHandler);
        this.eventBus.off("destroy-protyle", this.unregisterProtyleHandler);
        for (const timer of this.scanTimers) window.clearTimeout(timer);
        this.scanTimers = [];
        this.sessions.destroy();
        this.textModeShortcuts.destroy();
    }

    private async loadSettings(): Promise<void> {
        try {
            const saved = await this.loadData(STORAGE_NAME) as (Partial<LatexSuiteSettings> & {customSnippets?: unknown}) | null;
            let snippetsSource = saved?.snippetsSource ?? DEFAULT_SETTINGS.snippetsSource;
            if (!saved?.snippetsSource && Array.isArray(saved?.customSnippets) && saved.customSnippets.length > 0) {
                snippetsSource = `[...(${DEFAULT_SETTINGS.snippetsSource}), ...(${JSON.stringify(saved.customSnippets, null, 2)})]`;
            }
            this.settingsValue = {
                ...DEFAULT_SETTINGS,
                ...(saved ?? {}),
                snippetsSource,
                snippetVariablesSource: saved?.snippetVariablesSource ?? DEFAULT_SETTINGS.snippetVariablesSource,
            };
            this.refreshSettingsUI();
        } catch (error) {
            console.warn(`[${this.name}] Failed to load settings`, error);
        }
    }

    private async saveSettings(settings: LatexSuiteSettings): Promise<void> {
        this.settingsValue = {
            ...settings,
            autoFractionExcludedEnvironments: settings.autoFractionExcludedEnvironments.map((pair) => [...pair] as [string, string]),
            matrixEnvironments: [...settings.matrixEnvironments],
            matrixMacros: [...settings.matrixMacros],
            tabOutClosingSymbols: [...settings.tabOutClosingSymbols],
            autoEnlargeBracketTriggers: [...settings.autoEnlargeBracketTriggers],
        };
        await this.saveData(STORAGE_NAME, this.settingsValue);
    }
}
