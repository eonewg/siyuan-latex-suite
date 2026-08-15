import type {TabstopRange} from "../types";

export class TabstopSession {
    private current = 0;
    private readonly groups: TabstopRange[][];

    constructor(public readonly ranges: TabstopRange[]) {
        const grouped = new Map<number, TabstopRange[]>();
        for (const range of ranges) {
            const group = grouped.get(range.index) ?? [];
            group.push(range);
            grouped.set(range.index, group);
        }
        this.groups = [...grouped.entries()].sort((a, b) => a[0] - b[0]).map((entry) => entry[1]);
    }

    public static shifted(ranges: readonly TabstopRange[], offset: number): TabstopSession | null {
        if (ranges.length === 0) return null;
        return new TabstopSession(ranges.map((range) => ({
            ...range,
            from: range.from + offset,
            to: range.to + offset,
        })));
    }

    public first(): TabstopRange | null {
        this.current = 0;
        return this.groups[0]?.[0] ?? null;
    }

    public next(): TabstopRange | null {
        this.current += 1;
        return this.groups[this.current]?.[0] ?? null;
    }

    public previous(): TabstopRange | null {
        this.current = Math.max(0, this.current - 1);
        return this.groups[this.current]?.[0] ?? null;
    }

    public update(oldValue: string, newValue: string): void {
        if (oldValue === newValue) return;
        let start = 0;
        while (start < oldValue.length && start < newValue.length && oldValue[start] === newValue[start]) start += 1;
        let oldEnd = oldValue.length;
        let newEnd = newValue.length;
        while (oldEnd > start && newEnd > start && oldValue[oldEnd - 1] === newValue[newEnd - 1]) {
            oldEnd -= 1;
            newEnd -= 1;
        }
        const delta = (newEnd - start) - (oldEnd - start);
        for (const range of this.ranges) {
            if (oldEnd === start && start === range.to && start >= range.from) {
                range.to = newEnd;
            } else if (oldEnd <= range.from) {
                range.from += delta;
                range.to += delta;
            } else if (start < range.to && oldEnd > range.from) {
                range.from = Math.min(range.from, start);
                range.to = Math.max(range.from, range.to + delta);
            }
        }
    }

    public synchronize(oldValue: string, newValue: string, cursor: number): {value: string; cursor: number} | null {
        const group = this.groups[this.current];
        const primary = group?.[0];
        if (!group || group.length < 2 || !primary || oldValue === newValue) {
            this.update(oldValue, newValue);
            return null;
        }

        let start = 0;
        while (start < oldValue.length && start < newValue.length && oldValue[start] === newValue[start]) start += 1;
        let oldEnd = oldValue.length;
        let newEnd = newValue.length;
        while (oldEnd > start && newEnd > start && oldValue[oldEnd - 1] === newValue[newEnd - 1]) {
            oldEnd -= 1;
            newEnd -= 1;
        }
        const editsPrimary = start >= primary.from && oldEnd <= primary.to;
        this.update(oldValue, newValue);
        if (!editsPrimary) return null;

        const updatedPrimary = group[0]!;
        const mirroredText = newValue.slice(updatedPrimary.from, updatedPrimary.to);
        let result = newValue;
        let nextCursor = cursor;
        const mirrors = group.slice(1).sort((a, b) => b.from - a.from);
        for (const mirror of mirrors) {
            const from = mirror.from;
            const to = mirror.to;
            result = result.slice(0, from) + mirroredText + result.slice(to);
            const delta = mirroredText.length - (to - from);
            if (from < nextCursor) nextCursor += delta;
            this.updateRangesForChange(from, to, from + mirroredText.length);
        }
        return {value: result, cursor: nextCursor};
    }

    private updateRangesForChange(start: number, oldEnd: number, newEnd: number): void {
        const delta = newEnd - oldEnd;
        for (const range of this.ranges) {
            if (range.from === start && range.to === oldEnd) {
                range.to = newEnd;
            } else if (oldEnd <= range.from) {
                range.from += delta;
                range.to += delta;
            } else if (start < range.to || (range.from === range.to && start === range.from)) {
                range.from = Math.min(range.from, start);
                range.to = Math.max(range.from, range.to + delta);
            }
        }
    }
}
