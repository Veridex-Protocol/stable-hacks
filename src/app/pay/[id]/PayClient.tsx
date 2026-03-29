"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { verifyPaymentLinkAction } from "@/app/actions";
import type { PublicPaymentLinkState } from "@/server/types/index";
import SolanaWalletProvider from "@/components/wallet/SolanaWalletProvider";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey, Transaction, SystemProgram } from "@solana/web3.js";
import {
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  getMint,
} from "@solana/spl-token";

function buildSolanaPayUrl(state: PublicPaymentLinkState): string {
  const { link } = state;
  const params = new URLSearchParams({
    amount: Number(link.amountDisplay).toString(),
    label: link.title,
    memo: link.slug,
  });

  if (link.description) {
    params.set("message", link.description);
  }

  if (link.mintAddress) {
    params.set("spl-token", link.mintAddress);
  }

  return `solana:${link.destinationAddress}?${params.toString()}`;
}

function buildWalletTransferRequest(state: PublicPaymentLinkState): string {
  const { link } = state;
  return [
    `Title: ${link.title}`,
    `Amount: ${link.amountDisplay} ${link.assetSymbol}`,
    `Recipient: ${link.destinationAddress}`,
    `Mint: ${link.mintAddress || "Native SOL"}`,
    `Reference: ${link.slug}`,
    link.description ? `Notes: ${link.description}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export default function PayClient({ initialState }: { initialState: PublicPaymentLinkState }) {
  return (
    <SolanaWalletProvider>
      <PayClientInner initialState={initialState} />
    </SolanaWalletProvider>
  );
}

function PayClientInner({ initialState }: { initialState: PublicPaymentLinkState }) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();

  const [state, setState] = useState(initialState);
  const [txSignature, setTxSignature] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [walletNotice, setWalletNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [walletPaying, setWalletPaying] = useState(false);

  const { link, invoice, receipt } = state;
  const isSettled = link.status !== "active";
  const x402Endpoint = state.agentic.x402Endpoint;
  const solanaPayUrl = buildSolanaPayUrl(state);
  const isSOL = !link.mintAddress;

  async function payWithWallet() {
    if (!publicKey || !connected) {
      setError("Connect a Solana wallet first.");
      return;
    }

    setError(null);
    setWalletPaying(true);

    try {
      const recipient = new PublicKey(link.destinationAddress);
      const tx = new Transaction();

      if (isSOL) {
        tx.add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: recipient,
            lamports: Number(link.amountRaw),
          }),
        );
      } else {
        const mint = new PublicKey(link.mintAddress!);
        const senderATA = getAssociatedTokenAddressSync(mint, publicKey);
        const recipientATA = getAssociatedTokenAddressSync(mint, recipient);

        const recipientATAInfo = await connection.getAccountInfo(recipientATA);
        if (!recipientATAInfo) {
          tx.add(createAssociatedTokenAccountInstruction(publicKey, recipientATA, recipient, mint));
        }

        const mintInfo = await getMint(connection, mint);
        tx.add(
          createTransferCheckedInstruction(
            senderATA,
            mint,
            recipientATA,
            publicKey,
            Number(link.amountRaw),
            mintInfo.decimals,
          ),
        );
      }

      const signature = await sendTransaction(tx, connection);
      await connection.confirmTransaction(signature, "confirmed");

      startTransition(async () => {
        const result = await verifyPaymentLinkAction(link.slug, signature);
        if (!result.success) {
          setError(result.error);
        } else {
          setState(result.data);
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wallet transaction failed.");
    } finally {
      setWalletPaying(false);
    }
  }

  async function copyWalletRequest() {
    try {
      await navigator.clipboard.writeText(buildWalletTransferRequest(state));
      setWalletNotice("Wallet payment request copied.");
    } catch {
      setWalletNotice("Copy failed in this browser. Use the transfer details shown on the page.");
    }
  }

  function submitVerification() {
    if (!txSignature.trim()) {
      setError("Paste a confirmed Solana transaction signature first.");
      return;
    }

    setError(null);

    startTransition(async () => {
      const result = await verifyPaymentLinkAction(link.slug, txSignature.trim());

      if (!result.success) {
        setError(result.error);
        return;
      }

      setState(result.data);
      setTxSignature("");
    });
  }

  return (
    <div className="min-h-screen bg-background px-6 py-10 text-on-surface">
      <div className="mx-auto grid max-w-6xl gap-0 overflow-hidden rounded-[28px] border border-white/10 shadow-2xl md:grid-cols-[1.05fr_0.95fr]">
        <section className="bg-surface-container-low p-8 md:p-12">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-primary">
              Solana collection link
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
              {state.agentic.network}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
              {link.x402Enabled ? "x402 enabled" : "manual verification"}
            </span>
          </div>
          <h1 className="mt-6 font-headline text-4xl font-extrabold tracking-tight">{link.title}</h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-on-surface-variant">
            {link.description ||
              "Settle this request on Solana devnet and submit the confirmed signature for receipt verification and treasury reconciliation."}
          </p>

          <div className="mt-10 space-y-5 card-surface p-6">
            <div className="flex items-end justify-between gap-6">
              <div>
                <span className="text-xs uppercase tracking-[0.16em] text-on-surface-variant">Amount due</span>
                <div className="mt-2 flex items-baseline gap-3">
                  <strong className="font-headline text-5xl font-extrabold">
                    {Number(link.amountDisplay).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </strong>
                  <span className="text-xl font-bold text-primary">{link.assetSymbol}</span>
                </div>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] ${
                  isSettled ? "bg-primary/15 text-primary" : "bg-secondary/15 text-secondary"
                }`}
              >
                {isSettled ? link.status : "awaiting payment"}
              </span>
            </div>

            <dl className="space-y-3 text-sm">
              <div className="flex items-start justify-between gap-6">
                <dt className="text-on-surface-variant">Recipient wallet</dt>
                <dd className="max-w-[60%] break-all text-right font-mono">{link.destinationAddress}</dd>
              </div>
              <div className="flex items-start justify-between gap-6">
                <dt className="text-on-surface-variant">Asset mint</dt>
                <dd className="max-w-[60%] break-all text-right font-mono">{link.mintAddress || "Native SOL"}</dd>
              </div>
              {invoice ? (
                <div className="flex items-start justify-between gap-6">
                  <dt className="text-on-surface-variant">Invoice</dt>
                  <dd className="text-right font-semibold">{invoice.invoiceNumber}</dd>
                </div>
              ) : null}
              {link.expiresAt ? (
                <div className="flex items-start justify-between gap-6">
                  <dt className="text-on-surface-variant">Expires</dt>
                  <dd className="text-right">{new Date(link.expiresAt).toLocaleString()}</dd>
                </div>
              ) : null}
              <div className="flex items-start justify-between gap-6">
                <dt className="text-on-surface-variant">Settlement rails</dt>
                <dd className="text-right font-semibold">{link.supportedSettlementRails.join(", ")}</dd>
              </div>
            </dl>
          </div>

          <div className="mt-8 rounded-3xl border border-outline-variant/10 bg-surface-container-lowest p-5 text-sm leading-7 text-on-surface-variant">
            Connect a Solana-compatible wallet — Phantom, Solflare, Backpack, Coinbase Wallet, or any wallet
            supporting the Solana Wallet Standard — then pay directly. Alternatively, transfer from any wallet
            and paste the confirmed signature.
          </div>

          <div className="mt-8 rounded-3xl border border-outline-variant/10 bg-surface-container-lowest p-5 text-sm leading-7 text-on-surface-variant">
            <h3 className="font-headline text-lg font-bold text-on-surface">External wallet checkout</h3>
            <p className="mt-2">
              Open this request directly in a Solana-compatible mobile wallet, or copy the transfer request
              for a custodial wallet flow.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <a
                href={solanaPayUrl}
                className="primary-gradient focus-ring inline-flex items-center justify-center rounded-2xl px-5 py-4 font-headline text-base font-bold text-on-primary"
              >
                Open in mobile wallet
              </a>
              <button
                type="button"
                onClick={copyWalletRequest}
                className="secondary-ghost rounded-2xl px-5 py-4 font-headline text-base font-bold"
              >
                Copy transfer details
              </button>
            </div>
            {walletNotice ? (
              <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">
                {walletNotice}
              </div>
            ) : null}
          </div>

          <div className="mt-8 rounded-3xl border border-outline-variant/10 bg-surface-container-lowest p-5 text-sm leading-7 text-on-surface-variant">
            <h3 className="font-headline text-lg font-bold text-on-surface">Before you pay</h3>
            <p className="mt-2">
              This demo settles on Solana devnet. Make sure the paying wallet has devnet SOL for fees and
              access to the requested {link.assetSymbol} asset before submitting the transfer.
            </p>
            {link.explorerUrl ? (
              <Link href={link.explorerUrl} target="_blank" className="mt-3 inline-flex text-sm font-bold text-primary">
                Review settlement status on Solana Explorer
              </Link>
            ) : null}
          </div>

          {x402Endpoint ? (
            <div className="mt-8 rounded-3xl border border-primary/15 bg-primary/5 p-5 text-sm leading-7 text-on-surface-variant">
              <h3 className="font-headline text-lg font-bold text-on-surface">Agentic x402 endpoint</h3>
              <p className="mt-2">
                This payment link also exposes a Solana x402-compatible endpoint for agents. The agent first
                requests <span className="rounded bg-surface-container px-1 py-0.5">POST {x402Endpoint}</span>,
                receives a <span className="rounded bg-surface-container px-1 py-0.5">402 Payment Required</span>
                challenge, signs the payment proof with the Solana agent wallet, and retries with both
                <span className="rounded bg-surface-container px-1 py-0.5">PAYMENT-SIGNATURE</span> and
                <span className="rounded bg-surface-container px-1 py-0.5">x-solana-tx-signature</span>.
              </p>
              <p className="mt-3 break-all font-mono text-xs text-on-surface">{x402Endpoint}</p>
            </div>
          ) : null}
        </section>

        <section className="bg-surface-container p-8 md:p-12">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h2 className="font-headline text-2xl font-bold">
                {isSettled ? "Verified Receipt" : "Pay Now"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                {isSettled
                  ? "This payment has already been verified against Solana."
                  : "Connect your wallet and pay directly, or paste a confirmed signature."}
              </p>
            </div>
          </div>

          {receipt ? (
            <div className="rounded-3xl border border-primary/20 bg-primary/10 p-6">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-3xl text-primary">check_circle</span>
                <div>
                  <h3 className="font-headline text-xl font-bold">Receipt {receipt.receiptNumber}</h3>
                  <p className="text-sm text-on-surface-variant">Payment verified and archived in Prisma.</p>
                </div>
              </div>

              <dl className="mt-6 space-y-3 text-sm">
                <div className="flex items-start justify-between gap-6">
                  <dt className="text-on-surface-variant">Settlement rail</dt>
                  <dd className="text-right font-semibold">{receipt.settlementRail}</dd>
                </div>
                <div className="flex items-start justify-between gap-6">
                  <dt className="text-on-surface-variant">Signature</dt>
                  <dd className="max-w-[60%] break-all text-right font-mono">{receipt.txSignature}</dd>
                </div>
                <div className="flex items-start justify-between gap-6">
                  <dt className="text-on-surface-variant">Payer</dt>
                  <dd className="max-w-[60%] break-all text-right font-mono">{receipt.payerAddress || "Unavailable"}</dd>
                </div>
                <div className="flex items-start justify-between gap-6">
                  <dt className="text-on-surface-variant">Recipient</dt>
                  <dd className="max-w-[60%] break-all text-right font-mono">{receipt.recipientAddress}</dd>
                </div>
                <div className="flex items-start justify-between gap-6">
                  <dt className="text-on-surface-variant">Mint</dt>
                  <dd className="max-w-[60%] break-all text-right font-mono">
                    {receipt.mintAddress || state.treasury.stableAsset?.mintAddress || "Managed treasury asset"}
                  </dd>
                </div>
              </dl>

              {receipt.explorerUrl ? (
                <Link href={receipt.explorerUrl} target="_blank" className="mt-6 inline-flex text-sm font-bold text-primary">
                  View on Solana Explorer
                </Link>
              ) : null}
            </div>
          ) : (
            <div className="space-y-6">
              {/* ── Wallet Connect & Pay ─────────────────────── */}
              <div className="rounded-3xl border border-primary/15 bg-surface-container-low p-6">
                <h3 className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                  Pay with connected wallet
                </h3>
                <p className="mb-4 text-sm text-on-surface-variant">
                  Phantom, Solflare, Backpack, Coinbase Wallet, and more.
                </p>

                <div className="flex flex-wrap items-center gap-3">
                  <WalletMultiButton />
                </div>

                {connected && publicKey ? (
                  <div className="mt-4 space-y-3">
                    <p className="text-sm text-on-surface-variant">
                      Connected:{" "}
                      <span className="font-mono text-on-surface">
                        {publicKey.toBase58().slice(0, 8)}...{publicKey.toBase58().slice(-4)}
                      </span>
                    </p>
                    <button
                      type="button"
                      disabled={walletPaying || isPending}
                      onClick={payWithWallet}
                      className="primary-gradient focus-ring w-full rounded-2xl px-5 py-4 font-headline text-base font-bold text-on-primary disabled:opacity-60"
                    >
                      {walletPaying
                        ? "Sending transaction..."
                        : isPending
                          ? "Verifying on Solana..."
                          : `Pay ${link.amountDisplay} ${link.assetSymbol}`}
                    </button>
                  </div>
                ) : null}
              </div>

              {/* ── Divider ──────────────────────────────────── */}
              <div className="relative flex items-center gap-4">
                <div className="flex-1 border-t border-outline-variant/20" />
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
                  or submit a confirmed signature
                </span>
                <div className="flex-1 border-t border-outline-variant/20" />
              </div>

              {/* ── Manual Signature Verification ────────────── */}
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                  Transaction signature
                </span>
                <textarea
                  value={txSignature}
                  onChange={(event) => setTxSignature(event.target.value)}
                  className="focus-ring min-h-28 w-full rounded-3xl border border-outline-variant/20 bg-surface-container-low px-4 py-4 font-mono text-sm outline-none transition focus:border-primary/40"
                  placeholder="5LaZ...confirmedSignature"
                />
              </label>

              <button
                type="button"
                disabled={isPending}
                onClick={submitVerification}
                className="secondary-ghost focus-ring w-full rounded-2xl px-5 py-4 font-headline text-base font-bold disabled:opacity-60"
              >
                {isPending ? "Verifying on Solana..." : "Verify Payment"}
              </button>

              {/* ── Errors ───────────────────────────────────── */}
              {error ? (
                <div className="rounded-2xl border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">
                  {error}
                </div>
              ) : null}
            </div>
          )}

          <div className="mt-8 rounded-3xl border border-outline-variant/10 bg-surface-container-low p-5">
            <h3 className="font-headline text-lg font-bold">Supported wallets</h3>
            <p className="mt-2 text-sm leading-6 text-on-surface-variant">
              Any wallet that supports the Solana Wallet Standard works here — Phantom, Solflare, Backpack,
              Coinbase Wallet, Ledger, and others. If your wallet is not detected, use the manual signature
              flow or the mobile wallet checkout on the left.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
