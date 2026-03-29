import type { DemoState } from '../types/index.js';
export declare class DemoStore {
    private readonly filePath;
    private readonly rpcUrl;
    private readonly explorerBaseUrl;
    private state;
    constructor(filePath: string, rpcUrl: string, explorerBaseUrl: string);
    load(): Promise<DemoState>;
    save(nextState: DemoState): Promise<DemoState>;
    update(mutator: (current: DemoState) => DemoState | Promise<DemoState>): Promise<DemoState>;
    reset(): Promise<DemoState>;
    private persist;
}
