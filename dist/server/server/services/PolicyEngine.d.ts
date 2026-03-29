import type { ComplianceCheckResult, Counterparty, PayoutRequest, PayoutSubmissionInput, TreasuryPolicy } from '../types/index.js';
import { SolanaService } from './SolanaService.js';
export declare class PolicyEngine {
    private readonly solana;
    constructor(solana: SolanaService);
    evaluate(params: {
        policy: TreasuryPolicy;
        counterparty: Counterparty;
        payouts: PayoutRequest[];
        input: PayoutSubmissionInput;
        assetMintAddress: string;
    }): Promise<ComplianceCheckResult>;
}
