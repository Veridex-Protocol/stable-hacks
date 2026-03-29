import type { ApprovalInput, BootstrapRequest, CounterpartyInput, DashboardState, ExportPayload, PayoutSubmissionInput, StableAssetConfig, TreasuryPolicy } from '../types/index.js';
import { DemoStore } from '../store/DemoStore.js';
import { SolanaService } from './SolanaService.js';
export declare class TreasuryGuardService {
    private readonly store;
    private readonly solana;
    private readonly policyEngine;
    private readonly resourceValidator;
    private readonly exporter;
    constructor(store: DemoStore, solana: SolanaService);
    bootstrap(request?: BootstrapRequest): Promise<DashboardState>;
    updatePolicy(updates: Partial<TreasuryPolicy>): Promise<DashboardState>;
    createCounterparty(input: CounterpartyInput): Promise<DashboardState>;
    submitPayout(input: PayoutSubmissionInput): Promise<DashboardState>;
    approvePayout(payoutId: string, input?: ApprovalInput): Promise<DashboardState>;
    rejectPayout(payoutId: string, input?: ApprovalInput): Promise<DashboardState>;
    refreshValidations(): Promise<DashboardState>;
    exportAudit(format: 'json' | 'csv'): Promise<ExportPayload>;
    getDashboardState(): Promise<DashboardState>;
    seedConnectedWallet(recipientAddress: string, amount: number): Promise<{
        signature: string;
        explorerUrl: string;
        stableAsset: StableAssetConfig;
    }>;
    private requireBootstrapped;
    private executePayout;
    private appendAudit;
    private getDashboardStateFrom;
    private buildSummary;
}
