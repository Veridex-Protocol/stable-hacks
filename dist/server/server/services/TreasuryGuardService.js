import { createRequire } from 'node:module';
import { PolicyEngine } from './PolicyEngine.js';
import { ResourceValidationService } from './ResourceValidationService.js';
const require = createRequire(import.meta.url);
const { ComplianceExporter } = require('@veridex/agentic-payments');
function createId(prefix) {
    return `${prefix}_${crypto.randomUUID()}`;
}
function createUser(address, role, name) {
    return {
        address,
        role,
        name,
        createdAt: Date.now(),
    };
}
function ensureNumber(value, fallback) {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
function serialiseBigIntAmount(amount, decimals) {
    return BigInt(Math.round(amount * 10 ** decimals));
}
export class TreasuryGuardService {
    store;
    solana;
    policyEngine;
    resourceValidator;
    exporter;
    constructor(store, solana) {
        this.store = store;
        this.solana = solana;
        this.policyEngine = new PolicyEngine(solana);
        this.resourceValidator = new ResourceValidationService(solana);
        this.exporter = new ComplianceExporter();
    }
    async bootstrap(request = {}) {
        const state = await this.store.load();
        if (state.actors.treasury && state.stableAsset) {
            return this.getDashboardState();
        }
        const treasury = this.solana.generateKeypair();
        const operator = this.solana.generateKeypair();
        const approver = this.solana.generateKeypair();
        const auditor = this.solana.generateKeypair();
        await this.solana.requestAirdrop(treasury.publicKey, 2);
        const stableAsset = request.assetMode === 'external-mint' && request.externalMintAddress
            ? await this.solana.validateMint(request.externalMintAddress)
            : await this.solana.createManagedStableMint(treasury, 'USDX', ensureNumber(request.initialMintAmount, 250_000));
        await this.solana.ensureTokenAccount(treasury, treasury.publicKey, stableAsset.mintAddress);
        const policy = {
            id: createId('policy'),
            institutionName: 'Veridex Treasury Guard',
            maxTransactionAmount: 40_000,
            dailySendLimit: 125_000,
            escalationThreshold: 15_000,
            allowedAssets: [stableAsset.mintAddress],
            allowedCorridors: ['NG-SG', 'NG-GB', 'NG-US', 'US-NG', 'GB-NG', 'SG-NG'],
            requireTravelRule: true,
            travelRuleThreshold: 10_000,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            version: 1,
        };
        const validations = await this.resourceValidator.validateAll();
        const nextState = {
            ...state,
            policy,
            stableAsset,
            actors: {
                treasury,
                operator: createUser(operator.publicKey, 'operator', 'Treasury Operator'),
                approver: createUser(approver.publicKey, 'approver', 'Finance Approver'),
                auditor: createUser(auditor.publicKey, 'auditor', 'Audit Reviewer'),
                mintAuthority: treasury,
            },
            validations,
            metadata: {
                ...state.metadata,
                notes: [
                    'Bootstrapped with live Solana devnet identities.',
                    stableAsset.mode === 'managed-mint'
                        ? 'Created a managed SPL stable asset for the self-contained demo.'
                        : 'Configured an external Solana stablecoin mint.',
                ],
            },
        };
        await this.store.save(nextState);
        await this.appendAudit({
            payoutRequestId: 'system',
            action: 'approved',
            actor: 'system',
            details: `Treasury bootstrapped on Solana devnet with asset ${stableAsset.mintAddress}.`,
            policyVersion: policy.version,
            verdict: 'approved',
            verdictReasons: [
                {
                    code: 'BOOTSTRAP_COMPLETE',
                    description: 'Treasury environment is live on Solana devnet.',
                    severity: 'info',
                },
            ],
        });
        return this.getDashboardState();
    }
    async updatePolicy(updates) {
        const state = await this.requireBootstrapped();
        const current = state.policy;
        const nextPolicy = {
            ...current,
            institutionName: updates.institutionName || current.institutionName,
            maxTransactionAmount: ensureNumber(updates.maxTransactionAmount, current.maxTransactionAmount),
            dailySendLimit: ensureNumber(updates.dailySendLimit, current.dailySendLimit),
            escalationThreshold: ensureNumber(updates.escalationThreshold, current.escalationThreshold),
            allowedAssets: updates.allowedAssets?.length ? updates.allowedAssets : current.allowedAssets,
            allowedCorridors: updates.allowedCorridors?.length ? updates.allowedCorridors : current.allowedCorridors,
            requireTravelRule: updates.requireTravelRule ?? current.requireTravelRule,
            travelRuleThreshold: ensureNumber(updates.travelRuleThreshold, current.travelRuleThreshold),
            updatedAt: Date.now(),
            version: current.version + 1,
        };
        await this.store.save({
            ...state,
            policy: nextPolicy,
        });
        await this.appendAudit({
            payoutRequestId: 'system',
            action: 'approved',
            actor: state.actors.approver?.address || 'system',
            details: `Treasury policy updated to version ${nextPolicy.version}.`,
            policyVersion: nextPolicy.version,
            verdict: 'approved',
            verdictReasons: [
                {
                    code: 'POLICY_UPDATED',
                    description: 'Treasury policy changes are live for future payout reviews.',
                    severity: 'info',
                },
            ],
        });
        return this.getDashboardState();
    }
    async createCounterparty(input) {
        const state = await this.requireBootstrapped();
        const walletAddress = input.generateWallet || !input.walletAddress
            ? this.solana.generateKeypair().publicKey
            : input.walletAddress;
        if (!this.solana.isValidAddress(walletAddress)) {
            throw new Error('Invalid Solana public key for counterparty.');
        }
        const telemetry = await this.solana.analyzeAddress(walletAddress);
        const counterparty = {
            id: createId('cp'),
            name: input.name.trim(),
            walletAddress,
            country: input.country.trim().toUpperCase(),
            kycStatus: input.kycStatus,
            kycVerifiedAt: input.kycStatus === 'verified' ? Date.now() : null,
            kycExpiresAt: input.kycStatus === 'verified' ? Date.now() + 1000 * 60 * 60 * 24 * 180 : null,
            kytRiskScore: telemetry.riskScore,
            kytRiskLevel: telemetry.riskLevel,
            kytLastCheckedAt: telemetry.checkedAt,
            sanctioned: Boolean(input.sanctioned),
            approvedCorridors: input.approvedCorridors.map((item) => item.trim().toUpperCase()),
            travelRuleInfo: input.travelRuleInfo,
            telemetry,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        await this.store.save({
            ...state,
            counterparties: [counterparty, ...state.counterparties],
        });
        await this.appendAudit({
            payoutRequestId: counterparty.id,
            action: 'submitted',
            actor: state.actors.operator?.address || 'system',
            details: `Counterparty ${counterparty.name} registered for ${counterparty.country}.`,
            policyVersion: state.policy.version,
            verdict: null,
            verdictReasons: [
                {
                    code: 'COUNTERPARTY_ADDED',
                    description: 'Counterparty profile recorded with live Solana telemetry attached.',
                    severity: 'info',
                },
            ],
        });
        return this.getDashboardState();
    }
    async submitPayout(input) {
        const state = await this.requireBootstrapped();
        const policy = state.policy;
        const counterparty = state.counterparties.find((entry) => entry.id === input.counterpartyId);
        if (!counterparty) {
            throw new Error('Counterparty not found.');
        }
        const assetMintAddress = input.assetMintAddress || state.stableAsset.mintAddress;
        const evaluation = await this.policyEngine.evaluate({
            policy,
            counterparty,
            payouts: state.payouts,
            input,
            assetMintAddress,
        });
        const payout = {
            id: createId('payout'),
            operatorAddress: state.actors.operator?.address || 'system',
            counterpartyId: counterparty.id,
            counterpartyName: counterparty.name,
            recipientAddress: counterparty.walletAddress,
            amount: input.amount,
            asset: assetMintAddress,
            corridor: input.corridor.toUpperCase(),
            memo: input.memo,
            status: evaluation.verdict === 'approved'
                ? 'approved'
                : evaluation.verdict === 'escalated'
                    ? 'escalated'
                    : 'blocked',
            verdict: evaluation.verdict,
            verdictReasons: evaluation.reasons,
            policyVersion: policy.version,
            txSignature: null,
            approverAddress: null,
            approvalNote: null,
            travelRuleMetadata: input.travelRuleMetadata || null,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            settledAt: null,
        };
        const updatedCounterparties = state.counterparties.map((entry) => entry.id === counterparty.id
            ? {
                ...entry,
                telemetry: evaluation.telemetry,
                kytRiskLevel: evaluation.telemetry?.riskLevel || entry.kytRiskLevel,
                kytRiskScore: evaluation.telemetry?.riskScore || entry.kytRiskScore,
                kytLastCheckedAt: evaluation.telemetry?.checkedAt || entry.kytLastCheckedAt,
                updatedAt: Date.now(),
            }
            : entry);
        let nextState = {
            ...state,
            counterparties: updatedCounterparties,
            payouts: [payout, ...state.payouts],
        };
        await this.store.save(nextState);
        await this.appendAudit({
            payoutRequestId: payout.id,
            action: 'evaluated',
            actor: 'policy-engine',
            details: `Payout evaluated as ${evaluation.verdict}.`,
            policyVersion: policy.version,
            verdict: evaluation.verdict,
            verdictReasons: evaluation.reasons,
        });
        if (evaluation.verdict === 'approved') {
            nextState = await this.executePayout(nextState, payout.id, 'Auto-approved by policy engine.');
        }
        return this.getDashboardState();
    }
    async approvePayout(payoutId, input = {}) {
        const state = await this.requireBootstrapped();
        const payout = state.payouts.find((entry) => entry.id === payoutId);
        if (!payout) {
            throw new Error('Payout request not found.');
        }
        if (payout.status !== 'escalated') {
            throw new Error('Only escalated payouts can be approved.');
        }
        const nextState = await this.executePayout(state, payoutId, input.approvalNote || 'Approved by finance reviewer.', state.actors.approver?.address || 'system');
        return this.getDashboardStateFrom(nextState);
    }
    async rejectPayout(payoutId, input = {}) {
        const state = await this.requireBootstrapped();
        const payout = state.payouts.find((entry) => entry.id === payoutId);
        if (!payout) {
            throw new Error('Payout request not found.');
        }
        const nextState = {
            ...state,
            payouts: state.payouts.map((entry) => entry.id === payoutId
                ? {
                    ...entry,
                    status: 'rejected',
                    approverAddress: state.actors.approver?.address || 'system',
                    approvalNote: input.approvalNote || 'Rejected by finance reviewer.',
                    updatedAt: Date.now(),
                }
                : entry),
        };
        await this.store.save(nextState);
        await this.appendAudit({
            payoutRequestId: payoutId,
            action: 'rejected',
            actor: state.actors.approver?.address || 'system',
            details: input.approvalNote || 'Payout rejected after manual review.',
            policyVersion: payout.policyVersion,
            verdict: 'blocked',
            verdictReasons: [
                {
                    code: 'MANUAL_REJECT',
                    description: input.approvalNote || 'Finance reviewer rejected the payout.',
                    severity: 'warning',
                },
            ],
        });
        return this.getDashboardState();
    }
    async refreshValidations() {
        const state = await this.store.load();
        const validations = await this.resourceValidator.validateAll();
        await this.store.save({
            ...state,
            validations,
        });
        return this.getDashboardState();
    }
    async exportAudit(format) {
        const state = await this.store.load();
        const decimals = state.stableAsset?.decimals ?? 6;
        const records = state.payouts.map((payout) => ({
            id: payout.id,
            txHash: payout.txSignature || 'pending',
            status: payout.status === 'settled'
                ? 'confirmed'
                : payout.status === 'failed'
                    ? 'failed'
                    : 'pending',
            chain: 1,
            token: payout.asset,
            amount: serialiseBigIntAmount(payout.amount, decimals),
            recipient: payout.recipientAddress,
            protocol: 'direct',
            timestamp: payout.updatedAt,
            sessionKeyHash: payout.operatorAddress,
        }));
        const filename = `veridex-treasury-guard-audit.${format}`;
        const content = format === 'json'
            ? this.exporter.exportToJSON(records)
            : this.exporter.exportToCSV(records);
        return {
            format,
            filename,
            content,
        };
    }
    async getDashboardState() {
        const state = await this.store.load();
        return this.getDashboardStateFrom(state);
    }
    async seedConnectedWallet(recipientAddress, amount) {
        const state = await this.requireBootstrapped();
        if (!this.solana.isValidAddress(recipientAddress)) {
            throw new Error('Invalid Solana recipient address.');
        }
        const transfer = await this.solana.transferStableTokens({
            mintAddress: state.stableAsset.mintAddress,
            treasury: state.actors.treasury,
            recipientAddress,
            amount,
        });
        await this.appendAudit({
            payoutRequestId: 'connected-wallet-seed',
            action: 'settled',
            actor: state.actors.operator?.address || 'system',
            details: `Connected wallet ${recipientAddress} funded with ${amount.toFixed(2)} ${state.stableAsset.symbol}. Explorer: ${this.solana.getExplorerTransactionUrl(transfer.signature)}`,
            policyVersion: state.policy.version,
            verdict: 'approved',
            verdictReasons: [
                {
                    code: 'CONNECTED_WALLET_FUNDED',
                    description: 'Treasury seeded a connected passkey wallet on Solana devnet.',
                    severity: 'info',
                },
            ],
        });
        return {
            signature: transfer.signature,
            explorerUrl: this.solana.getExplorerTransactionUrl(transfer.signature),
            stableAsset: state.stableAsset,
        };
    }
    async requireBootstrapped() {
        const state = await this.store.load();
        if (!state.actors.treasury || !state.stableAsset || !state.policy) {
            throw new Error('Bootstrap the treasury first.');
        }
        return state;
    }
    async executePayout(state, payoutId, approvalNote, approverAddress) {
        const payout = state.payouts.find((entry) => entry.id === payoutId);
        if (!payout) {
            throw new Error('Payout request not found.');
        }
        if (!state.actors.treasury || !state.stableAsset) {
            throw new Error('Treasury is not ready.');
        }
        try {
            const result = await this.solana.transferStableTokens({
                mintAddress: state.stableAsset.mintAddress,
                treasury: state.actors.treasury,
                recipientAddress: payout.recipientAddress,
                amount: payout.amount,
            });
            const nextState = {
                ...state,
                payouts: state.payouts.map((entry) => entry.id === payoutId
                    ? {
                        ...entry,
                        status: 'settled',
                        verdict: 'approved',
                        txSignature: result.signature,
                        approverAddress: approverAddress || entry.approverAddress,
                        approvalNote,
                        settledAt: Date.now(),
                        updatedAt: Date.now(),
                    }
                    : entry),
            };
            await this.store.save(nextState);
            await this.appendAudit({
                payoutRequestId: payoutId,
                action: 'settled',
                actor: approverAddress || 'policy-engine',
                details: `Stablecoin payout settled on Solana devnet. Explorer: ${this.solana.getExplorerTransactionUrl(result.signature)}`,
                policyVersion: payout.policyVersion,
                verdict: 'approved',
                verdictReasons: payout.verdictReasons,
            });
            return nextState;
        }
        catch (error) {
            const description = error instanceof Error ? error.message : 'Unknown Solana transfer error.';
            const nextState = {
                ...state,
                payouts: state.payouts.map((entry) => entry.id === payoutId
                    ? {
                        ...entry,
                        status: 'failed',
                        approvalNote,
                        approverAddress: approverAddress || entry.approverAddress,
                        updatedAt: Date.now(),
                        verdictReasons: [
                            ...entry.verdictReasons,
                            {
                                code: 'CHAIN_EXECUTION_FAILED',
                                description,
                                severity: 'error',
                            },
                        ],
                    }
                    : entry),
            };
            await this.store.save(nextState);
            await this.appendAudit({
                payoutRequestId: payoutId,
                action: 'blocked',
                actor: approverAddress || 'system',
                details: `On-chain settlement failed: ${description}`,
                policyVersion: payout.policyVersion,
                verdict: 'blocked',
                verdictReasons: [
                    {
                        code: 'CHAIN_EXECUTION_FAILED',
                        description,
                        severity: 'error',
                    },
                ],
            });
            return nextState;
        }
    }
    async appendAudit(entry) {
        const state = await this.store.load();
        await this.store.save({
            ...state,
            auditEntries: [
                {
                    ...entry,
                    id: createId('audit'),
                    timestamp: Date.now(),
                },
                ...state.auditEntries,
            ],
        });
    }
    async getDashboardStateFrom(state) {
        const summary = await this.buildSummary(state);
        return {
            summary,
            policy: state.policy,
            counterparties: state.counterparties,
            payouts: state.payouts,
            auditEntries: state.auditEntries,
            validations: state.validations,
            actors: {
                treasuryAddress: state.actors.treasury?.publicKey || null,
                operatorAddress: state.actors.operator?.address || null,
                approverAddress: state.actors.approver?.address || null,
                auditorAddress: state.actors.auditor?.address || null,
            },
            metadata: state.metadata,
        };
    }
    async buildSummary(state) {
        const treasuryAddress = state.actors.treasury?.publicKey;
        const [lamports, stableBalance] = treasuryAddress && state.stableAsset
            ? await Promise.all([
                this.solana.getSolBalance(treasuryAddress),
                this.solana.getTokenBalance(treasuryAddress, state.stableAsset.mintAddress),
            ])
            : [0n, 0n];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const totalAmountToday = state.payouts
            .filter((payout) => payout.createdAt >= today.getTime())
            .filter((payout) => payout.status === 'settled')
            .reduce((sum, payout) => sum + payout.amount, 0);
        return {
            vaultAddress: treasuryAddress || 'Bootstrap required',
            vaultBalanceLamports: lamports.toString(),
            vaultBalanceUSDC: state.stableAsset
                ? (Number(stableBalance) / 10 ** state.stableAsset.decimals).toFixed(2)
                : '0.00',
            totalPayoutsToday: state.payouts.filter((payout) => payout.createdAt >= today.getTime()).length,
            totalAmountToday,
            pendingApprovals: state.payouts.filter((payout) => payout.status === 'escalated').length,
            activeCounterparties: state.counterparties.length,
            policyVersion: state.policy?.version || 0,
            stableAsset: state.stableAsset,
            explorerAddressUrl: treasuryAddress
                ? this.solana.getExplorerAddressUrl(treasuryAddress)
                : this.solana.getExplorerBaseUrl(),
            lastValidatedAt: state.validations[0]?.checkedAt || null,
        };
    }
}
