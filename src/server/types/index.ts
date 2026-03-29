/**
 * Veridex Treasury Guard — Core Types
 *
 * All types for the treasury guard application.
 * No mocks — these represent real on-chain and off-chain state.
 */

// ============================================================================
// Resource Validation Types
// ============================================================================

export type ValidationCategory = 'docs' | 'rpc' | 'api' | 'agent-sdk' | 'sdk';

export interface ResourceValidation {
  id: string;
  label: string;
  category: ValidationCategory;
  target: string;
  status: 'healthy' | 'degraded' | 'failed';
  statusCode?: number;
  latencyMs?: number;
  details: string;
  checkedAt: number;
}

// ============================================================================
// Chain / Asset Types
// ============================================================================

export interface StableAssetConfig {
  symbol: string;
  mintAddress: string;
  decimals: number;
  mode: 'managed-mint' | 'external-mint';
  supply?: string;
}

export interface WalletAssetBalance {
  assetType: 'native' | 'spl';
  symbol: string;
  name: string;
  mintAddress: string | null;
  tokenAccount: string | null;
  amountRaw: string;
  amountDisplay: string;
  decimals: number;
  explorerUrl: string;
}

export interface AddressTelemetry {
  address: string;
  recentSignatures: number;
  solBalanceLamports: string;
  tokenAccounts: number;
  currentSlot: number;
  riskScore: number;
  riskLevel: KYTRiskLevel;
  notes: string[];
  checkedAt: number;
}

// ============================================================================
// Policy Types
// ============================================================================

export interface TreasuryPolicy {
  id: string;
  institutionName: string;
  maxTransactionAmount: number;      // Max single payout in USDC (e.g., 10000)
  dailySendLimit: number;            // Max daily total in USDC (e.g., 50000)
  escalationThreshold: number;       // Above this, require approval (e.g., 5000)
  allowedAssets: string[];           // SPL token mints allowed
  allowedCorridors: string[];        // Country codes (e.g., ["US", "UK", "SG"])
  requireTravelRule: boolean;        // Whether Travel Rule metadata required
  travelRuleThreshold: number;       // Amount above which Travel Rule kicks in
  createdAt: number;
  updatedAt: number;
  version: number;
}

// ============================================================================
// Counterparty Types
// ============================================================================

export type KYCStatus = 'verified' | 'pending' | 'rejected' | 'expired';
export type KYTRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface Counterparty {
  id: string;
  name: string;
  walletAddress: string;             // Solana public key
  country: string;                   // ISO country code
  kycStatus: KYCStatus;
  kycVerifiedAt: number | null;
  kycExpiresAt: number | null;
  kytRiskScore: number;              // 0-100
  kytRiskLevel: KYTRiskLevel;
  kytLastCheckedAt: number | null;
  sanctioned: boolean;
  approvedCorridors: string[];
  travelRuleInfo?: TravelRuleInfo;
  telemetry?: AddressTelemetry;
  createdAt: number;
  updatedAt: number;
}

export interface TravelRuleInfo {
  legalName: string;
  accountNumber: string;
  institution: string;
  country: string;
}

// ============================================================================
// Payout Types
// ============================================================================

export type PayoutVerdict = 'approved' | 'escalated' | 'blocked';
export type PayoutStatus = 'pending' | 'approved' | 'escalated' | 'blocked' | 'settled' | 'rejected' | 'failed';

export interface PayoutRequest {
  id: string;
  operatorAddress: string;           // Who submitted
  counterpartyId: string;
  counterpartyName: string;
  recipientAddress: string;          // Solana public key
  amount: number;                    // USDC amount
  asset: string;                     // SPL token mint
  corridor: string;                  // Country code pair e.g., "US-UK"
  memo: string;
  status: PayoutStatus;
  verdict: PayoutVerdict | null;
  verdictReasons: VerdictReason[];
  policyVersion: number;
  txSignature: string | null;        // Solana transaction signature
  approverAddress: string | null;
  approvalNote: string | null;
  travelRuleMetadata: TravelRuleInfo | null;
  createdAt: number;
  updatedAt: number;
  settledAt: number | null;
}

export interface VerdictReason {
  code: string;
  description: string;
  severity: 'info' | 'warning' | 'error';
}

// ============================================================================
// Audit Types
// ============================================================================

export interface AuditEntry {
  id: string;
  payoutRequestId: string;
  action: 'submitted' | 'evaluated' | 'approved' | 'escalated' | 'blocked' | 'settled' | 'rejected';
  actor: string;                     // Address or system
  details: string;
  policyVersion: number;
  verdict: PayoutVerdict | null;
  verdictReasons: VerdictReason[];
  timestamp: number;
}

// ============================================================================
// Role Types
// ============================================================================

export type UserRole = 'admin' | 'operator' | 'approver' | 'auditor';

export interface TreasuryUser {
  address: string;
  role: UserRole;
  name: string;
  createdAt: number;
}

// ============================================================================
// Compliance Check Result
// ============================================================================

export interface ComplianceCheckResult {
  passed: boolean;
  verdict: PayoutVerdict;
  reasons: VerdictReason[];
  telemetry?: AddressTelemetry;
  checks: {
    kycValid: boolean;
    kytClean: boolean;
    sanctionsClean: boolean;
    corridorAllowed: boolean;
    amountWithinLimit: boolean;
    dailyLimitOk: boolean;
    travelRuleCompliant: boolean;
    assetAllowed: boolean;
  };
}

// ============================================================================
// Dashboard Summary
// ============================================================================

export interface TreasurySummary {
  vaultAddress: string;
  vaultBalanceLamports: string;
  vaultBalanceUSDC: string;
  totalPayoutsToday: number;
  totalAmountToday: number;
  pendingApprovals: number;
  activeCounterparties: number;
  policyVersion: number;
  stableAsset: StableAssetConfig | null;
  explorerAddressUrl: string;
  lastValidatedAt: number | null;
}

// ============================================================================
// API Response Wrapper
// ============================================================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}

// ============================================================================
// Connected Wallet / Passkey Types
// ============================================================================

export interface SerializedPasskeyCredential {
  credentialId: string;
  publicKeyX: string;
  publicKeyY: string;
  keyHash: string;
}

export interface AuthSessionRecord {
  id: string;
  source: 'local' | 'veridex';
  keyHash: string;
  appOrigin: string;
  permissions: string[];
  expiresAt: number;
  createdAt: number;
  lastValidatedAt: number | null;
  status: 'active' | 'expired' | 'revoked' | 'invalid';
}

export interface TreasuryWorkspaceProfile {
  id: string;
  username: string;
  displayName: string;
  keyHash: string;
  credentialId: string;
  walletAddress: string;
  walletExplorerUrl: string;
  authOrigin: string | null;
  lastAuthenticatedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface TrackedAssetSnapshot {
  id: string;
  captureId: string;
  assetType: WalletAssetBalance['assetType'];
  symbol: string;
  name: string;
  mintAddress: string | null;
  tokenAccount: string | null;
  amountRaw: string;
  amountDisplay: string;
  decimals: number;
  explorerUrl: string;
  capturedAt: number;
}

export interface FundingEventRecord {
  id: string;
  eventType: 'airdrop' | 'treasury-seed' | 'manual';
  status: 'pending' | 'confirmed' | 'failed';
  assetSymbol: string;
  mintAddress: string | null;
  amountRaw: string | null;
  amountDisplay: string;
  sourceAddress: string | null;
  destinationAddress: string;
  signature: string | null;
  explorerUrl: string | null;
  notes: string | null;
  createdAt: number;
  updatedAt: number;
}

export type ClaimMode = 'human' | 'agent' | 'either';
export type SettlementRail = 'manual-tx' | 'solana-x402' | 'human-claim' | 'agent-claim';

export interface PaymentLinkRecord {
  id: string;
  kind: 'payment-request' | 'payout-claim';
  slug: string;
  title: string;
  description: string | null;
  assetSymbol: string;
  mintAddress: string | null;
  amountRaw: string;
  amountDisplay: string;
  destinationAddress: string;
  status: 'active' | 'paid' | 'claimed' | 'expired';
  claimMode: ClaimMode;
  x402Enabled: boolean;
  url: string;
  x402Url: string | null;
  agentClaimUrl: string | null;
  supportedSettlementRails: SettlementRail[];
  invoiceId: string | null;
  settledSignature: string | null;
  explorerUrl: string | null;
  payerAddress: string | null;
  claimantAddress: string | null;
  customerName: string | null;
  customerEmail: string | null;
  expiresAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  title: string;
  description: string | null;
  customerName: string;
  customerEmail: string | null;
  amountRaw: string;
  amountDisplay: string;
  assetSymbol: string;
  mintAddress: string | null;
  dueDate: number | null;
  status: 'draft' | 'sent' | 'paid' | 'void';
  paymentLinkId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface ReceiptRecord {
  id: string;
  receiptNumber: string;
  kind: 'payment' | 'payout-claim';
  settlementRail: SettlementRail;
  invoiceId: string | null;
  paymentLinkId: string | null;
  txSignature: string | null;
  explorerUrl: string | null;
  payerAddress: string | null;
  recipientAddress: string;
  assetSymbol: string;
  mintAddress: string | null;
  amountRaw: string;
  amountDisplay: string;
  note: string | null;
  proofPayload: Record<string, unknown> | null;
  createdAt: number;
}

export interface PublicPaymentLinkState {
  link: PaymentLinkRecord;
  invoice: InvoiceRecord | null;
  receipt: ReceiptRecord | null;
  treasury: {
    stableAsset: StableAssetConfig | null;
    bootstrapped: boolean;
  };
  agentic: {
    network: 'solana-devnet';
    x402Endpoint: string | null;
    agentClaimEndpoint: string | null;
  };
}

export interface TreasuryWorkspaceState {
  profile: TreasuryWorkspaceProfile;
  authSession: AuthSessionRecord | null;
  assets: TrackedAssetSnapshot[];
  fundingEvents: FundingEventRecord[];
  paymentLinks: PaymentLinkRecord[];
  invoices: InvoiceRecord[];
  receipts: ReceiptRecord[];
  treasury: {
    ready: boolean;
    vaultAddress: string | null;
    explorerUrl: string;
    stableAsset: StableAssetConfig | null;
  };
  guidance: {
    faucetUrl: string;
    explorerUrl: string;
    relayerUrl: string;
    fundingSteps: string[];
  };
}

// ============================================================================
// Persistence Types
// ============================================================================

export interface StoredKeypair {
  publicKey: string;
  secretKey: number[];
}

export interface DemoActors {
  treasury: StoredKeypair | null;
  operator: TreasuryUser | null;
  approver: TreasuryUser | null;
  auditor: TreasuryUser | null;
  mintAuthority: StoredKeypair | null;
}

export interface DemoState {
  version: number;
  createdAt: number;
  updatedAt: number;
  policy: TreasuryPolicy | null;
  stableAsset: StableAssetConfig | null;
  actors: DemoActors;
  counterparties: Counterparty[];
  payouts: PayoutRequest[];
  auditEntries: AuditEntry[];
  validations: ResourceValidation[];
  metadata: {
    rpcUrl: string;
    explorerBaseUrl: string;
    bootstrapSignature?: string;
    mintSignature?: string;
    notes: string[];
  };
}

// ============================================================================
// Request / Response DTOs
// ============================================================================

export interface BootstrapRequest {
  assetMode?: 'managed-mint' | 'external-mint';
  externalMintAddress?: string;
  initialMintAmount?: number;
}

export interface WorkspaceConnectInput {
  username: string;
  displayName: string;
  walletAddress?: string;
  credential: SerializedPasskeyCredential;
  authOrigin?: string;
  authSession?: {
    id: string;
    source?: 'local' | 'veridex';
    keyHash: string;
    appOrigin: string;
    permissions: string[];
    expiresAt: number;
    createdAt: number;
  } | null;
}

export interface WorkspaceAccessInput {
  sessionId?: string;
}

export interface WorkspaceFundingInput extends WorkspaceAccessInput {
  amount?: number;
}

export interface CreatePaymentLinkInput extends WorkspaceAccessInput {
  title: string;
  description?: string;
  amount: number;
  customerName?: string;
  customerEmail?: string;
  expiresAt?: string;
  x402Enabled?: boolean;
}

export interface CreateClaimLinkInput extends WorkspaceAccessInput {
  title: string;
  description?: string;
  amount: number;
  customerName?: string;
  customerEmail?: string;
  expiresAt?: string;
  claimMode?: ClaimMode;
}

export interface CreateInvoiceInput extends WorkspaceAccessInput {
  title: string;
  description?: string;
  customerName: string;
  customerEmail?: string;
  amount: number;
  dueDate?: string;
}

export interface VerifyPaymentLinkInput {
  txSignature: string;
}

export interface ClaimPaymentLinkInput {
  recipientAddress: string;
}

export interface AgentClaimInput extends ClaimPaymentLinkInput {
  claimantAddress: string;
  deadline: number;
  signature: string;
}

export interface AgentClaimManifest {
  protocol: 'stablehacks-agent-claim';
  network: 'solana-devnet';
  slug: string;
  claimantAddress: string;
  recipientAddress: string;
  mintAddress: string;
  amountRaw: string;
  amountDisplay: string;
  deadline: number;
  message: string;
  messageHash: string;
  endpoint: string;
}

export interface X402SettlementInput {
  paymentPayload: string;
  txSignature: string;
}

export interface CounterpartyInput {
  name: string;
  country: string;
  walletAddress?: string;
  kycStatus: KYCStatus;
  approvedCorridors: string[];
  sanctioned?: boolean;
  travelRuleInfo?: TravelRuleInfo;
  generateWallet?: boolean;
}

export interface PayoutSubmissionInput {
  counterpartyId: string;
  amount: number;
  corridor: string;
  memo: string;
  assetMintAddress?: string;
  travelRuleMetadata?: TravelRuleInfo | null;
}

export interface ApprovalInput {
  approvalNote?: string;
}

export interface ExportPayload {
  format: 'json' | 'csv';
  content: string;
  filename: string;
}

export interface DashboardState {
  summary: TreasurySummary;
  policy: TreasuryPolicy | null;
  counterparties: Counterparty[];
  payouts: PayoutRequest[];
  auditEntries: AuditEntry[];
  validations: ResourceValidation[];
  actors: {
    treasuryAddress: string | null;
    operatorAddress: string | null;
    approverAddress: string | null;
    auditorAddress: string | null;
  };
  metadata: DemoState['metadata'];
}
