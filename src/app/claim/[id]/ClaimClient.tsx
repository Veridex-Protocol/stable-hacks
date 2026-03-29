"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { claimPayoutLinkAction } from "@/app/actions";
import type { PublicPaymentLinkState } from "@/server/types/index";

declare global {
  interface Window {
    solana?: {
      isPhantom?: boolean;
      connect: () => Promise<{ publicKey: { toString: () => string } }>;
    };
  }
}

export default function ClaimClient({ initialState }: { initialState: PublicPaymentLinkState }) {
  const [state, setState] = useState(initialState);
  const [recipientAddress, setRecipientAddress] = useState(state.link.claimantAddress || "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const { link, receipt } = state;
  const isSettled = link.status !== "active";
  const humanClaimAllowed = link.claimMode !== "agent";
  const agentClaimAllowed = Boolean(state.agentic.agentClaimEndpoint);

  async function usePhantomAddress() {
    try {
      if (!window.solana?.connect) {
        throw new Error("Phantom is not available in this browser.");
      }

      const response = await window.solana.connect();
      setRecipientAddress(response.publicKey.toString());
      setError(null);
    } catch (walletError) {
      setError(walletError instanceof Error ? walletError.message : "Wallet connection failed.");
    }
  }

  function claimLink() {
    if (!recipientAddress.trim()) {
      setError("Enter a valid Solana recipient address first.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await claimPayoutLinkAction(link.slug, {
        recipientAddress: recipientAddress.trim(),
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      setState(result.data);
    });
  }

  return (
    <div className="min-h-screen bg-background px-6 py-10 text-on-surface">
      <div className="mx-auto grid max-w-6xl gap-0 overflow-hidden rounded-[28px] border border-white/10 shadow-2xl md:grid-cols-[1.05fr_0.95fr]">
        <section className="bg-surface-container-low p-8 md:p-12">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-primary">
              Solana payout claim
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
              {state.agentic.network}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
              {link.claimMode} claim mode
            </span>
          </div>
          <h1 className="mt-6 font-headline text-4xl font-extrabold tracking-tight">{link.title}</h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-on-surface-variant">
            {link.description || "Claim treasury-funded stablecoin liquidity on Solana devnet."}
          </p>

          <div className="mt-10 card-surface p-6">
            <div className="flex items-end justify-between gap-6">
              <div>
                <span className="text-xs uppercase tracking-[0.16em] text-on-surface-variant">Claim amount</span>
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
                {isSettled ? link.status : "ready to claim"}
              </span>
            </div>

            <dl className="mt-6 space-y-3 text-sm">
              <div className="flex items-start justify-between gap-6">
                <dt className="text-on-surface-variant">Treasury source</dt>
                <dd className="max-w-[60%] break-all text-right font-mono">{link.destinationAddress}</dd>
              </div>
              <div className="flex items-start justify-between gap-6">
                <dt className="text-on-surface-variant">Asset mint</dt>
                <dd className="max-w-[60%] break-all text-right font-mono">{link.mintAddress || "Managed treasury asset"}</dd>
              </div>
              <div className="flex items-start justify-between gap-6">
                <dt className="text-on-surface-variant">Settlement rails</dt>
                <dd className="text-right font-semibold">{link.supportedSettlementRails.join(", ")}</dd>
              </div>
            </dl>
          </div>

          <div className="mt-8 rounded-3xl border border-outline-variant/10 bg-surface-container-lowest p-5 text-sm leading-7 text-on-surface-variant">
            Claim redemption triggers a real treasury-funded Solana transfer. The receipt only appears
            after the backend confirms the payout signature and stores it in Prisma.
          </div>

          <div className="mt-8 rounded-3xl border border-outline-variant/10 bg-surface-container-lowest p-5 text-sm leading-7 text-on-surface-variant">
            <h3 className="font-headline text-lg font-bold text-on-surface">Claim prerequisites</h3>
            <p className="mt-2">
              Human claimants can paste any Solana recipient address. Agent claimants use the manifest
              endpoint below, sign a claim intent, and let the treasury settle the payout on Solana devnet.
            </p>
            {link.explorerUrl ? (
              <Link href={link.explorerUrl} target="_blank" className="mt-3 inline-flex text-sm font-bold text-primary">
                Watch claim settlement on Solana Explorer
              </Link>
            ) : null}
          </div>

          <div className="mt-8 rounded-3xl border border-outline-variant/10 bg-surface-container-lowest p-5 text-sm leading-7 text-on-surface-variant">
            <h3 className="font-headline text-lg font-bold text-on-surface">Claim modes</h3>
            <p className="mt-2">
              This link is configured for <strong>{link.claimMode}</strong> claims.
              {agentClaimAllowed ? " Agents can fetch a signable manifest from the agent endpoint and submit a signed Solana claim intent." : ""}
            </p>
            {state.agentic.agentClaimEndpoint ? (
              <p className="mt-3 break-all font-mono text-xs text-on-surface">{state.agentic.agentClaimEndpoint}</p>
            ) : null}
          </div>
        </section>

        <section className="bg-surface-container p-8 md:p-12">
          <div className="mb-8">
            <h2 className="font-headline text-2xl font-bold">
              {receipt ? "Claim Receipt" : "Redeem to a Solana Address"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-on-surface-variant">
              {receipt
                ? "This payout has already been claimed and settled on Solana."
                : "Enter the wallet that should receive the payout or pull it from Phantom."}
            </p>
          </div>

          {receipt ? (
            <div className="rounded-3xl border border-primary/20 bg-primary/10 p-6">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-3xl text-primary">check_circle</span>
                <div>
                  <h3 className="font-headline text-xl font-bold">{receipt.receiptNumber}</h3>
                  <p className="text-sm text-on-surface-variant">Payout transfer confirmed and recorded.</p>
                </div>
              </div>

              <dl className="mt-6 space-y-3 text-sm">
                <div className="flex items-start justify-between gap-6">
                  <dt className="text-on-surface-variant">Settlement rail</dt>
                  <dd className="text-right font-semibold">{receipt.settlementRail}</dd>
                </div>
                <div className="flex items-start justify-between gap-6">
                  <dt className="text-on-surface-variant">Recipient</dt>
                  <dd className="max-w-[60%] break-all text-right font-mono">{receipt.recipientAddress}</dd>
                </div>
                <div className="flex items-start justify-between gap-6">
                  <dt className="text-on-surface-variant">Signature</dt>
                  <dd className="max-w-[60%] break-all text-right font-mono">{receipt.txSignature}</dd>
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
            <div className="space-y-5">
              {!humanClaimAllowed ? (
                <div className="rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">
                  This link is agent-only. Use the agent claim endpoint shown on the left to redeem it with a signed Solana intent.
                </div>
              ) : null}

              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                  Recipient address
                </span>
                <textarea
                  value={recipientAddress}
                  onChange={(event) => setRecipientAddress(event.target.value)}
                  className="focus-ring min-h-32 w-full rounded-3xl border border-outline-variant/20 bg-surface-container-low px-4 py-4 font-mono text-sm outline-none transition focus:border-primary/40"
                  placeholder="7h4P...solanaRecipient"
                />
              </label>

              <div className="grid gap-3 md:grid-cols-2">
                <button
                  type="button"
                  onClick={usePhantomAddress}
                  disabled={!humanClaimAllowed}
                  className="secondary-ghost rounded-2xl px-5 py-4 font-headline text-base font-bold"
                >
                  Use Phantom Address
                </button>
                <button
                  type="button"
                  disabled={isPending || !humanClaimAllowed}
                  onClick={claimLink}
                  className="primary-gradient focus-ring rounded-2xl px-5 py-4 font-headline text-base font-bold text-on-primary disabled:opacity-60"
                >
                  {isPending ? "Claiming on Solana..." : "Claim Payout"}
                </button>
              </div>

              {error ? (
                <div className="rounded-2xl border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">
                  {error}
                </div>
              ) : null}
            </div>
          )}

          <div className="mt-8 rounded-3xl border border-outline-variant/10 bg-surface-container-low p-5">
            <h3 className="font-headline text-lg font-bold">Need funding context?</h3>
            <p className="mt-2 text-sm leading-6 text-on-surface-variant">
              Treasury operators can reconnect with a passkey, airdrop devnet SOL, seed the managed stable
              asset, create the payout link, and then demonstrate the claim receipt plus audit trail from the dashboard.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
