/**
 * Veridex Treasury Guard — Solana Service
 *
 * Wraps the Veridex SDK Solana spoke client and the Agent SDK Solana chain
 * client for real devnet operations. No mocked chain access is used here.
 */
import { Connection, Keypair } from '@solana/web3.js';
import type { AddressTelemetry, StableAssetConfig, StoredKeypair, WalletAssetBalance } from '../types/index.js';
export declare class SolanaService {
    private readonly rpcUrl;
    private readonly sdkClient;
    private readonly agentClient;
    private readonly connection;
    constructor(rpcUrl?: string);
    getConnection(): Connection;
    getRpcUrl(): string;
    getExplorerBaseUrl(): string;
    getExplorerAddressUrl(address: string): string;
    getExplorerTransactionUrl(signature: string): string;
    getExplorerTokenUrl(address: string): string;
    computeVaultAddress(keyHash: string): string;
    getCurrentSlot(): Promise<number>;
    getAgentObservedSlot(): Promise<number>;
    generateKeypair(): StoredKeypair;
    restoreKeypair(stored: StoredKeypair): Keypair;
    isValidAddress(address: string): boolean;
    requestAirdrop(address: string, amountInSol?: number): Promise<string>;
    getSolBalance(address: string): Promise<bigint>;
    getTokenBalance(ownerAddress: string, mintAddress: string): Promise<bigint>;
    getWalletAssets(ownerAddress: string, symbolHints?: Record<string, string>): Promise<WalletAssetBalance[]>;
    getStableAsset(mintAddress: string, mode: StableAssetConfig['mode']): Promise<StableAssetConfig>;
    verifyIncomingTokenPayment(params: {
        signature: string;
        recipientAddress: string;
        mintAddress: string;
        expectedAmount: number;
        decimals: number;
    }): Promise<{
        valid: boolean;
        payerAddress: string | null;
        amountRaw: string;
        explorerUrl: string;
    }>;
    validateMint(mintAddress: string): Promise<StableAssetConfig>;
    createManagedStableMint(treasury: StoredKeypair, symbol?: string, initialSupply?: number): Promise<StableAssetConfig>;
    mintStableTokens(authority: StoredKeypair, mintAddress: string, recipientAddress: string, amount: number): Promise<string>;
    ensureTokenAccount(payer: StoredKeypair, ownerAddress: string, mintAddress: string): Promise<string>;
    transferStableTokens(params: {
        mintAddress: string;
        treasury: StoredKeypair;
        recipientAddress: string;
        amount: number;
    }): Promise<{
        signature: string;
        recipientTokenAccount: string;
        treasuryTokenAccount: string;
    }>;
    analyzeAddress(address: string): Promise<AddressTelemetry>;
    private getTokenDeltaForOwner;
}
