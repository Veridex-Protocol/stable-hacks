import { InvoiceStatus, PaymentLinkKind, PaymentLinkStatus, ReceiptKind, AuthSessionStatus, } from '@prisma/client';
import { prisma } from '../db.js';
function createSlug(prefix) {
    return `${prefix}_${Date.now().toString(36)}${crypto.randomUUID().slice(0, 6)}`.toLowerCase();
}
function createInvoiceNumber() {
    return `INV-${Date.now().toString(36).toUpperCase()}`;
}
function createReceiptNumber() {
    return `RCP-${Date.now().toString(36).toUpperCase()}`;
}
function toLinkKind(kind) {
    return kind === PaymentLinkKind.PAYMENT_REQUEST ? 'payment-request' : 'payout-claim';
}
function toLinkStatus(status) {
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
function toInvoiceStatus(status) {
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
function toReceiptKind(kind) {
    return kind === ReceiptKind.PAYOUT_CLAIM ? 'payout-claim' : 'payment';
}
export class CommerceService {
    solana;
    treasuryGuard;
    constructor(solana, treasuryGuard) {
        this.solana = solana;
        this.treasuryGuard = treasuryGuard;
    }
    async createPaymentLink(profileId, input) {
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
            },
        });
    }
    async createClaimLink(profileId, input) {
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
            },
        });
    }
    async createInvoice(profileId, input) {
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
            },
        });
    }
    async getPublicLinkState(slug, origin) {
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
        const treasury = await this.treasuryGuard.getDashboardState();
        return {
            link: this.mapPaymentLink(link, origin),
            invoice: link.invoice ? this.mapInvoice(link.invoice) : null,
            receipt: link.receipts[0] ? this.mapReceipt(link.receipts[0]) : null,
            treasury: {
                stableAsset: treasury.summary.stableAsset,
                bootstrapped: Boolean(treasury.summary.stableAsset),
            },
        };
    }
    async verifyPaymentLink(slug, txSignature, origin) {
        const link = await prisma.paymentLink.findUnique({
            where: { slug },
            include: { invoice: true, receipts: true },
        });
        if (!link) {
            throw new Error('Payment link not found.');
        }
        if (link.kind !== PaymentLinkKind.PAYMENT_REQUEST) {
            throw new Error('Only payment request links can be settled by incoming payment.');
        }
        if (link.status !== PaymentLinkStatus.ACTIVE) {
            throw new Error('This payment link is no longer active.');
        }
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
                invoiceId: link.invoiceId,
                paymentLinkId: link.id,
                txSignature,
                explorerUrl: verification.explorerUrl,
                payerAddress: verification.payerAddress,
                recipientAddress: link.destinationAddress,
                assetSymbol: link.assetSymbol,
                mintAddress: link.mintAddress,
                amountRaw: verification.amountRaw,
                amountDisplay: link.amountDisplay,
                note: `Verified payment for ${link.title}.`,
            },
        });
        await prisma.paymentLink.update({
            where: { id: link.id },
            data: {
                status: PaymentLinkStatus.PAID,
                settledSignature: txSignature,
                explorerUrl: verification.explorerUrl,
                payerAddress: verification.payerAddress,
            },
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
    async claimPayoutLink(slug, recipientAddress, origin) {
        const link = await prisma.paymentLink.findUnique({
            where: { slug },
            include: { invoice: true, receipts: true },
        });
        if (!link) {
            throw new Error('Claim link not found.');
        }
        if (link.kind !== PaymentLinkKind.PAYOUT_CLAIM) {
            throw new Error('Only payout claim links can be redeemed here.');
        }
        if (link.status !== PaymentLinkStatus.ACTIVE) {
            throw new Error('This claim link has already been used or expired.');
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
                paymentLinkId: link.id,
                txSignature: result.signature,
                explorerUrl: result.explorerUrl,
                recipientAddress,
                assetSymbol: result.stableAsset.symbol,
                mintAddress: result.stableAsset.mintAddress,
                amountRaw: Math.round(Number(link.amountDisplay) * 10 ** result.stableAsset.decimals).toString(),
                amountDisplay: link.amountDisplay,
                note: `Claim payout redeemed for ${link.title}.`,
            },
        });
        await prisma.paymentLink.update({
            where: { id: link.id },
            data: {
                status: PaymentLinkStatus.CLAIMED,
                claimantAddress: recipientAddress,
                settledSignature: result.signature,
                explorerUrl: result.explorerUrl,
            },
        });
        return this.getPublicLinkState(slug, origin).then((state) => ({
            ...state,
            receipt: this.mapReceipt(receipt),
        }));
    }
    async getProfileCommerce(profileId, origin) {
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
    async requireAuthorizedProfile(profileId, sessionId) {
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
    mapPaymentLink(link, origin) {
        const route = link.kind === PaymentLinkKind.PAYMENT_REQUEST ? 'pay' : 'claim';
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
            url: `${origin}/#/public/${route}/${link.slug}`,
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
    mapInvoice(invoice) {
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
    mapReceipt(receipt) {
        return {
            id: receipt.id,
            receiptNumber: receipt.receiptNumber,
            kind: toReceiptKind(receipt.kind),
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
            createdAt: receipt.createdAt.getTime(),
        };
    }
}
