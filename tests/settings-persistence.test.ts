import {describe, expect, it, vi} from "vitest";
import {SettingsPersistence} from "../src/core/settings-persistence";

describe("settings persistence", () => {
    it("publishes only after persistence succeeds", async () => {
        let resolve!: () => void;
        const write = vi.fn(() => new Promise<void>((done) => {resolve = done;}));
        const publish = vi.fn();
        const store = new SettingsPersistence(write, publish);
        const result = store.save({enabled: false});
        await Promise.resolve();
        expect(publish).not.toHaveBeenCalled();
        resolve();
        await result;
        expect(publish).toHaveBeenCalledWith({enabled: false});
    });

    it("keeps live state on failure and accepts the next save", async () => {
        const write = vi.fn().mockRejectedValueOnce(new Error("disk full")).mockResolvedValue(undefined);
        let live = {value: 1};
        const store = new SettingsPersistence(write, (value: typeof live) => {live = value;});
        await expect(store.save({value: 2})).rejects.toThrow("disk full");
        expect(live).toEqual({value: 1});
        await store.save({value: 3});
        expect(live).toEqual({value: 3});
    });

    it("serializes writes and computes rapid toggles against the last persisted state", async () => {
        const order: boolean[] = [];
        let live = {enabled: true};
        const store = new SettingsPersistence(async (value: typeof live) => {order.push(value.enabled);}, (value) => {live = value;});
        await Promise.all([
            store.update(() => ({enabled: !live.enabled})),
            store.update(() => ({enabled: !live.enabled})),
        ]);
        expect(order).toEqual([false, true]);
        expect(live.enabled).toBe(true);
    });
});
