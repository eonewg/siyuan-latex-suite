import {build} from "esbuild";
import {afterEach, beforeAll, beforeEach, describe, expect, it, vi} from "vitest";
import {TEST_SETTINGS} from "./settings-fixture";
import type {LatexSuiteSettings} from "../src/types";

interface RuntimePlugin {
    onload(): Promise<void>;
    onunload(): void;
    commands: Array<{langKey: string; callback: () => void}>;
    eventBus: {on: ReturnType<typeof vi.fn>; off: ReturnType<typeof vi.fn>};
    settingsValue: LatexSuiteSettings;
}

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((done) => {resolve = done;});
    return {promise, resolve};
}

describe("plugin initialization ordering", () => {
    let code: string;
    let host: {
        Plugin: new() => unknown;
        defaults: LatexSuiteSettings;
        uiCreated: number;
        load: ReturnType<typeof vi.fn>;
        save: ReturnType<typeof vi.fn>;
    };

    beforeAll(async () => {
        // Compile the real plugin against a small host shim. The SiYuan npm
        // package supplies types only and cannot execute outside the app.
        const result = await build({
            entryPoints: ["src/index.ts"], bundle: true, format: "cjs", platform: "node", write: false,
            loader: {".css": "empty"},
            plugins: [{name: "test-host", setup(plugin) {
                plugin.onResolve({filter: /^siyuan$/}, () => ({path: "siyuan", namespace: "test-host"}));
                plugin.onLoad({filter: /.*/, namespace: "test-host"}, () => ({contents: `
                    export const Plugin = globalThis.__latexSuiteHost.Plugin;
                    export const ProtyleMethod = {};
                    export const showMessage = () => {};
                    export class Dialog {}
                `}));
                plugin.onResolve({filter: /^\.\/settings$/}, () => ({path: "settings", namespace: "test-settings"}));
                plugin.onLoad({filter: /.*/, namespace: "test-settings"}, () => ({contents: `
                    export const DEFAULT_SETTINGS = globalThis.__latexSuiteHost.defaults;
                    export function createSettingsUI() {
                        globalThis.__latexSuiteHost.uiCreated++;
                        return {setting: {}, refresh() {}};
                    }
                `}));
            }}],
        });
        code = result.outputFiles[0]!.text;
    });

    beforeEach(() => {
        host = {
            Plugin: class {
                name = "test-latex-suite";
                i18n = {};
                commands: RuntimePlugin["commands"] = [];
                eventBus = {on: vi.fn(), off: vi.fn()};
                loadData(): Promise<unknown> {return host.load();}
                saveData(_name: string, value: unknown): Promise<void> {return host.save(value);}
                addCommand(command: RuntimePlugin["commands"][number]): void {this.commands.push(command);}
            },
            defaults: {...TEST_SETTINGS}, uiCreated: 0,
            load: vi.fn(), save: vi.fn().mockResolvedValue(undefined),
        };
        vi.stubGlobal("__latexSuiteHost", host);
        vi.stubGlobal("document", new EventTarget());
        vi.stubGlobal("window", {setTimeout: vi.fn(() => 1), clearTimeout: vi.fn()});
    });
    afterEach(() => vi.unstubAllGlobals());

    const create = (): RuntimePlugin => {
        const module = {exports: {} as {default?: new() => RuntimePlugin}};
        Function("module", "exports", code)(module, module.exports);
        return new module.exports.default!();
    };

    it("waits for saved configuration before registering commands or editor listeners", async () => {
        const initial = deferred<Partial<LatexSuiteSettings>>();
        host.load.mockReturnValue(initial.promise);
        const plugin = create();
        const ready = plugin.onload();
        expect(host.uiCreated).toBe(0);
        expect(plugin.commands).toEqual([]);
        expect(plugin.eventBus.on).not.toHaveBeenCalled();
        initial.resolve({snippetsSource: "[]", autoFraction: false});
        await ready;
        expect(plugin.settingsValue.snippetsSource).toBe("[]");
        expect(plugin.settingsValue.autoFraction).toBe(false);
        plugin.commands.find((command) => command.langKey === "toggleLatexSuite")!.callback();
        await vi.waitFor(() => expect(host.save).toHaveBeenCalled());
        expect(host.save.mock.calls[0]![0]).toMatchObject({snippetsSource: "[]", autoFraction: false, enabled: false});
        plugin.onunload();
    });

    it("does not finish initialization when unloading during a delayed read", async () => {
        const initial = deferred<Partial<LatexSuiteSettings>>();
        host.load.mockReturnValue(initial.promise);
        const plugin = create();
        const ready = plugin.onload();
        plugin.onunload();
        initial.resolve({snippetsSource: "[]"});
        await ready;
        expect(host.uiCreated).toBe(0);
        expect(plugin.commands).toEqual([]);
        expect(plugin.eventBus.on).not.toHaveBeenCalled();
        expect(plugin.eventBus.off).not.toHaveBeenCalled();
    });

    it("ignores an older read that finishes after a new lifecycle has loaded", async () => {
        const oldRead = deferred<Partial<LatexSuiteSettings>>();
        const newRead = deferred<Partial<LatexSuiteSettings>>();
        host.load.mockReturnValueOnce(oldRead.promise).mockReturnValueOnce(newRead.promise);
        const plugin = create();
        const first = plugin.onload();
        plugin.onunload();
        const second = plugin.onload();
        newRead.resolve({autoFraction: false});
        await second;
        oldRead.resolve({autoFraction: true});
        await first;
        expect(plugin.settingsValue.autoFraction).toBe(false);
        expect(host.uiCreated).toBe(1);
        plugin.onunload();
    });
});
