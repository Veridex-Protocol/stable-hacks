"use client";

import { useState, useTransition, useEffect } from "react";
import Link from "next/link";
import { claimPayoutLinkAction } from "@/app/actions";
import type { PublicPaymentLinkState } from "@/server/types/index";
import SolanaWalletProvider from "@/components/wallet/SolanaWalletProvider";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

function buildClaimRequest(link: PublicPaymentLinkState["link"]): string {
  return [
    `Title: ${link.title}`,
    `Claim amount: ${link.amountDisplay} ${link.assetSymbol}`,
    `Treasury source: ${link.destinationAddress}`,
    `Mint: ${link.mintAddress || "Native SOL"}`,
    `Claim link: ${link.url}`,
    link.description ? `Notes: ${link.description}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export default function ClaimClient({ initialState }: { initialState: PublicPaymentLinkState }) {
  return (
    <SolanaWalletProvider>
      <ClaimClientInner initialState={initialState} />
    </SolanaWalletProvider>
  );
}

function ClaimClientInner({ initialState }: { initialState: PublicPaymentLinkState }) {
  const { publicKey, connected } = useWallet();

  const [state, setState] = useState(initialState);
  const [recipientAddress, setRecipientAddress] = useState(state.link.claimantAddress || "");
  const [error, setError] = useState<string | null>(null);
  const [walletNotice, setWalletNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const { link, receipt } = state;
  const isSettled = link.status !== "active";
  const humanClaimAllowed = link.claimMode !== "agent";
  const agentClaimAllowed = Boolean(state.agentic.agentClaimEndpoint);

  // Auto-fill recipient address when a wallet connects
  useEffect(() => {
    if (connected && publicKey && !recipientAddress) {
      setRecipientAddress(publicKey.toBase58());
      setWalletNotice("Address loaded from connected wallet.");
    }
  }, [connected, publicKey, recipientAddress]);

  function useConnectedWalletAddress() {
    if (!connected || !publicKey) {
      setError("Connect a Solana wallet first using the button above.");
      return;
    }
    setRecipientAddress(publicKey.toBase58());
    setError(null);
    setWalletNotice("Address loaded from connected wallet.");
  }

  async function copyClaimDetails() {
    try {
      await navigator.clipboard.writeText(buildClaimRequest(link));
      setWalletNotice("Claim details copied.");
    } catch {
      setWalletNotice("Copy failed in this browser. Use the claim details shown on the page.");
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
            Claim redemption triggers a real treasury-funded Solana transfer. Connect a wallet to auto-fill your
            address, or paste any Solana address manually. The receipt appears after the backend confirms the
            payout signature and stores it in Prisma.
          </div>

          <div className="mt-8 rounded-3xl border border-outline-variant/10 bg-surface-container-lowest p-5 text-sm leading-7 text-on-surface-variant">
            <h3 className="font-headline text-lg font-bold text-on-surface">Claim prerequisites</h3>
            <p className="mt-2">
              Connect your Solana wallet (Phantom, Solflare, Backpack, Coinbase Wallet, etc.) and
              the recipient address will auto-fill. You can also paste any Solana address manually.
              Agent claimants use the manifest endpoint below and submit a signed Solana claim intent.
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
              {receipt ? "Claim Receipt" : "Redeem to Your Wallet"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-on-surface-variant">
              {receipt
                ? "This payout has already been claimed and settled on Solana."
                : "Connect your wallet to auto-fill the receiving address, or enter one manually."}
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
            <div className="space-y-6">
              {!humanClaimAllowed ? (
                <div className="rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">
                  This link is agent-only. Use the agent claim endpoint shown on the left to redeem it with a signed Solana intent.
                </div>
              ) : null}

              {/* ── Wallet Connect ────────────────────────────── */}
              <div className="rounded-3xl border border-primary/15 bg-surface-container-low p-6">
                <h3 className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                  Connect wallet to claim
                </h3>
                <p className="mb-4 text-sm text-on-surface-variant">
                  Phantom, Solflare, Backpack, Coinbase Wallet, and more.
                </p>

                <div className="flex flex-wrap items-center gap-3">
                  <WalletMultiButton />
                  {connected && publicKey ? (
                    <button
                      type="button"
                      onClick={useConnectedWalletAddress}
                      disabled={!humanClaimAllowed}
                      className="secondary-ghost rounded-2xl px-4 py-2 text-sm font-bold"
                    >
                      Use {publicKey.toBase58().slice(0, 4)}...{publicKey.toBase58().slice(-4)}
                    </button>
                  ) : null}
                </div>
              </div>

              {/* ── Divider ──────────────────────────────────── */}
              <div className="relative flex items-center gap-4">
                <div className="flex-1 border-t border-outline-variant/20" />
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
                  or enter address manually
                </span>
                <div className="flex-1 border-t border-outline-variant/20" />
              </div>

              {/* ── Manual Address Entry ──────────────────────── */}
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                  Recipient address
                </span>
                <textarea
                  value={recipientAddress}
                  onChange={(event) => setRecipientAddress(event.target.value)}
                  className="focus-ring min-h-24 w-full rounded-3xl border border-outline-variant/20 bg-surface-container-low px-4 py-4 font-mono text-sm outline-none transition focus:border-primary/40"
                  placeholder="7h4P...solanaRecipient"
                />
              </label>

              {/* ── Claim Button ──────────────────────────────── */}
              <button
                type="button"
                disabled={isPending || !humanClaimAllowed}
                onClick={claimLink}
                className="primary-gradient focus-ring w-full rounded-2xl px-5 py-4 font-headline text-base font-bold text-on-primary disabled:opacity-60"
              >
                {isPending ? "Claiming on Solana..." : `Claim ${link.amountDisplay} ${link.assetSymbol}`}
              </button>

              {/* ── Errors / Notices ──────────────────────────── */}
              {error ? (
                <div className="rounded-2xl border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">
                  {error}
                </div>
              ) : null}
              {walletNotice ? (
                <div className="rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">
                  {walletNotice}
                </div>
              ) : null}
            </div>
          )}

          <div className="mt-8 rounded-3xl border border-outline-variant/10 bg-surface-container-low p-5">
            <h3 className="font-headline text-lg font-bold">Supported wallets</h3>
            <p className="mt-2 text-sm leading-6 text-on-surface-variant">
              Any wallet supporting the Solana Wallet Standard — Phantom, Solflare, Backpack, Coinbase Wallet,
              Ledger, and others. Connect your wallet to auto-fill the recipient address and claim directly.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
