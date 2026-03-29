import type { TreasuryWorkspaceState, WorkspaceConnectInput } from '../types/index.js';
import { SolanaService } from './SolanaService.js';
import { TreasuryGuardService } from './TreasuryGuardService.js';
export declare class WorkspaceService {
    private readonly solana;
    private readonly treasuryGuard;
    private readonly commerce;
    constructor(solana: SolanaService, treasuryGuard: TreasuryGuardService);
    connectWallet(input: WorkspaceConnectInput): Promise<TreasuryWorkspaceState>;
    getWorkspaceState(profileId: string, sessionId?: string): Promise<TreasuryWorkspaceState>;
    refreshAssets(profileId: string, sessionId?: string): Promise<TreasuryWorkspaceState>;
    requestWalletAirdrop(profileId: string, sessionId: string | undefined, amount?: number): Promise<TreasuryWorkspaceState>;
    seedStablecoin(profileId: string, sessionId: string | undefined, amount?: number): Promise<TreasuryWorkspaceState>;
    private ensureAuthorizedProfile;
    private captureAssets;
    private expireStaleSessions;
    private validateRelayerSession;
    private mapProfile;
    private mapAuthSession;
    private mapAsset;
    private mapFundingEvent;
}
