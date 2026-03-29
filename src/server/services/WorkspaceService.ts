import {
  AssetType,
  AuthSessionStatus,
  FundingEventStatus,
  FundingEventType,
  Prisma,
  type AssetSnapshot,
  type AuthSession,
  type FundingEvent,
  type TreasuryProfile,
} from '@prisma/client';
import { prisma } from '../db';
import { getVeridexRelayerApiUrl, normalizeRelayerApiUrl } from '@/lib/veridex-auth';
import { debugLog } from '@/server/utils/debugLog';
import type {
  AuthSessionRecord,
  FundingEventRecord,
  TrackedAssetSnapshot,
  TreasuryWorkspaceProfile,
  TreasuryWorkspaceState,
  WorkspaceConnectInput,
} from '../types/index';
import { CommerceService } from './CommerceService';
import { SolanaService } from './SolanaService';
import { TreasuryGuardService } from './TreasuryGuardService';

const RELAYER_API_FALLBACK = getVeridexRelayerApiUrl();
const RELAYER_API_CANDIDATES = Array.from(
  new Set(
    [process.env.VERIDEX_RELAYER_API_URL, RELAYER_API_FALLBACK]
      .filter(
      (value): value is string => Boolean(value),
      )
      .map((value) => normalizeRelayerApiUrl(value)),
  ),
);
const DEFAULT_FAUCET_URL = 'https://faucet.circle.com/';
const SESSION_REVALIDATION_WINDOW_MS = 5 * 60 * 1000;
const LOCAL_SESSION_PREFIX = 'local_';
const PERSISTENCE_WARNING_INTERVAL_MS = 10_000;

interface RelayerSessionPayload {
  id: string;
  keyHash: string;
  appOrigin: string;
  permissions: string[];
  expiresAt: number;
  createdAt: number;
}

function createCaptureId(): string {
  return `capture_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
}

function isLocalSessionId(sessionId: string): boolean {
  return sessionId.startsWith(LOCAL_SESSION_PREFIX);
}

function getSessionSource(sessionId: string): 'local' | 'veridex' {
  return isLocalSessionId(sessionId) ? 'local' : 'veridex';
}

function toAuthStatus(status: AuthSessionStatus): AuthSessionRecord['status'] {
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

function toFundingEventType(type: FundingEventType): FundingEventRecord['eventType'] {
  switch (type) {
    case FundingEventType.AIRDROP:
      return 'airdrop';
    case FundingEventType.TREASURY_SEED:
      return 'treasury-seed';
    default:
      return 'manual';
  }
}

function toFundingStatus(status: FundingEventStatus): FundingEventRecord['status'] {
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
  private readonly commerce: CommerceService;
  private readonly workspaceCache = new Map<string, TreasuryWorkspaceState>();
  private readonly sessionProfileIndex = new Map<string, string>();
  private lastPersistenceWarningAt = 0;

  constructor(
    private readonly solana: SolanaService,
    private readonly treasuryGuard: TreasuryGuardService,
  ) {
    this.commerce = new CommerceService(solana, treasuryGuard);
  }

  async connectWallet(input: WorkspaceConnectInput): Promise<TreasuryWorkspaceState> {
    const walletAddress = input.walletAddress || this.solana.computeVaultAddress(input.credential.keyHash);

    if (!this.solana.isValidAddress(walletAddress)) {
      throw new Error('Invalid Solana wallet address.');
    }

    if (!input.authSession?.id) {
      throw new Error('A valid Auth Session is required before connecting the workspace.');
    }

    const sessionSource = input.authSession.source || getSessionSource(input.authSession.id);
    const localSessionPayload = {
      id: input.authSession.id,
      keyHash: input.authSession.keyHash,
      appOrigin: input.authSession.appOrigin,
      permissions: input.authSession.permissions,
      expiresAt: input.authSession.expiresAt,
      createdAt: input.authSession.createdAt,
    };
    const relayerSession =
      sessionSource === 'local' ? localSessionPayload : await this.validateRelayerSession(input.authSession.id);

    if (!relayerSession) {
      throw new Error('Unable to validate the Auth Session with the relayer.');
    }

    if (relayerSession.keyHash !== input.credential.keyHash) {
      throw new Error('The Auth Session key does not match the connected passkey credential.');
    }

    const explorerUrl = this.solana.getExplorerAddressUrl(walletAddress);
    const profileData = {
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
    };

    let profile: TreasuryProfile;

    try {
      profile = await prisma.treasuryProfile.upsert({
        where: { keyHash: input.credential.keyHash },
        create: profileData,
        update: profileData,
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
        throw error;
      }

      const existingProfile = await prisma.treasuryProfile.findFirst({
        where: {
          OR: [
            { keyHash: input.credential.keyHash },
            { credentialId: input.credential.credentialId },
            { walletAddress },
          ],
        },
      });

      if (!existingProfile) {
        throw error;
      }

      profile = await prisma.treasuryProfile.update({
        where: { id: existingProfile.id },
        data: profileData,
      });
    }

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

    return this.cacheState(await this.getWorkspaceState(profile.id, relayerSession.id));
  }

  async getWorkspaceState(profileId: string, sessionId?: string): Promise<TreasuryWorkspaceState> {
    // Fire-and-forget: stale session cleanup should not block workspace reads
    this.expireStaleSessions(profileId).catch(() => {});
    try {
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
      const commerce = await this.commerce.getProfileCommerce(
        profile.id,
        profile.authOrigin || 'http://localhost:5173',
      );

      const treasury = await this.treasuryGuard.getDashboardState();

      return this.cacheState({
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
        guidance: this.buildGuidance(profile.walletExplorerUrl),
      });
    } catch (error) {
      this.logPersistenceFallback('getWorkspaceState', error);

      const cachedState = this.getCachedState(profileId, sessionId);
      if (!cachedState) {
        throw error;
      }

      const treasury = await this.treasuryGuard.getDashboardState();
      const assets = await this.readLiveAssets(cachedState.profile.id, cachedState.profile.walletAddress).catch(
        () => cachedState.assets,
      );

      return this.cacheState({
        ...cachedState,
        assets,
        treasury: {
          ready: Boolean(treasury.policy && treasury.summary.stableAsset),
          vaultAddress: treasury.actors.treasuryAddress,
          explorerUrl: treasury.summary.explorerAddressUrl,
          stableAsset: treasury.summary.stableAsset,
        },
        guidance: this.buildGuidance(cachedState.profile.walletExplorerUrl),
      });
    }
  }

  async refreshAssets(profileId: string, sessionId?: string): Promise<TreasuryWorkspaceState> {
    const profile = await this.ensureAuthorizedProfile(profileId, sessionId);
    await this.captureAssets(profile.id, profile.walletAddress);
    return this.getWorkspaceState(profile.id, sessionId);
  }

  async getLiveAssets(profileId: string, sessionId?: string): Promise<TrackedAssetSnapshot[]> {
    try {
      const profile = await this.ensureAuthorizedProfile(profileId, sessionId);
      return this.readLiveAssets(profile.id, profile.walletAddress);
    } catch (error) {
      this.logPersistenceFallback('getLiveAssets', error);
      const cachedState = this.getCachedState(profileId, sessionId);
      if (!cachedState) {
        throw error;
      }
      return this.readLiveAssets(cachedState.profile.id, cachedState.profile.walletAddress);
    }
  }

  async requestWalletAirdrop(
    profileId: string,
    sessionId: string | undefined,
    amount = 1,
  ): Promise<TreasuryWorkspaceState> {
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

  async seedStablecoin(
    profileId: string,
    sessionId: string | undefined,
    amount = 250,
  ): Promise<TreasuryWorkspaceState> {
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

  async recordManualWalletSend(
    profileId: string,
    sessionId: string | undefined,
    input: {
      assetSymbol: string;
      mintAddress?: string | null;
      amountRaw: string;
      amountDisplay: string;
      destinationAddress: string;
      transactionHash?: string | null;
      explorerUrl?: string | null;
      notes?: string | null;
      status?: FundingEventStatus;
    },
  ): Promise<TreasuryWorkspaceState> {
    const profile = await this.ensureAuthorizedProfile(profileId, sessionId);

    const eventStatus = input.status ?? FundingEventStatus.PENDING;
    debugLog('wallet.send', 'recording passkey wallet send activity', {
      profileId: profile.id,
      assetSymbol: input.assetSymbol,
      destinationAddress: input.destinationAddress,
      amountDisplay: input.amountDisplay,
      status: eventStatus.toLowerCase(),
      transactionHash: input.transactionHash || null,
    });

    await prisma.fundingEvent.create({
      data: {
        profileId: profile.id,
        eventType: FundingEventType.MANUAL,
        status: eventStatus,
        assetSymbol: input.assetSymbol,
        mintAddress: input.mintAddress || null,
        amountRaw: input.amountRaw,
        amountDisplay: input.amountDisplay,
        sourceAddress: profile.walletAddress,
        destinationAddress: input.destinationAddress,
        signature: input.transactionHash || null,
        explorerUrl: input.explorerUrl || null,
        notes:
          input.notes ||
          'Passkey wallet transfer submitted through the Veridex relayer. The Hub transaction may confirm before the Solana spoke balance refresh completes.',
      },
    });

    await this.captureAssets(profile.id, profile.walletAddress);
    return this.getWorkspaceState(profile.id, sessionId);
  }

  private async ensureAuthorizedProfile(
    profileId: string,
    sessionId?: string,
  ): Promise<Pick<TreasuryProfile, 'id' | 'walletAddress' | 'walletExplorerUrl' | 'authOrigin'>> {
    if (!sessionId) {
      throw new Error('An active Auth Session is required for this action.');
    }

    try {
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

      if (!isLocalSessionId(session.serverSessionId)) {
        if (
          !session.lastValidatedAt ||
          Date.now() - session.lastValidatedAt.getTime() > SESSION_REVALIDATION_WINDOW_MS
        ) {
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
      }

      return profile;
    } catch (error) {
      this.logPersistenceFallback('ensureAuthorizedProfile', error);
      const cachedState = this.getCachedState(profileId, sessionId);
      if (
        !cachedState?.authSession ||
        cachedState.authSession.status !== 'active' ||
        cachedState.authSession.expiresAt <= Date.now()
      ) {
        throw error;
      }

      return {
        id: cachedState.profile.id,
        walletAddress: cachedState.profile.walletAddress,
        walletExplorerUrl: cachedState.profile.walletExplorerUrl,
        authOrigin: cachedState.profile.authOrigin,
      };
    }
  }

  private async captureAssets(profileId: string, walletAddress: string): Promise<void> {
    const balances = await this.readLiveAssets(profileId, walletAddress);
    const captureId = createCaptureId();

    try {
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
    } catch (error) {
      this.logPersistenceFallback('captureAssets', error);
      this.updateCachedAssets(profileId, balances);
    }
  }

  private async expireStaleSessions(profileId: string): Promise<void> {
    try {
      await prisma.authSession.updateMany({
        where: {
          profileId,
          status: AuthSessionStatus.ACTIVE,
          expiresAt: { lte: new Date() },
        },
        data: { status: AuthSessionStatus.EXPIRED },
      });
    } catch (error) {
      this.logPersistenceFallback('expireStaleSessions', error);
    }
  }

  private async validateRelayerSession(sessionId: string): Promise<RelayerSessionPayload | null> {
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

      const payload = (await response.json()) as
        | {
            valid?: boolean;
            session?: RelayerSessionPayload;
          }
        | null;

      if (payload?.valid && payload.session) {
        return payload.session;
      }
    }

    return null;
  }

  private async readLiveAssets(profileId: string, walletAddress: string): Promise<TrackedAssetSnapshot[]> {
    const dashboard = await this.treasuryGuard.getDashboardState();
    const symbolHints = dashboard.summary.stableAsset
      ? { [dashboard.summary.stableAsset.mintAddress]: dashboard.summary.stableAsset.symbol }
      : {};
    const balances = await this.solana.getWalletAssets(walletAddress, symbolHints);

    return balances.map((asset, index) => ({
      id: `live_${profileId}_${index}_${asset.symbol}_${asset.mintAddress || 'native'}`,
      captureId: 'live',
      assetType: asset.assetType === 'native' ? 'native' : 'spl',
      symbol: asset.symbol,
      name: asset.name,
      mintAddress: asset.mintAddress,
      tokenAccount: asset.tokenAccount,
      amountRaw: asset.amountRaw,
      amountDisplay: asset.amountDisplay,
      decimals: asset.decimals,
      explorerUrl: asset.explorerUrl || '',
      capturedAt: Date.now(),
    }));
  }

  private buildGuidance(explorerUrl: string): TreasuryWorkspaceState['guidance'] {
    return {
      faucetUrl: DEFAULT_FAUCET_URL,
      explorerUrl,
      relayerUrl: RELAYER_API_CANDIDATES[0] || RELAYER_API_FALLBACK,
      fundingSteps: [
        'Authenticate with your passkey to create either a local workspace session or a relayer-backed Auth Session, then persist wallet ownership.',
        'Use the built-in devnet SOL airdrop to pay for token account creation and testnet activity.',
        'If the treasury is bootstrapped, seed the wallet with the managed Solana stable asset to exercise payment flows.',
      ],
    };
  }

  private cacheState(state: TreasuryWorkspaceState): TreasuryWorkspaceState {
    this.workspaceCache.set(state.profile.id, state);
    if (state.authSession?.id) {
      this.sessionProfileIndex.set(state.authSession.id, state.profile.id);
    }
    return state;
  }

  private getCachedState(profileId?: string, sessionId?: string): TreasuryWorkspaceState | null {
    if (profileId && this.workspaceCache.has(profileId)) {
      return this.workspaceCache.get(profileId) ?? null;
    }

    if (sessionId) {
      const cachedProfileId = this.sessionProfileIndex.get(sessionId);
      if (cachedProfileId) {
        return this.workspaceCache.get(cachedProfileId) ?? null;
      }
    }

    return null;
  }

  private updateCachedAssets(profileId: string, assets: TrackedAssetSnapshot[]): void {
    const cached = this.workspaceCache.get(profileId);
    if (!cached) {
      return;
    }

    this.workspaceCache.set(profileId, {
      ...cached,
      assets,
      profile: {
        ...cached.profile,
        updatedAt: Date.now(),
      },
    });
  }

  private logPersistenceFallback(scope: string, error: unknown): void {
    const now = Date.now();
    if (now - this.lastPersistenceWarningAt < PERSISTENCE_WARNING_INTERVAL_MS) {
      return;
    }

    this.lastPersistenceWarningAt = now;
    const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    console.warn(`[stablehacks-workspace] ${scope} falling back to cached/local workspace state. ${detail}`);
  }

  private mapProfile(profile: TreasuryProfile): TreasuryWorkspaceProfile {
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

  private mapAuthSession(session: AuthSession): AuthSessionRecord {
    return {
      id: session.serverSessionId,
      source: getSessionSource(session.serverSessionId),
      keyHash: session.keyHash,
      appOrigin: session.appOrigin,
      permissions: Array.isArray(session.permissions) ? (session.permissions as string[]) : [],
      expiresAt: session.expiresAt.getTime(),
      createdAt: session.relayerIssuedAt.getTime(),
      lastValidatedAt: session.lastValidatedAt?.getTime() || null,
      status: toAuthStatus(session.status),
    };
  }

  private mapAsset(asset: AssetSnapshot): TrackedAssetSnapshot {
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

  private mapFundingEvent(event: FundingEvent): FundingEventRecord {
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
