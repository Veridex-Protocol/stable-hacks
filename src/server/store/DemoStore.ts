import fs from 'node:fs/promises';
import path from 'node:path';
import type { DemoState } from '../types/index';

const DEFAULT_STATE_VERSION = 1;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createDefaultState(rpcUrl: string, explorerBaseUrl: string): DemoState {
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
  private state: DemoState | null = null;

  constructor(
    private readonly filePath: string,
    private readonly rpcUrl: string,
    private readonly explorerBaseUrl: string,
  ) {}

  async load(): Promise<DemoState> {
    if (this.state) {
      return clone(this.state);
    }

    await fs.mkdir(path.dirname(this.filePath), { recursive: true });

    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      this.state = JSON.parse(raw) as DemoState;
    } catch (error) {
      const typedError = error as NodeJS.ErrnoException;
      if (typedError.code !== 'ENOENT') {
        throw error;
      }

      this.state = createDefaultState(this.rpcUrl, this.explorerBaseUrl);
      await this.persist(this.state);
    }

    return clone(this.state);
  }

  async save(nextState: DemoState): Promise<DemoState> {
    const stateToSave = clone({
      ...nextState,
      updatedAt: Date.now(),
    });

    this.state = stateToSave;
    await this.persist(stateToSave);
    return clone(stateToSave);
  }

  async update(
    mutator: (current: DemoState) => DemoState | Promise<DemoState>,
  ): Promise<DemoState> {
    const current = await this.load();
    const next = await mutator(current);
    return this.save(next);
  }

  async reset(): Promise<DemoState> {
    const state = createDefaultState(this.rpcUrl, this.explorerBaseUrl);
    return this.save(state);
  }

  private async persist(state: DemoState): Promise<void> {
    await fs.writeFile(this.filePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  }
}
