import { AssetType, AuthSessionStatus, FundingEventStatus, FundingEventType, } from '@prisma/client';
import { prisma } from '../db.js';
import { CommerceService } from './CommerceService.js';
const RELAYER_API_FALLBACK = 'https://amused-kameko-veridex-demo-37453117.koyeb.app/api/v1';
const RELAYER_API_CANDIDATES = Array.from(new Set([process.env.VERIDEX_RELAYER_API_URL, RELAYER_API_FALLBACK].filter((value) => Boolean(value))));
const DEFAULT_FAUCET_URL = 'https://faucet.circle.com/';
const SESSION_REVALIDATION_WINDOW_MS = 5 * 60 * 1000;
function createCaptureId() {
    return `capture_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
}
function toAuthStatus(status) {
    switch (status) {
        case AuthSessionStatus.ACTIVE:
            return 'active';
        case AuthSessionStatus.EXPIRED:
            return 'expired';
        case AuthSessionStatus.REVOKED:
            return 'revoked';
        default:
            return 'invalid';
    }
}
function toFundingEventType(type) {
    switch (type) {
        case FundingEventType.AIRDROP:
            return 'airdrop';
        case FundingEventType.TREASURY_SEED:
            return 'treasury-seed';
        default:
            return 'manual';
    }
}
function toFundingStatus(status) {
    switch (status) {
        case FundingEventStatus.CONFIRMED:
            return 'confirmed';
        case FundingEventStatus.FAILED:
            return 'failed';
        default:
            return 'pending';
    }
}
export class WorkspaceService {
    solana;
    treasuryGuard;
    commerce;
    constructor(solana, treasuryGuard) {
        this.solana = solana;
        this.treasuryGuard = treasuryGuard;
        this.commerce = new CommerceService(solana, treasuryGuard);
    }
    async connectWallet(input) {
        const walletAddress = input.walletAddress || this.solana.computeVaultAddress(input.credential.keyHash);
        if (!this.solana.isValidAddress(walletAddress)) {
            throw new Error('Invalid Solana wallet address.');
        }
        if (!input.authSession?.id) {
            throw new Error('A valid Auth Session is required before connecting the workspace.');
        }
        const relayerSession = await this.validateRelayerSession(input.authSession.id);
        if (!relayerSession) {
            throw new Error('Unable to validate the Auth Session with the relayer.');
        }
        if (relayerSession.keyHash !== input.credential.keyHash) {
            throw new Error('The Auth Session key does not match the connected passkey credential.');
        }
        const explorerUrl = this.solana.getExplorerAddressUrl(walletAddress);
        const profile = await prisma.treasuryProfile.upsert({
            where: { keyHash: input.credential.keyHash },
            create: {
                username: input.username.trim(),
                displayName: input.displayName.trim(),
                keyHash: input.credential.keyHash,
                credentialId: input.credential.credentialId,
                publicKeyX: input.credential.publicKeyX,
                publicKeyY: input.credential.publicKeyY,
                walletAddress,
                walletExplorerUrl: explorerUrl,
                authOrigin: input.authOrigin || relayerSession.appOrigin,
                lastAuthenticatedAt: new Date(),
            },
            update: {
                username: input.username.trim(),
                displayName: input.displayName.trim(),
                credentialId: input.credential.credentialId,
                publicKeyX: input.credential.publicKeyX,
                publicKeyY: input.credential.publicKeyY,
                walletAddress,
                walletExplorerUrl: explorerUrl,
                authOrigin: input.authOrigin || relayerSession.appOrigin,
                lastAuthenticatedAt: new Date(),
            },
        });
        await prisma.authSession.upsert({
            where: { serverSessionId: relayerSession.id },
            create: {
                profileId: profile.id,
                serverSessionId: relayerSession.id,
                keyHash: relayerSession.keyHash,
                appOrigin: relayerSession.appOrigin,
                permissions: relayerSession.permissions,
                expiresAt: new Date(relayerSession.expiresAt),
                relayerIssuedAt: new Date(relayerSession.createdAt),
                lastValidatedAt: new Date(),
                status: relayerSession.expiresAt > Date.now() ? AuthSessionStatus.ACTIVE : AuthSessionStatus.EXPIRED,
            },
            update: {
                profileId: profile.id,
                keyHash: relayerSession.keyHash,
                appOrigin: relayerSession.appOrigin,
                permissions: relayerSession.permissions,
                expiresAt: new Date(relayerSession.expiresAt),
                relayerIssuedAt: new Date(relayerSession.createdAt),
                lastValidatedAt: new Date(),
                status: relayerSession.expiresAt > Date.now() ? AuthSessionStatus.ACTIVE : AuthSessionStatus.EXPIRED,
            },
        });
        await this.captureAssets(profile.id, profile.walletAddress);
        return this.getWorkspaceState(profile.id, relayerSession.id);
    }
    async getWorkspaceState(profileId, sessionId) {
        await this.expireStaleSessions(profileId);
        const profile = await prisma.treasuryProfile.findUnique({
            where: { id: profileId },
        });
        if (!profile) {
            throw new Error('Connected wallet profile not found.');
        }
        const activeSession = sessionId
            ? await prisma.authSession.findFirst({
                where: { profileId, serverSessionId: sessionId },
                orderBy: { updatedAt: 'desc' },
            })
            : await prisma.authSession.findFirst({
                where: { profileId, status: AuthSessionStatus.ACTIVE },
                orderBy: { updatedAt: 'desc' },
            });
        const latestSnapshot = await prisma.assetSnapshot.findFirst({
            where: { profileId },
            orderBy: { capturedAt: 'desc' },
        });
        const assetRows = latestSnapshot
            ? await prisma.assetSnapshot.findMany({
                where: { profileId, captureId: latestSnapshot.captureId },
                orderBy: { capturedAt: 'desc' },
            })
            : [];
        const fundingEvents = await prisma.fundingEvent.findMany({
            where: { profileId },
            orderBy: { createdAt: 'desc' },
            take: 8,
        });
        const commerce = await this.commerce.getProfileCommerce(profile.id, profile.authOrigin || 'http://localhost:5173');
        const treasury = await this.treasuryGuard.getDashboardState();
        return {
            profile: this.mapProfile(profile),
            authSession: activeSession ? this.mapAuthSession(activeSession) : null,
            assets: assetRows.map((row) => this.mapAsset(row)),
            fundingEvents: fundingEvents.map((row) => this.mapFundingEvent(row)),
            paymentLinks: commerce.paymentLinks,
            invoices: commerce.invoices,
            receipts: commerce.receipts,
            treasury: {
                ready: Boolean(treasury.policy && treasury.summary.stableAsset),
                vaultAddress: treasury.actors.treasuryAddress,
                explorerUrl: treasury.summary.explorerAddressUrl,
                stableAsset: treasury.summary.stableAsset,
            },
            guidance: {
                faucetUrl: DEFAULT_FAUCET_URL,
                explorerUrl: profile.walletExplorerUrl,
                relayerUrl: RELAYER_API_CANDIDATES[0] || RELAYER_API_FALLBACK,
                fundingSteps: [
                    'Authenticate with your passkey to mint a fresh Auth Session and persist wallet ownership.',
                    'Use the built-in devnet SOL airdrop to pay for token account creation and testnet activity.',
                    'If the treasury is bootstrapped, seed the wallet with the managed Solana stable asset to exercise payment flows.',
                ],
            },
        };
    }
    async refreshAssets(profileId, sessionId) {
        const profile = await this.ensureAuthorizedProfile(profileId, sessionId);
        await this.captureAssets(profile.id, profile.walletAddress);
        return this.getWorkspaceState(profile.id, sessionId);
    }
    async requestWalletAirdrop(profileId, sessionId, amount = 1) {
        const profile = await this.ensureAuthorizedProfile(profileId, sessionId);
        const signature = await this.solana.requestAirdrop(profile.walletAddress, amount);
        await prisma.fundingEvent.create({
            data: {
                profileId: profile.id,
                eventType: FundingEventType.AIRDROP,
                status: FundingEventStatus.CONFIRMED,
                assetSymbol: 'SOL',
                amountRaw: Math.round(amount * 1_000_000_000).toString(),
                amountDisplay: amount.toFixed(2),
                sourceAddress: 'solana-devnet-airdrop',
                destinationAddress: profile.walletAddress,
                signature,
                explorerUrl: this.solana.getExplorerTransactionUrl(signature),
                notes: 'Devnet SOL requested via the app funding workflow.',
            },
        });
        await this.captureAssets(profile.id, profile.walletAddress);
        return this.getWorkspaceState(profile.id, sessionId);
    }
    async seedStablecoin(profileId, sessionId, amount = 250) {
        const profile = await this.ensureAuthorizedProfile(profileId, sessionId);
        const result = await this.treasuryGuard.seedConnectedWallet(profile.walletAddress, amount);
        await prisma.fundingEvent.create({
            data: {
                profileId: profile.id,
                eventType: FundingEventType.TREASURY_SEED,
                status: FundingEventStatus.CONFIRMED,
                assetSymbol: result.stableAsset.symbol,
                mintAddress: result.stableAsset.mintAddress,
                amountRaw: Math.round(amount * 10 ** result.stableAsset.decimals).toString(),
                amountDisplay: amount.toFixed(2),
                sourceAddress: (await this.treasuryGuard.getDashboardState()).actors.treasuryAddress,
                destinationAddress: profile.walletAddress,
                signature: result.signature,
                explorerUrl: result.explorerUrl,
                notes: 'Treasury seeded the connected wallet with Solana stable liquidity.',
            },
        });
        await this.captureAssets(profile.id, profile.walletAddress);
        return this.getWorkspaceState(profile.id, sessionId);
    }
    async ensureAuthorizedProfile(profileId, sessionId) {
        if (!sessionId) {
            throw new Error('An active Auth Session is required for this action.');
        }
        const profile = await prisma.treasuryProfile.findUnique({
            where: { id: profileId },
        });
        if (!profile) {
            throw new Error('Connected wallet profile not found.');
        }
        const session = await prisma.authSession.findFirst({
            where: { profileId, serverSessionId: sessionId },
            orderBy: { updatedAt: 'desc' },
        });
        if (!session) {
            throw new Error('Stored Auth Session not found for this wallet.');
        }
        if (session.expiresAt.getTime() <= Date.now()) {
            await prisma.authSession.update({
                where: { id: session.id },
                data: { status: AuthSessionStatus.EXPIRED },
            });
            throw new Error('The current Auth Session has expired. Re-authenticate to continue.');
        }
        if (!session.lastValidatedAt ||
            Date.now() - session.lastValidatedAt.getTime() > SESSION_REVALIDATION_WINDOW_MS) {
            const relayerSession = await this.validateRelayerSession(session.serverSessionId);
            await prisma.authSession.update({
                where: { id: session.id },
                data: {
                    lastValidatedAt: new Date(),
                    status: relayerSession ? AuthSessionStatus.ACTIVE : AuthSessionStatus.INVALID,
                },
            });
            if (!relayerSession) {
                throw new Error('The stored Auth Session is no longer valid with the relayer.');
            }
        }
        return profile;
    }
    async captureAssets(profileId, walletAddress) {
        const dashboard = await this.treasuryGuard.getDashboardState();
        const symbolHints = dashboard.summary.stableAsset
            ? { [dashboard.summary.stableAsset.mintAddress]: dashboard.summary.stableAsset.symbol }
            : {};
        const balances = await this.solana.getWalletAssets(walletAddress, symbolHints);
        const captureId = createCaptureId();
        await prisma.assetSnapshot.createMany({
            data: balances.map((asset) => ({
                captureId,
                profileId,
                walletAddress,
                assetType: asset.assetType === 'native' ? AssetType.NATIVE : AssetType.SPL,
                symbol: asset.symbol,
                name: asset.name,
                mintAddress: asset.mintAddress,
                tokenAccount: asset.tokenAccount,
                amountRaw: asset.amountRaw,
                amountDisplay: asset.amountDisplay,
                decimals: asset.decimals,
                explorerUrl: asset.explorerUrl,
            })),
        });
    }
    async expireStaleSessions(profileId) {
        await prisma.authSession.updateMany({
            where: {
                profileId,
                status: AuthSessionStatus.ACTIVE,
                expiresAt: { lte: new Date() },
            },
            data: { status: AuthSessionStatus.EXPIRED },
        });
    }
    async validateRelayerSession(sessionId) {
        for (const relayerUrl of RELAYER_API_CANDIDATES) {
            const response = await fetch(`${relayerUrl}/session/${encodeURIComponent(sessionId)}`, {
                headers: {
                    accept: 'application/json',
                    'user-agent': 'Veridex-Treasury-Guard/1.0 (+StableHacks-2026)',
                },
            }).catch(() => null);
            if (!response?.ok) {
                continue;
            }
            const payload = (await response.json());
            if (payload?.valid && payload.session) {
                return payload.session;
            }
        }
        return null;
    }
    mapProfile(profile) {
        return {
            id: profile.id,
            username: profile.username,
            displayName: profile.displayName,
            keyHash: profile.keyHash,
            credentialId: profile.credentialId,
            walletAddress: profile.walletAddress,
            walletExplorerUrl: profile.walletExplorerUrl,
            authOrigin: profile.authOrigin,
            lastAuthenticatedAt: profile.lastAuthenticatedAt?.getTime() || null,
            createdAt: profile.createdAt.getTime(),
            updatedAt: profile.updatedAt.getTime(),
        };
    }
    mapAuthSession(session) {
        return {
            id: session.serverSessionId,
            keyHash: session.keyHash,
            appOrigin: session.appOrigin,
            permissions: Array.isArray(session.permissions) ? session.permissions : [],
            expiresAt: session.expiresAt.getTime(),
            createdAt: session.relayerIssuedAt.getTime(),
            lastValidatedAt: session.lastValidatedAt?.getTime() || null,
            status: toAuthStatus(session.status),
        };
    }
    mapAsset(asset) {
        return {
            id: asset.id,
            captureId: asset.captureId,
            assetType: asset.assetType === AssetType.NATIVE ? 'native' : 'spl',
            symbol: asset.symbol,
            name: asset.name || asset.symbol,
            mintAddress: asset.mintAddress,
            tokenAccount: asset.tokenAccount,
            amountRaw: asset.amountRaw,
            amountDisplay: asset.amountDisplay,
            decimals: asset.decimals,
            explorerUrl: asset.explorerUrl || '',
            capturedAt: asset.capturedAt.getTime(),
        };
    }
    mapFundingEvent(event) {
        return {
            id: event.id,
            eventType: toFundingEventType(event.eventType),
            status: toFundingStatus(event.status),
            assetSymbol: event.assetSymbol,
            mintAddress: event.mintAddress,
            amountRaw: event.amountRaw,
            amountDisplay: event.amountDisplay,
            sourceAddress: event.sourceAddress,
            destinationAddress: event.destinationAddress,
            signature: event.signature,
            explorerUrl: event.explorerUrl,
            notes: event.notes,
            createdAt: event.createdAt.getTime(),
            updatedAt: event.updatedAt.getTime(),
        };
    }
}
