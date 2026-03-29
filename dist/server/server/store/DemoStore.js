import fs from 'node:fs/promises';
import path from 'node:path';
const DEFAULT_STATE_VERSION = 1;
function clone(value) {
    return JSON.parse(JSON.stringify(value));
}
function createDefaultState(rpcUrl, explorerBaseUrl) {
    const now = Date.now();
    return {
        version: DEFAULT_STATE_VERSION,
        createdAt: now,
        updatedAt: now,
        policy: null,
        stableAsset: null,
        actors: {
            treasury: null,
            operator: null,
            approver: null,
            auditor: null,
            mintAuthority: null,
        },
        counterparties: [],
        payouts: [],
        auditEntries: [],
        validations: [],
        metadata: {
            rpcUrl,
            explorerBaseUrl,
            notes: [],
        },
    };
}
export class DemoStore {
    filePath;
    rpcUrl;
    explorerBaseUrl;
    state = null;
    constructor(filePath, rpcUrl, explorerBaseUrl) {
        this.filePath = filePath;
        this.rpcUrl = rpcUrl;
        this.explorerBaseUrl = explorerBaseUrl;
    }
    async load() {
        if (this.state) {
            return clone(this.state);
        }
        await fs.mkdir(path.dirname(this.filePath), { recursive: true });
        try {
            const raw = await fs.readFile(this.filePath, 'utf8');
            this.state = JSON.parse(raw);
        }
        catch (error) {
            const typedError = error;
            if (typedError.code !== 'ENOENT') {
                throw error;
            }
            this.state = createDefaultState(this.rpcUrl, this.explorerBaseUrl);
            await this.persist(this.state);
        }
        return clone(this.state);
    }
    async save(nextState) {
        const stateToSave = clone({
            ...nextState,
            updatedAt: Date.now(),
        });
        this.state = stateToSave;
        await this.persist(stateToSave);
        return clone(stateToSave);
    }
    async update(mutator) {
        const current = await this.load();
        const next = await mutator(current);
        return this.save(next);
    }
    async reset() {
        const state = createDefaultState(this.rpcUrl, this.explorerBaseUrl);
        return this.save(state);
    }
    async persist(state) {
        await fs.writeFile(this.filePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
    }
}
