/** Serialize writes and publish only persisted snapshots; a failed write leaves live state intact. */
export class SettingsPersistence<T> {
    private pending: Promise<void> = Promise.resolve();

    constructor(private readonly write: (value: T) => Promise<unknown>, private readonly publish: (value: T) => void) {}

    save(value: T): Promise<void> {
        return this.update(() => value);
    }

    update(resolve: () => T): Promise<void> {
        const operation = this.pending.then(async () => {
            const value = resolve();
            await this.write(value);
            this.publish(value);
        });
        this.pending = operation.catch(() => undefined);
        return operation;
    }
}
