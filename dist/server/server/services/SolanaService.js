/**
 * Veridex Treasury Guard — Solana Service
 *
 * Wraps the Veridex SDK Solana spoke client and the Agent SDK Solana chain
 * client for real devnet operations. No mocked chain access is used here.
 */
import { Keypair, PublicKey, LAMPORTS_PER_SOL, } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, createMint, getAccount, getAssociatedTokenAddressSync, getMint, getOrCreateAssociatedTokenAccount, mintTo, transferChecked, } from '@solana/spl-token';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { SolanaClient, getChainConfig } = require('@veridex/sdk');
const { SolanaChainClient } = require('@veridex/agentic-payments');
const SOLANA_CHAIN = getChainConfig('solana', 'testnet');
const DEFAULT_DECIMALS = 6;
function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
function mapRiskLevel(score) {
    if (score >= 85)
        return 'critical';
    if (score >= 65)
        return 'high';
    if (score >= 35)
        return 'medium';
    return 'low';
}
export class SolanaService {
    rpcUrl;
    sdkClient;
    agentClient;
    connection;
    constructor(rpcUrl = SOLANA_CHAIN.rpcUrl) {
        this.rpcUrl = rpcUrl;
        const config = {
            rpcUrl,
            programId: SOLANA_CHAIN.contracts.hub,
            wormholeCoreBridge: SOLANA_CHAIN.contracts.wormholeCoreBridge,
            tokenBridge: SOLANA_CHAIN.contracts.tokenBridge,
            wormholeChainId: SOLANA_CHAIN.wormholeChainId,
            network: 'devnet',
        };
        this.sdkClient = new SolanaClient(config);
        this.agentClient = new SolanaChainClient(config);
        this.connection = this.sdkClient.getConnection();
    }
    getConnection() {
        return this.connection;
    }
    getRpcUrl() {
        return this.rpcUrl;
    }
    getExplorerBaseUrl() {
        return `${SOLANA_CHAIN.explorerUrl}?cluster=devnet`;
    }
    getExplorerAddressUrl(address) {
        return `${SOLANA_CHAIN.explorerUrl}/address/${address}?cluster=devnet`;
    }
    getExplorerTransactionUrl(signature) {
        return `${SOLANA_CHAIN.explorerUrl}/tx/${signature}?cluster=devnet`;
    }
    getExplorerTokenUrl(address) {
        return `${SOLANA_CHAIN.explorerUrl}/address/${address}/tokens?cluster=devnet`;
    }
    computeVaultAddress(keyHash) {
        return this.sdkClient.computeVaultAddress(keyHash);
    }
    async getCurrentSlot() {
        return this.sdkClient.getSlot();
    }
    async getAgentObservedSlot() {
        return this.agentClient.getConnection().getSlot('confirmed');
    }
    generateKeypair() {
        const keypair = Keypair.generate();
        return {
            publicKey: keypair.publicKey.toBase58(),
            secretKey: Array.from(keypair.secretKey),
        };
    }
    restoreKeypair(stored) {
        return Keypair.fromSecretKey(Uint8Array.from(stored.secretKey));
    }
    isValidAddress(address) {
        try {
            new PublicKey(address);
            return true;
        }
        catch {
            return false;
        }
    }
    async requestAirdrop(address, amountInSol = 1) {
        const publicKey = new PublicKey(address);
        const signature = await this.connection.requestAirdrop(publicKey, amountInSol * LAMPORTS_PER_SOL);
        const blockhash = await this.connection.getLatestBlockhash('confirmed');
        await this.connection.confirmTransaction({
            signature,
            blockhash: blockhash.blockhash,
            lastValidBlockHeight: blockhash.lastValidBlockHeight,
        }, 'confirmed');
        return signature;
    }
    async getSolBalance(address) {
        const balance = await this.connection.getBalance(new PublicKey(address), 'confirmed');
        return BigInt(balance);
    }
    async getTokenBalance(ownerAddress, mintAddress) {
        const owner = new PublicKey(ownerAddress);
        const mint = new PublicKey(mintAddress);
        const ata = getAssociatedTokenAddressSync(mint, owner);
        try {
            const account = await getAccount(this.connection, ata);
            return account.amount;
        }
        catch {
            return 0n;
        }
    }
    async getWalletAssets(ownerAddress, symbolHints = {}) {
        const owner = new PublicKey(ownerAddress);
        const [solBalance, tokenAccounts] = await Promise.all([
            this.connection.getBalance(owner, 'confirmed'),
            this.connection.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_PROGRAM_ID }),
        ]);
        const balances = [
            {
                assetType: 'native',
                symbol: 'SOL',
                name: 'Solana',
                mintAddress: null,
                tokenAccount: null,
                amountRaw: solBalance.toString(),
                amountDisplay: (solBalance / LAMPORTS_PER_SOL).toFixed(4),
                decimals: 9,
                explorerUrl: this.getExplorerAddressUrl(ownerAddress),
            },
        ];
        for (const account of tokenAccounts.value) {
            const parsed = account.account.data.parsed;
            const mintAddress = parsed.info?.mint;
            const tokenAmount = parsed.info?.tokenAmount;
            if (!mintAddress || !tokenAmount?.amount) {
                continue;
            }
            const amountDisplay = tokenAmount.uiAmountString ||
                (Number(tokenAmount.amount) / 10 ** (tokenAmount.decimals || 0)).toString();
            const symbol = symbolHints[mintAddress] ||
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
    async getStableAsset(mintAddress, mode) {
        const mint = await getMint(this.connection, new PublicKey(mintAddress));
        return {
            symbol: 'USDX',
            mintAddress,
            decimals: mint.decimals,
            mode,
            supply: mint.supply.toString(),
        };
    }
    async verifyIncomingTokenPayment(params) {
        const transaction = await this.connection.getParsedTransaction(params.signature, {
            commitment: 'confirmed',
            maxSupportedTransactionVersion: 0,
        });
        if (!transaction?.meta) {
            throw new Error('Transaction could not be found on Solana devnet.');
        }
        const receivedAmount = this.getTokenDeltaForOwner(transaction, params.recipientAddress, params.mintAddress);
        const expectedAmountRaw = BigInt(Math.round(params.expectedAmount * 10 ** params.decimals));
        const firstAccount = transaction.transaction.message.accountKeys[0];
        const payerAddress = typeof firstAccount?.pubkey?.toBase58 === 'function'
            ? firstAccount.pubkey.toBase58()
            : typeof firstAccount?.toBase58 === 'function'
                ? firstAccount.toBase58()
                : null;
        return {
            valid: receivedAmount >= expectedAmountRaw,
            payerAddress,
            amountRaw: receivedAmount.toString(),
            explorerUrl: this.getExplorerTransactionUrl(params.signature),
        };
    }
    async validateMint(mintAddress) {
        return this.getStableAsset(mintAddress, 'external-mint');
    }
    async createManagedStableMint(treasury, symbol = 'USDX', initialSupply = 250_000) {
        const payer = this.restoreKeypair(treasury);
        const mintAddress = await createMint(this.connection, payer, payer.publicKey, null, DEFAULT_DECIMALS);
        await this.mintStableTokens(treasury, mintAddress.toBase58(), treasury.publicKey, initialSupply);
        const mint = await this.getStableAsset(mintAddress.toBase58(), 'managed-mint');
        return {
            ...mint,
            symbol,
        };
    }
    async mintStableTokens(authority, mintAddress, recipientAddress, amount) {
        const signer = this.restoreKeypair(authority);
        const mint = new PublicKey(mintAddress);
        const recipient = new PublicKey(recipientAddress);
        const ata = await getOrCreateAssociatedTokenAccount(this.connection, signer, mint, recipient);
        const mintInfo = await getMint(this.connection, mint);
        const amountRaw = BigInt(Math.round(amount * 10 ** mintInfo.decimals));
        return mintTo(this.connection, signer, mint, ata.address, signer, amountRaw);
    }
    async ensureTokenAccount(payer, ownerAddress, mintAddress) {
        const payerKeypair = this.restoreKeypair(payer);
        const tokenAccount = await getOrCreateAssociatedTokenAccount(this.connection, payerKeypair, new PublicKey(mintAddress), new PublicKey(ownerAddress));
        return tokenAccount.address.toBase58();
    }
    async transferStableTokens(params) {
        const payer = this.restoreKeypair(params.treasury);
        const mint = new PublicKey(params.mintAddress);
        const recipient = new PublicKey(params.recipientAddress);
        const treasuryAccount = await getOrCreateAssociatedTokenAccount(this.connection, payer, mint, payer.publicKey);
        const recipientAccount = await getOrCreateAssociatedTokenAccount(this.connection, payer, mint, recipient);
        const mintInfo = await getMint(this.connection, mint);
        const rawAmount = BigInt(Math.round(params.amount * 10 ** mintInfo.decimals));
        const signature = await transferChecked(this.connection, payer, treasuryAccount.address, mint, recipientAccount.address, payer, rawAmount, mintInfo.decimals);
        return {
            signature,
            recipientTokenAccount: recipientAccount.address.toBase58(),
            treasuryTokenAccount: treasuryAccount.address.toBase58(),
        };
    }
    async analyzeAddress(address) {
        const publicKey = new PublicKey(address);
        const [recentSignatures, solBalance, tokenAccounts, slot] = await Promise.all([
            this.connection.getSignaturesForAddress(publicKey, { limit: 15 }),
            this.connection.getBalance(publicKey, 'confirmed'),
            this.connection.getParsedTokenAccountsByOwner(publicKey, { programId: TOKEN_PROGRAM_ID }),
            this.agentClient.getConnection().getSlot('confirmed'),
        ]);
        const notes = [];
        let score = 15;
        if (recentSignatures.length === 0) {
            score += 30;
            notes.push('No confirmed Solana transaction history found for this address.');
        }
        else if (recentSignatures.length < 3) {
            score += 18;
            notes.push('Address has very limited confirmed history on devnet.');
        }
        else {
            score -= 6;
            notes.push(`${recentSignatures.length} recent confirmed signatures observed.`);
        }
        if (tokenAccounts.value.length === 0) {
            score += 12;
            notes.push('No SPL token accounts were found for this recipient.');
        }
        else {
            notes.push(`${tokenAccounts.value.length} SPL token account(s) discovered.`);
        }
        if (solBalance < 0.05 * LAMPORTS_PER_SOL) {
            score += 10;
            notes.push('Recipient SOL balance is low, so the treasury will likely sponsor ATA creation.');
        }
        else {
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
    getTokenDeltaForOwner(transaction, ownerAddress, mintAddress) {
        const preBalances = new Map();
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
}
