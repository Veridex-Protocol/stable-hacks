import type { CreateClaimLinkInput, CreateInvoiceInput, CreatePaymentLinkInput, InvoiceRecord, PaymentLinkRecord, PublicPaymentLinkState, ReceiptRecord } from '../types/index.js';
import { SolanaService } from './SolanaService.js';
import { TreasuryGuardService } from './TreasuryGuardService.js';
export declare class CommerceService {
    private readonly solana;
    private readonly treasuryGuard;
    constructor(solana: SolanaService, treasuryGuard: TreasuryGuardService);
    createPaymentLink(profileId: string, input: CreatePaymentLinkInput): Promise<void>;
    createClaimLink(profileId: string, input: CreateClaimLinkInput): Promise<void>;
    createInvoice(profileId: string, input: CreateInvoiceInput): Promise<void>;
    getPublicLinkState(slug: string, origin: string): Promise<PublicPaymentLinkState>;
    verifyPaymentLink(slug: string, txSignature: string, origin: string): Promise<PublicPaymentLinkState>;
    claimPayoutLink(slug: string, recipientAddress: string, origin: string): Promise<PublicPaymentLinkState>;
    getProfileCommerce(profileId: string, origin: string): Promise<{
        paymentLinks: PaymentLinkRecord[];
        invoices: InvoiceRecord[];
        receipts: ReceiptRecord[];
    }>;
    private requireAuthorizedProfile;
    private mapPaymentLink;
    private mapInvoice;
    private mapReceipt;
}
