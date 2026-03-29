import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import {
  InvoiceStatus,
  PaymentLinkKind,
  PaymentLinkStatus,
  ReceiptKind,
  AuthSessionStatus,
  ClaimMode,
  SettlementRail,
  type Invoice,
  type PaymentLink,
  type Receipt,
  type TreasuryProfile,
} from '@prisma/client';
import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';
import { prisma } from '../db';
import type {
  AgentClaimInput,
  AgentClaimManifest,
  ClaimMode as ClaimModeRecord,
  CreateClaimLinkInput,
  CreateInvoiceInput,
  CreatePaymentLinkInput,
  InvoiceRecord,
  PaymentLinkRecord,
  PublicPaymentLinkState,
  ReceiptRecord,
  SettlementRail as SettlementRailRecord,
  X402SettlementInput,
} from '../types/index';
import { SolanaService } from './SolanaService';
import { TreasuryGuardService } from './TreasuryGuardService';

const require = createRequire(import.meta.url);
type NonEvmVerifier = {
  verify: (
    payloadBase64: string,
    verifier: (message: Uint8Array, signature: string, publicKey: string) => Promise<boolean>,
  ) => Promise<{
    valid: boolean;
    authorization?: {
      from: string;
      to: string;
      amount: string;
      token: string;
      nonce: string;
      deadline: number;
      sessionKeyHash: string;
      amountUSD: number;
    };
    error?: string;
  }>;
};

const { NonEvmPaymentSigner } = require('@veridex/agentic-payments') as {
  NonEvmPaymentSigner: new () => NonEvmVerifier;
};

function createSlug(prefix: 'pay' | 'claim'): string {
  return `${prefix}_${Date.now().toString(36)}${crypto.randomUUID().slice(0, 6)}`.toLowerCase();
}

function createInvoiceNumber(): string {
  return `INV-${Date.now().toString(36).toUpperCase()}`;
}

function createReceiptNumber(): string {
  return `RCP-${Date.now().toString(36).toUpperCase()}`;
}

function toLinkKind(kind: PaymentLinkKind): PaymentLinkRecord['kind'] {
  return kind === PaymentLinkKind.PAYMENT_REQUEST ? 'payment-request' : 'payout-claim';
}

function toLinkStatus(status: PaymentLinkStatus): PaymentLinkRecord['status'] {
  switch (status) {
    case PaymentLinkStatus.PAID:
      return 'paid';
    case PaymentLinkStatus.CLAIMED:
      return 'claimed';
    case PaymentLinkStatus.EXPIRED:
      return 'expired';
    default:
      return 'active';
  }
}

function toInvoiceStatus(status: InvoiceStatus): InvoiceRecord['status'] {
  switch (status) {
    case InvoiceStatus.SENT:
      return 'sent';
    case InvoiceStatus.PAID:
      return 'paid';
    case InvoiceStatus.VOID:
      return 'void';
    default:
      return 'draft';
  }
}

function toReceiptKind(kind: ReceiptKind): ReceiptRecord['kind'] {
  return kind === ReceiptKind.PAYOUT_CLAIM ? 'payout-claim' : 'payment';
}

function toClaimMode(mode: ClaimMode): ClaimModeRecord {
  switch (mode) {
    case ClaimMode.HUMAN:
      return 'human';
    case ClaimMode.AGENT:
      return 'agent';
    default:
      return 'either';
  }
}

function fromClaimMode(mode?: ClaimModeRecord): ClaimMode {
  switch (mode) {
    case 'human':
      return ClaimMode.HUMAN;
    case 'agent':
      return ClaimMode.AGENT;
    default:
      return ClaimMode.EITHER;
  }
}

function toSettlementRail(rail: SettlementRail): SettlementRailRecord {
  switch (rail) {
    case SettlementRail.SOLANA_X402:
      return 'solana-x402';
    case SettlementRail.HUMAN_CLAIM:
      return 'human-claim';
    case SettlementRail.AGENT_CLAIM:
      return 'agent-claim';
    default:
      return 'manual-tx';
  }
}

function cleanOrigin(origin: string): string {
  return origin.endsWith('/') ? origin.slice(0, -1) : origin;
}

function buildAgentClaimMessage(params: {
  slug: string;
  claimantAddress: string;
  recipientAddress: string;
  mintAddress: string;
  amountRaw: string;
  deadline: number;
}): string {
  return JSON.stringify({
    amountRaw: params.amountRaw,
    claimantAddress: params.claimantAddress,
    deadline: params.deadline,
    mintAddress: params.mintAddress,
    protocol: 'stablehacks-agent-claim',
    recipientAddress: params.recipientAddress,
    slug: params.slug,
    version: 1,
  });
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function verifySolanaDetachedSignature(messageHashHex: string, signatureHex: string, address: string): boolean {
  try {
    const message = Buffer.from(messageHashHex, 'hex');
    const signature = Buffer.from(signatureHex, 'hex');
    const publicKey = new PublicKey(address).toBytes();
    return nacl.sign.detached.verify(message, signature, publicKey);
  } catch {
    return false;
  }
}

export class CommerceService {
  private readonly nonEvmSigner: NonEvmVerifier;

  constructor(
    private readonly solana: SolanaService,
    private readonly treasuryGuard: TreasuryGuardService,
  ) {
    this.nonEvmSigner = new NonEvmPaymentSigner();
  }

  async createPaymentLink(profileId: string, input: CreatePaymentLinkInput): Promise<void> {
    const profile = await this.requireAuthorizedProfile(profileId, input.sessionId);
    const treasury = await this.treasuryGuard.getDashboardState();
    const stableAsset = treasury.summary.stableAsset;

    if (!stableAsset) {
      throw new Error('Bootstrap the treasury before creating payment links.');
    }

    await prisma.paymentLink.create({
      data: {
        profileId,
        kind: PaymentLinkKind.PAYMENT_REQUEST,
        slug: createSlug('pay'),
        title: input.title.trim(),
        description: input.description?.trim() || null,
        assetSymbol: stableAsset.symbol,
        mintAddress: stableAsset.mintAddress,
        amountRaw: Math.round(input.amount * 10 ** stableAsset.decimals).toString(),
        amountDisplay: input.amount.toFixed(2),
        destinationAddress: profile.walletAddress,
        customerName: input.customerName?.trim() || null,
        customerEmail: input.customerEmail?.trim() || null,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        x402Enabled: input.x402Enabled !== false,
        claimMode: ClaimMode.EITHER,
      },
    });
  }

  async createClaimLink(profileId: string, input: CreateClaimLinkInput): Promise<void> {
    await this.requireAuthorizedProfile(profileId, input.sessionId);
    const treasury = await this.treasuryGuard.getDashboardState();
    const stableAsset = treasury.summary.stableAsset;

    if (!stableAsset || !treasury.actors.treasuryAddress) {
      throw new Error('Bootstrap the treasury before creating payout claim links.');
    }

    await prisma.paymentLink.create({
      data: {
        profileId,
        kind: PaymentLinkKind.PAYOUT_CLAIM,
        slug: createSlug('claim'),
        title: input.title.trim(),
        description: input.description?.trim() || null,
        assetSymbol: stableAsset.symbol,
        mintAddress: stableAsset.mintAddress,
        amountRaw: Math.round(input.amount * 10 ** stableAsset.decimals).toString(),
        amountDisplay: input.amount.toFixed(2),
        destinationAddress: treasury.actors.treasuryAddress,
        customerName: input.customerName?.trim() || null,
        customerEmail: input.customerEmail?.trim() || null,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        claimMode: fromClaimMode(input.claimMode),
        x402Enabled: false,
      },
    });
  }

  async createInvoice(profileId: string, input: CreateInvoiceInput): Promise<void> {
    const profile = await this.requireAuthorizedProfile(profileId, input.sessionId);
    const treasury = await this.treasuryGuard.getDashboardState();
    const stableAsset = treasury.summary.stableAsset;

    if (!stableAsset) {
      throw new Error('Bootstrap the treasury before creating invoices.');
    }

    const invoice = await prisma.invoice.create({
      data: {
        profileId,
        invoiceNumber: createInvoiceNumber(),
        title: input.title.trim(),
        description: input.description?.trim() || null,
        customerName: input.customerName.trim(),
        customerEmail: input.customerEmail?.trim() || null,
        amountRaw: Math.round(input.amount * 10 ** stableAsset.decimals).toString(),
        amountDisplay: input.amount.toFixed(2),
        assetSymbol: stableAsset.symbol,
        mintAddress: stableAsset.mintAddress,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        status: InvoiceStatus.SENT,
      },
    });

    await prisma.paymentLink.create({
      data: {
        profileId,
        kind: PaymentLinkKind.PAYMENT_REQUEST,
        slug: createSlug('pay'),
        title: invoice.title,
        description: invoice.description,
        assetSymbol: invoice.assetSymbol,
        mintAddress: invoice.mintAddress,
        amountRaw: invoice.amountRaw,
        amountDisplay: invoice.amountDisplay,
        destinationAddress: profile.walletAddress,
        status: PaymentLinkStatus.ACTIVE,
        invoiceId: invoice.id,
        customerName: invoice.customerName,
        customerEmail: invoice.customerEmail,
        expiresAt: invoice.dueDate,
        x402Enabled: true,
        claimMode: ClaimMode.EITHER,
      },
    });
  }

  async getPublicLinkState(slug: string, origin: string): Promise<PublicPaymentLinkState> {
    const link = await this.loadLink(slug);
    const treasury = await this.treasuryGuard.getDashboardState();

    return {
      link: this.mapPaymentLink(link, origin),
      invoice: link.invoice ? this.mapInvoice(link.invoice) : null,
      receipt: link.receipts[0] ? this.mapReceipt(link.receipts[0]) : null,
      treasury: {
        stableAsset: treasury.summary.stableAsset,
        bootstrapped: Boolean(treasury.summary.stableAsset),
      },
      agentic: {
        network: 'solana-devnet',
        x402Endpoint:
          link.kind === PaymentLinkKind.PAYMENT_REQUEST && link.x402Enabled
            ? this.getX402Url(link.slug, origin)
            : null,
        agentClaimEndpoint:
          link.kind === PaymentLinkKind.PAYOUT_CLAIM && link.claimMode !== ClaimMode.HUMAN
            ? this.getAgentClaimUrl(link.slug, origin)
            : null,
      },
    };
  }

  async verifyPaymentLink(slug: string, txSignature: string, origin: string): Promise<PublicPaymentLinkState> {
    const link = await this.loadLink(slug);
    this.assertPaymentLinkCanSettle(link);

    const verification = await this.solana.verifyIncomingTokenPayment({
      signature: txSignature,
      recipientAddress: link.destinationAddress,
      mintAddress: link.mintAddress || '',
      expectedAmount: Number(link.amountDisplay),
      decimals: 6,
    });

    if (!verification.valid) {
      throw new Error('The provided transaction does not satisfy the expected Solana payment.');
    }

    const receipt = await prisma.receipt.create({
      data: {
        profileId: link.profileId,
        receiptNumber: createReceiptNumber(),
        kind: ReceiptKind.PAYMENT,
        settlementRail: SettlementRail.MANUAL_TX,
        invoiceId: link.invoiceId,
        paymentLinkId: link.id,
        txSignature,
        explorerUrl: verification.explorerUrl,
        payerAddress: verification.sourceOwnerAddress || verification.payerAddress,
        recipientAddress: link.destinationAddress,
        assetSymbol: link.assetSymbol,
        mintAddress: link.mintAddress,
        amountRaw: verification.amountRaw,
        amountDisplay: link.amountDisplay,
        note: `Verified manual Solana settlement for ${link.title}.`,
        proofPayload: {
          settlement: 'manual-solana-verification',
          payerAddress: verification.payerAddress,
          sourceOwnerAddress: verification.sourceOwnerAddress,
        },
      },
    });

    await this.markLinkPaid(link, {
      txSignature,
      explorerUrl: verification.explorerUrl,
      payerAddress: verification.sourceOwnerAddress || verification.payerAddress,
    });

    if (link.invoiceId) {
      await prisma.invoice.update({
        where: { id: link.invoiceId },
        data: { status: InvoiceStatus.PAID },
      });
    }

    return this.getPublicLinkState(slug, origin).then((state) => ({
      ...state,
      receipt: this.mapReceipt(receipt),
    }));
  }

  async settlePaymentLinkViaX402(
    slug: string,
    input: X402SettlementInput,
    origin: string,
  ): Promise<PublicPaymentLinkState> {
    const link = await this.loadLink(slug);
    this.assertPaymentLinkCanSettle(link);

    if (!link.x402Enabled) {
      throw new Error('This payment link is not enabled for x402 settlement.');
    }

    const proof = await this.nonEvmSigner.verify(
      input.paymentPayload,
      async (message, signature, publicKey) =>
        verifySolanaDetachedSignature(Buffer.from(message).toString('hex'), signature, publicKey),
    );

    if (!proof.valid || !proof.authorization) {
      throw new Error(proof.error || 'The supplied x402 payment proof is invalid.');
    }

    const authorization = proof.authorization;

    if (authorization.to !== link.destinationAddress) {
      throw new Error('The x402 authorization recipient does not match this payment link.');
    }

    if ((link.mintAddress || '').toLowerCase() !== authorization.token.toLowerCase()) {
      throw new Error('The x402 authorization token does not match the Solana stable asset for this link.');
    }

    if (BigInt(authorization.amount) < BigInt(link.amountRaw)) {
      throw new Error('The x402 authorization amount is below the payment link requirement.');
    }

    const verification = await this.solana.verifyIncomingTokenPayment({
      signature: input.txSignature,
      recipientAddress: link.destinationAddress,
      mintAddress: link.mintAddress || '',
      expectedAmount: Number(link.amountDisplay),
      decimals: 6,
    });

    if (!verification.valid) {
      throw new Error('The linked Solana transaction does not satisfy the x402 payment requirement.');
    }

    const observedSender = verification.sourceOwnerAddress || verification.payerAddress;
    if (observedSender && observedSender !== authorization.from) {
      throw new Error('The Solana transfer sender does not match the x402 authorization signer.');
    }

    const receipt = await prisma.receipt.create({
      data: {
        profileId: link.profileId,
        receiptNumber: createReceiptNumber(),
        kind: ReceiptKind.PAYMENT,
        settlementRail: SettlementRail.SOLANA_X402,
        invoiceId: link.invoiceId,
        paymentLinkId: link.id,
        txSignature: input.txSignature,
        explorerUrl: verification.explorerUrl,
        payerAddress: authorization.from,
        recipientAddress: link.destinationAddress,
        assetSymbol: link.assetSymbol,
        mintAddress: link.mintAddress,
        amountRaw: verification.amountRaw,
        amountDisplay: link.amountDisplay,
        note: `Verified Solana x402 settlement for ${link.title}.`,
        proofPayload: {
          protocol: 'x402',
          network: 'solana-devnet',
          authorization,
          txSignature: input.txSignature,
          settlementSender: observedSender,
        },
      },
    });

    await this.markLinkPaid(link, {
      txSignature: input.txSignature,
      explorerUrl: verification.explorerUrl,
      payerAddress: authorization.from,
    });

    if (link.invoiceId) {
      await prisma.invoice.update({
        where: { id: link.invoiceId },
        data: { status: InvoiceStatus.PAID },
      });
    }

    return this.getPublicLinkState(slug, origin).then((state) => ({
      ...state,
      receipt: this.mapReceipt(receipt),
    }));
  }

  async claimPayoutLink(slug: string, recipientAddress: string, origin: string): Promise<PublicPaymentLinkState> {
    const link = await this.loadLink(slug);
    this.assertClaimLinkCanSettle(link);

    if (link.claimMode === ClaimMode.AGENT) {
      throw new Error('This payout link is restricted to agent claims.');
    }

    if (!this.solana.isValidAddress(recipientAddress)) {
      throw new Error('Invalid Solana recipient address.');
    }

    const result = await this.treasuryGuard.seedConnectedWallet(recipientAddress, Number(link.amountDisplay));

    const receipt = await prisma.receipt.create({
      data: {
        profileId: link.profileId,
        receiptNumber: createReceiptNumber(),
        kind: ReceiptKind.PAYOUT_CLAIM,
        settlementRail: SettlementRail.HUMAN_CLAIM,
        paymentLinkId: link.id,
        txSignature: result.signature,
        explorerUrl: result.explorerUrl,
        recipientAddress,
        assetSymbol: result.stableAsset.symbol,
        mintAddress: result.stableAsset.mintAddress,
        amountRaw: Math.round(Number(link.amountDisplay) * 10 ** result.stableAsset.decimals).toString(),
        amountDisplay: link.amountDisplay,
        note: `Human claim settled for ${link.title}.`,
        proofPayload: {
          claimantType: 'human',
        },
      },
    });

    await this.markLinkClaimed(link, {
      recipientAddress,
      signature: result.signature,
      explorerUrl: result.explorerUrl,
    });

    return this.getPublicLinkState(slug, origin).then((state) => ({
      ...state,
      receipt: this.mapReceipt(receipt),
    }));
  }

  async getAgentClaimManifest(
    slug: string,
    claimantAddress: string,
    recipientAddress: string,
    deadline: number,
    origin: string,
  ): Promise<AgentClaimManifest> {
    const link = await this.loadLink(slug);
    this.assertClaimLinkCanSettle(link);

    if (link.claimMode === ClaimMode.HUMAN) {
      throw new Error('This payout link only supports human claims.');
    }

    if (!this.solana.isValidAddress(claimantAddress)) {
      throw new Error('Invalid Solana claimant address.');
    }

    if (!this.solana.isValidAddress(recipientAddress)) {
      throw new Error('Invalid Solana recipient address.');
    }

    if (deadline <= Date.now()) {
      throw new Error('Agent claim deadlines must be in the future.');
    }

    const message = buildAgentClaimMessage({
      slug: link.slug,
      claimantAddress,
      recipientAddress,
      mintAddress: link.mintAddress || '',
      amountRaw: link.amountRaw,
      deadline,
    });

    return {
      protocol: 'stablehacks-agent-claim',
      network: 'solana-devnet',
      slug: link.slug,
      claimantAddress,
      recipientAddress,
      mintAddress: link.mintAddress || '',
      amountRaw: link.amountRaw,
      amountDisplay: link.amountDisplay,
      deadline,
      message,
      messageHash: sha256Hex(message),
      endpoint: this.getAgentClaimUrl(link.slug, origin),
    };
  }

  async claimPayoutLinkWithAgent(
    slug: string,
    input: AgentClaimInput,
    origin: string,
  ): Promise<PublicPaymentLinkState> {
    const manifest = await this.getAgentClaimManifest(
      slug,
      input.claimantAddress,
      input.recipientAddress,
      input.deadline,
      origin,
    );

    if (!verifySolanaDetachedSignature(manifest.messageHash, input.signature, input.claimantAddress)) {
      throw new Error('The agent claim signature could not be verified against the provided Solana address.');
    }

    const link = await this.loadLink(slug);
    const result = await this.treasuryGuard.seedConnectedWallet(
      input.recipientAddress,
      Number(link.amountDisplay),
    );

    const receipt = await prisma.receipt.create({
      data: {
        profileId: link.profileId,
        receiptNumber: createReceiptNumber(),
        kind: ReceiptKind.PAYOUT_CLAIM,
        settlementRail: SettlementRail.AGENT_CLAIM,
        paymentLinkId: link.id,
        txSignature: result.signature,
        explorerUrl: result.explorerUrl,
        recipientAddress: input.recipientAddress,
        assetSymbol: result.stableAsset.symbol,
        mintAddress: result.stableAsset.mintAddress,
        amountRaw: Math.round(Number(link.amountDisplay) * 10 ** result.stableAsset.decimals).toString(),
        amountDisplay: link.amountDisplay,
        note: `Agent claim settled for ${link.title}.`,
        proofPayload: {
          protocol: 'stablehacks-agent-claim',
          claimantAddress: input.claimantAddress,
          deadline: input.deadline,
          signature: input.signature,
          message: manifest.message,
          messageHash: manifest.messageHash,
        },
      },
    });

    await this.markLinkClaimed(link, {
      recipientAddress: input.recipientAddress,
      signature: result.signature,
      explorerUrl: result.explorerUrl,
    });

    return this.getPublicLinkState(slug, origin).then((state) => ({
      ...state,
      receipt: this.mapReceipt(receipt),
    }));
  }

  getX402ChallengeHeader(record: PaymentLinkRecord): string {
    const payload = {
      x402Version: 1,
      paymentRequirements: [{
        scheme: 'exact',
        network: 'solana-devnet',
        maxAmountRequired: record.amountRaw,
        asset: record.mintAddress,
        payTo: record.destinationAddress,
        facilitator: record.x402Url,
        description: record.description || record.title,
        extra: {
          paymentLinkSlug: record.slug,
          settlementHeader: 'x-solana-tx-signature',
          settlementRail: 'solana-x402',
        },
      }],
    };

    return Buffer.from(JSON.stringify(payload)).toString('base64');
  }

  async getProfileCommerce(profileId: string, origin: string): Promise<{
    paymentLinks: PaymentLinkRecord[];
    invoices: InvoiceRecord[];
    receipts: ReceiptRecord[];
  }> {
    const [paymentLinks, invoices, receipts] = await Promise.all([
      prisma.paymentLink.findMany({
        where: { profileId },
        orderBy: { createdAt: 'desc' },
        take: 12,
      }),
      prisma.invoice.findMany({
        where: { profileId },
        orderBy: { createdAt: 'desc' },
        take: 12,
      }),
      prisma.receipt.findMany({
        where: { profileId },
        orderBy: { createdAt: 'desc' },
        take: 12,
      }),
    ]);

    return {
      paymentLinks: paymentLinks.map((link) => this.mapPaymentLink(link, origin)),
      invoices: invoices.map((invoice) => this.mapInvoice(invoice)),
      receipts: receipts.map((receipt) => this.mapReceipt(receipt)),
    };
  }

  private async requireAuthorizedProfile(profileId: string, sessionId?: string): Promise<TreasuryProfile> {
    if (!sessionId) {
      throw new Error('An active Auth Session is required.');
    }

    const [profile, session] = await Promise.all([
      prisma.treasuryProfile.findUnique({ where: { id: profileId } }),
      prisma.authSession.findFirst({
        where: { profileId, serverSessionId: sessionId },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    if (!profile) {
      throw new Error('Treasury profile not found.');
    }

    if (!session || session.status !== AuthSessionStatus.ACTIVE || session.expiresAt.getTime() <= Date.now()) {
      throw new Error('The current Auth Session is no longer active.');
    }

    return profile;
  }

  private async loadLink(slug: string): Promise<PaymentLink & { invoice: Invoice | null; receipts: Receipt[] }> {
    const link = await prisma.paymentLink.findUnique({
      where: { slug },
      include: {
        invoice: true,
        receipts: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!link) {
      throw new Error('Payment link not found.');
    }

    return link;
  }

  private assertPaymentLinkCanSettle(link: PaymentLink): void {
    if (link.kind !== PaymentLinkKind.PAYMENT_REQUEST) {
      throw new Error('Only payment request links can be settled here.');
    }

    if (link.status !== PaymentLinkStatus.ACTIVE) {
      throw new Error('This payment link is no longer active.');
    }
  }

  private assertClaimLinkCanSettle(link: PaymentLink): void {
    if (link.kind !== PaymentLinkKind.PAYOUT_CLAIM) {
      throw new Error('Only payout claim links can be redeemed here.');
    }

    if (link.status !== PaymentLinkStatus.ACTIVE) {
      throw new Error('This claim link has already been used or expired.');
    }
  }

  private async markLinkPaid(
    link: PaymentLink,
    params: { txSignature: string; explorerUrl: string; payerAddress: string | null },
  ): Promise<void> {
    await prisma.paymentLink.update({
      where: { id: link.id },
      data: {
        status: PaymentLinkStatus.PAID,
        settledSignature: params.txSignature,
        explorerUrl: params.explorerUrl,
        payerAddress: params.payerAddress,
      },
    });
  }

  private async markLinkClaimed(
    link: PaymentLink,
    params: { recipientAddress: string; signature: string; explorerUrl: string },
  ): Promise<void> {
    await prisma.paymentLink.update({
      where: { id: link.id },
      data: {
        status: PaymentLinkStatus.CLAIMED,
        claimantAddress: params.recipientAddress,
        settledSignature: params.signature,
        explorerUrl: params.explorerUrl,
      },
    });
  }

  private getX402Url(slug: string, origin: string): string {
    return `${cleanOrigin(origin)}/api/x402/pay/${slug}`;
  }

  private getAgentClaimUrl(slug: string, origin: string): string {
    return `${cleanOrigin(origin)}/api/claim-links/${slug}/agent`;
  }

  private mapPaymentLink(link: PaymentLink, origin: string): PaymentLinkRecord {
    const route = link.kind === PaymentLinkKind.PAYMENT_REQUEST ? 'pay' : 'claim';
    const x402Url =
      link.kind === PaymentLinkKind.PAYMENT_REQUEST && link.x402Enabled
        ? this.getX402Url(link.slug, origin)
        : null;
    const agentClaimUrl =
      link.kind === PaymentLinkKind.PAYOUT_CLAIM && link.claimMode !== ClaimMode.HUMAN
        ? this.getAgentClaimUrl(link.slug, origin)
        : null;

    const supportedSettlementRails: SettlementRailRecord[] =
      link.kind === PaymentLinkKind.PAYMENT_REQUEST
        ? [
            'manual-tx',
            ...(link.x402Enabled ? ['solana-x402' as const] : []),
          ]
        : [
            ...(link.claimMode !== ClaimMode.AGENT ? ['human-claim' as const] : []),
            ...(link.claimMode !== ClaimMode.HUMAN ? ['agent-claim' as const] : []),
          ];

    return {
      id: link.id,
      kind: toLinkKind(link.kind),
      slug: link.slug,
      title: link.title,
      description: link.description,
      assetSymbol: link.assetSymbol,
      mintAddress: link.mintAddress,
      amountRaw: link.amountRaw,
      amountDisplay: link.amountDisplay,
      destinationAddress: link.destinationAddress,
      status: toLinkStatus(link.status),
      claimMode: toClaimMode(link.claimMode),
      x402Enabled: link.x402Enabled,
      url: `${cleanOrigin(origin)}/${route}/${link.slug}`,
      x402Url,
      agentClaimUrl,
      supportedSettlementRails,
      invoiceId: link.invoiceId,
      settledSignature: link.settledSignature,
      explorerUrl: link.explorerUrl,
      payerAddress: link.payerAddress,
      claimantAddress: link.claimantAddress,
      customerName: link.customerName,
      customerEmail: link.customerEmail,
      expiresAt: link.expiresAt?.getTime() || null,
      createdAt: link.createdAt.getTime(),
      updatedAt: link.updatedAt.getTime(),
    };
  }

  private mapInvoice(invoice: Invoice): InvoiceRecord {
    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      title: invoice.title,
      description: invoice.description,
      customerName: invoice.customerName,
      customerEmail: invoice.customerEmail,
      amountRaw: invoice.amountRaw,
      amountDisplay: invoice.amountDisplay,
      assetSymbol: invoice.assetSymbol,
      mintAddress: invoice.mintAddress,
      dueDate: invoice.dueDate?.getTime() || null,
      status: toInvoiceStatus(invoice.status),
      paymentLinkId: null,
      createdAt: invoice.createdAt.getTime(),
      updatedAt: invoice.updatedAt.getTime(),
    };
  }

  private mapReceipt(receipt: Receipt): ReceiptRecord {
    return {
      id: receipt.id,
      receiptNumber: receipt.receiptNumber,
      kind: toReceiptKind(receipt.kind),
      settlementRail: toSettlementRail(receipt.settlementRail),
      invoiceId: receipt.invoiceId,
      paymentLinkId: receipt.paymentLinkId,
      txSignature: receipt.txSignature,
      explorerUrl: receipt.explorerUrl,
      payerAddress: receipt.payerAddress,
      recipientAddress: receipt.recipientAddress,
      assetSymbol: receipt.assetSymbol,
      mintAddress: receipt.mintAddress,
      amountRaw: receipt.amountRaw,
      amountDisplay: receipt.amountDisplay,
      note: receipt.note,
      proofPayload:
        receipt.proofPayload && typeof receipt.proofPayload === 'object'
          ? (receipt.proofPayload as Record<string, unknown>)
          : null,
      createdAt: receipt.createdAt.getTime(),
    };
  }
}
