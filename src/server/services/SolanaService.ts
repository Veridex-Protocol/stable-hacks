/**
 * Veridex Treasury Guard — Solana Service
 *
 * Wraps the Veridex SDK Solana spoke client and the Agent SDK Solana chain
 * client for real devnet operations. No mocked chain access is used here.
 */
import {
  Connection,
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL,
  type ParsedTransactionWithMeta,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  createMint,
  getAccount,
  getAssociatedTokenAddressSync,
  getMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  transferChecked,
} from '@solana/spl-token';
import { createRequire } from 'node:module';
import type {
  AddressTelemetry,
  StableAssetConfig,
  StoredKeypair,
  WalletAssetBalance,
} from '../types/index';

const require = createRequire(import.meta.url);
const { SolanaClient, getChainConfig } = require('@veridex/sdk') as typeof import('@veridex/sdk');
const { SolanaChainClient } = require('@veridex/agentic-payments') as typeof import('@veridex/agentic-payments');

const SOLANA_CHAIN = getChainConfig('solana', 'testnet');
const DEFAULT_DECIMALS = 6;

function formatAmountFromBaseUnits(amountRaw: bigint, decimals: number): string {
  if (decimals <= 0) {
    return amountRaw.toString();
  }

  const base = 10n ** BigInt(decimals);
  const whole = amountRaw / base;
  const fraction = amountRaw % base;

  if (fraction === 0n) {
    return whole.toString();
  }

  return `${whole.toString()}.${fraction
    .toString()
    .padStart(decimals, '0')
    .replace(/0+$/, '')}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function mapRiskLevel(score: number): AddressTelemetry['riskLevel'] {
  if (score >= 85) return 'critical';
  if (score >= 65) return 'high';
  if (score >= 35) return 'medium';
  return 'low';
}

export class SolanaService {
  private readonly sdkClient: InstanceType<typeof SolanaClient>;
  private readonly agentClient: InstanceType<typeof SolanaChainClient>;
  private readonly connection: Connection;

  constructor(private readonly rpcUrl = SOLANA_CHAIN.rpcUrl) {
    const config = {
      rpcUrl,
      programId: SOLANA_CHAIN.contracts.hub!,
      wormholeCoreBridge: SOLANA_CHAIN.contracts.wormholeCoreBridge!,
      tokenBridge: SOLANA_CHAIN.contracts.tokenBridge!,
      wormholeChainId: SOLANA_CHAIN.wormholeChainId,
      network: 'devnet' as const,
    };

    this.sdkClient = new SolanaClient(config);
    this.agentClient = new SolanaChainClient(config);
    this.connection = this.sdkClient.getConnection();
  }

  getConnection(): Connection {
    return this.connection;
  }

  getRpcUrl(): string {
    return this.rpcUrl;
  }

  getExplorerBaseUrl(): string {
    return `${SOLANA_CHAIN.explorerUrl}?cluster=devnet`;
  }

  getExplorerAddressUrl(address: string): string {
    return `${SOLANA_CHAIN.explorerUrl}/address/${address}?cluster=devnet`;
  }

  getExplorerTransactionUrl(signature: string): string {
    return `${SOLANA_CHAIN.explorerUrl}/tx/${signature}?cluster=devnet`;
  }

  getExplorerTokenUrl(address: string): string {
    return `${SOLANA_CHAIN.explorerUrl}/address/${address}/tokens?cluster=devnet`;
  }

  computeVaultAddress(keyHash: string): string {
    return this.sdkClient.computeVaultAddress(keyHash);
  }

  async getCurrentSlot(): Promise<number> {
    return this.sdkClient.getSlot();
  }

  async getAgentObservedSlot(): Promise<number> {
    return this.agentClient.getConnection().getSlot('confirmed');
  }

  generateKeypair(): StoredKeypair {
    const keypair = Keypair.generate();
    return {
      publicKey: keypair.publicKey.toBase58(),
      secretKey: Array.from(keypair.secretKey),
    };
  }

  restoreKeypair(stored: StoredKeypair): Keypair {
    return Keypair.fromSecretKey(Uint8Array.from(stored.secretKey));
  }

  isValidAddress(address: string): boolean {
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  }

  async requestAirdrop(address: string, amountInSol = 1): Promise<string> {
    const publicKey = new PublicKey(address);
    const signature = await this.connection.requestAirdrop(
      publicKey,
      amountInSol * LAMPORTS_PER_SOL,
    );
    const blockhash = await this.connection.getLatestBlockhash('confirmed');
    await this.connection.confirmTransaction(
      {
        signature,
        blockhash: blockhash.blockhash,
        lastValidBlockHeight: blockhash.lastValidBlockHeight,
      },
      'confirmed',
    );
    return signature;
  }

  async getSolBalance(address: string): Promise<bigint> {
    const balance = await this.connection.getBalance(new PublicKey(address), 'confirmed');
    return BigInt(balance);
  }

  async getTokenBalance(ownerAddress: string, mintAddress: string): Promise<bigint> {
    const owner = new PublicKey(ownerAddress);
    const mint = new PublicKey(mintAddress);
    const ata = getAssociatedTokenAddressSync(mint, owner);

    try {
      const account = await getAccount(this.connection, ata);
      return account.amount;
    } catch {
      return 0n;
    }
  }

  async getWalletAssets(
    ownerAddress: string,
    symbolHints: Record<string, string> = {},
  ): Promise<WalletAssetBalance[]> {
    const owner = new PublicKey(ownerAddress);
    const [solBalance, tokenAccounts] = await Promise.all([
      this.connection.getBalance(owner, 'confirmed'),
      this.connection.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_PROGRAM_ID }),
    ]);

    const balances: WalletAssetBalance[] = [
      {
        assetType: 'native',
        symbol: 'SOL',
        name: 'Solana',
        mintAddress: null,
        tokenAccount: null,
        amountRaw: solBalance.toString(),
        amountDisplay: formatAmountFromBaseUnits(BigInt(solBalance), 9),
        decimals: 9,
        explorerUrl: this.getExplorerAddressUrl(ownerAddress),
      },
    ];

    for (const account of tokenAccounts.value) {
      const parsed = account.account.data.parsed as {
        info?: {
          mint?: string;
          tokenAmount?: {
            amount?: string;
            decimals?: number;
            uiAmountString?: string;
          };
        };
      };
      const mintAddress = parsed.info?.mint;
      const tokenAmount = parsed.info?.tokenAmount;

      if (!mintAddress || !tokenAmount?.amount) {
        continue;
      }

      const amountDisplay =
        tokenAmount.uiAmountString ||
        (Number(tokenAmount.amount) / 10 ** (tokenAmount.decimals || 0)).toString();
      const symbol =
        symbolHints[mintAddress] ||
        `SPL-${mintAddress.slice(0, 4).toUpperCase()}`;

      balances.push({
        assetType: 'spl',
        symbol,
        name: symbolHints[mintAddress] ? `${symbolHints[mintAddress]} Token` : 'SPL Token',
        mintAddress,
        tokenAccount: account.pubkey.toBase58(),
        amountRaw: tokenAmount.amount,
        amountDisplay,
        decimals: tokenAmount.decimals || 0,
        explorerUrl: this.getExplorerAddressUrl(mintAddress),
      });
    }

    return balances.sort((left, right) => Number(right.amountDisplay) - Number(left.amountDisplay));
  }

  async getStableAsset(mintAddress: string, mode: StableAssetConfig['mode']): Promise<StableAssetConfig> {
    const mint = await getMint(this.connection, new PublicKey(mintAddress));

    return {
      symbol: 'USDX',
      mintAddress,
      decimals: mint.decimals,
      mode,
      supply: mint.supply.toString(),
    };
  }

  async verifyIncomingTokenPayment(params: {
    signature: string;
    recipientAddress: string;
    mintAddress: string;
    expectedAmount: number;
    decimals: number;
  }): Promise<{
    valid: boolean;
    payerAddress: string | null;
    sourceOwnerAddress: string | null;
    amountRaw: string;
    explorerUrl: string;
  }> {
    const transaction = await this.connection.getParsedTransaction(params.signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    });

    if (!transaction?.meta) {
      throw new Error('Transaction could not be found on Solana devnet.');
    }

    const receivedAmount = this.getTokenDeltaForOwner(
      transaction,
      params.recipientAddress,
      params.mintAddress,
    );
    const expectedAmountRaw = BigInt(Math.round(params.expectedAmount * 10 ** params.decimals));

    const firstAccount = transaction.transaction.message.accountKeys[0] as any;
    const payerAddress =
      typeof firstAccount?.pubkey?.toBase58 === 'function'
        ? firstAccount.pubkey.toBase58()
        : typeof firstAccount?.toBase58 === 'function'
          ? firstAccount.toBase58()
          : null;

    return {
      valid: receivedAmount >= expectedAmountRaw,
      payerAddress,
      sourceOwnerAddress: this.getSourceOwnerForMintTransfer(
        transaction,
        params.recipientAddress,
        params.mintAddress,
      ),
      amountRaw: receivedAmount.toString(),
      explorerUrl: this.getExplorerTransactionUrl(params.signature),
    };
  }

  async validateMint(mintAddress: string): Promise<StableAssetConfig> {
    return this.getStableAsset(mintAddress, 'external-mint');
  }

  async createManagedStableMint(
    treasury: StoredKeypair,
    symbol = 'USDX',
    initialSupply = 250_000,
  ): Promise<StableAssetConfig> {
    const payer = this.restoreKeypair(treasury);
    const mintAddress = await createMint(
      this.connection,
      payer,
      payer.publicKey,
      null,
      DEFAULT_DECIMALS,
    );

    await this.mintStableTokens(treasury, mintAddress.toBase58(), treasury.publicKey, initialSupply);

    const mint = await this.getStableAsset(mintAddress.toBase58(), 'managed-mint');
    return {
      ...mint,
      symbol,
    };
  }

  async mintStableTokens(
    authority: StoredKeypair,
    mintAddress: string,
    recipientAddress: string,
    amount: number,
  ): Promise<string> {
    const signer = this.restoreKeypair(authority);
    const mint = new PublicKey(mintAddress);
    const recipient = new PublicKey(recipientAddress);
    const ata = await getOrCreateAssociatedTokenAccount(
      this.connection,
      signer,
      mint,
      recipient,
    );
    const mintInfo = await getMint(this.connection, mint);
    const amountRaw = BigInt(Math.round(amount * 10 ** mintInfo.decimals));

    return mintTo(
      this.connection,
      signer,
      mint,
      ata.address,
      signer,
      amountRaw,
    );
  }

  async ensureTokenAccount(
    payer: StoredKeypair,
    ownerAddress: string,
    mintAddress: string,
  ): Promise<string> {
    const payerKeypair = this.restoreKeypair(payer);
    const tokenAccount = await getOrCreateAssociatedTokenAccount(
      this.connection,
      payerKeypair,
      new PublicKey(mintAddress),
      new PublicKey(ownerAddress),
    );

    return tokenAccount.address.toBase58();
  }

  async transferStableTokens(params: {
    mintAddress: string;
    treasury: StoredKeypair;
    recipientAddress: string;
    amount: number;
  }): Promise<{
    signature: string;
    recipientTokenAccount: string;
    treasuryTokenAccount: string;
  }> {
    const payer = this.restoreKeypair(params.treasury);
    const mint = new PublicKey(params.mintAddress);
    const recipient = new PublicKey(params.recipientAddress);
    const treasuryAccount = await getOrCreateAssociatedTokenAccount(
      this.connection,
      payer,
      mint,
      payer.publicKey,
    );
    const recipientAccount = await getOrCreateAssociatedTokenAccount(
      this.connection,
      payer,
      mint,
      recipient,
    );
    const mintInfo = await getMint(this.connection, mint);
    const rawAmount = BigInt(Math.round(params.amount * 10 ** mintInfo.decimals));

    const signature = await transferChecked(
      this.connection,
      payer,
      treasuryAccount.address,
      mint,
      recipientAccount.address,
      payer,
      rawAmount,
      mintInfo.decimals,
    );

    return {
      signature,
      recipientTokenAccount: recipientAccount.address.toBase58(),
      treasuryTokenAccount: treasuryAccount.address.toBase58(),
    };
  }

  async analyzeAddress(address: string): Promise<AddressTelemetry> {
    const publicKey = new PublicKey(address);
    const [recentSignatures, solBalance, tokenAccounts, slot] = await Promise.all([
      this.connection.getSignaturesForAddress(publicKey, { limit: 15 }),
      this.connection.getBalance(publicKey, 'confirmed'),
      this.connection.getParsedTokenAccountsByOwner(publicKey, { programId: TOKEN_PROGRAM_ID }),
      this.agentClient.getConnection().getSlot('confirmed'),
    ]);

    const notes: string[] = [];
    let score = 15;

    if (recentSignatures.length === 0) {
      score += 30;
      notes.push('No confirmed Solana transaction history found for this address.');
    } else if (recentSignatures.length < 3) {
      score += 18;
      notes.push('Address has very limited confirmed history on devnet.');
    } else {
      score -= 6;
      notes.push(`${recentSignatures.length} recent confirmed signatures observed.`);
    }

    if (tokenAccounts.value.length === 0) {
      score += 12;
      notes.push('No SPL token accounts were found for this recipient.');
    } else {
      notes.push(`${tokenAccounts.value.length} SPL token account(s) discovered.`);
    }

    if (solBalance < 0.05 * LAMPORTS_PER_SOL) {
      score += 10;
      notes.push('Recipient SOL balance is low, so the treasury will likely sponsor ATA creation.');
    } else {
      score -= 4;
      notes.push('Recipient has enough SOL for routine token account activity.');
    }

    const riskScore = clamp(score, 0, 100);
    const riskLevel = mapRiskLevel(riskScore);

    return {
      address,
      recentSignatures: recentSignatures.length,
      solBalanceLamports: String(solBalance),
      tokenAccounts: tokenAccounts.value.length,
      currentSlot: slot,
      riskScore,
      riskLevel,
      notes,
      checkedAt: Date.now(),
    };
  }

  private getTokenDeltaForOwner(
    transaction: ParsedTransactionWithMeta,
    ownerAddress: string,
    mintAddress: string,
  ): bigint {
    const preBalances = new Map<string, bigint>();

    for (const balance of transaction.meta?.preTokenBalances || []) {
      if (balance.owner === ownerAddress && balance.mint === mintAddress) {
        preBalances.set(balance.accountIndex.toString(), BigInt(balance.uiTokenAmount.amount));
      }
    }

    let totalDelta = 0n;

    for (const balance of transaction.meta?.postTokenBalances || []) {
      if (balance.owner !== ownerAddress || balance.mint !== mintAddress) {
        continue;
      }

      const key = balance.accountIndex.toString();
      const postAmount = BigInt(balance.uiTokenAmount.amount);
      const preAmount = preBalances.get(key) || 0n;
      totalDelta += postAmount - preAmount;
    }

    return totalDelta > 0n ? totalDelta : 0n;
  }

  private getSourceOwnerForMintTransfer(
    transaction: ParsedTransactionWithMeta,
    recipientAddress: string,
    mintAddress: string,
  ): string | null {
    let candidate: { owner: string; delta: bigint } | null = null;

    for (const balance of transaction.meta?.preTokenBalances || []) {
      if (!balance.owner || balance.owner === recipientAddress || balance.mint !== mintAddress) {
        continue;
      }

      const postBalance = (transaction.meta?.postTokenBalances || []).find(
        (entry) =>
          entry.accountIndex === balance.accountIndex &&
          entry.owner === balance.owner &&
          entry.mint === balance.mint,
      );

      const before = BigInt(balance.uiTokenAmount.amount);
      const after = BigInt(postBalance?.uiTokenAmount.amount || '0');
      const delta = before - after;

      if (delta <= 0n) {
        continue;
      }

      if (!candidate || delta > candidate.delta) {
        candidate = {
          owner: balance.owner,
          delta,
        };
      }
    }

    return candidate?.owner || null;
  }
}
