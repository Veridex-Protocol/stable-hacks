"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordWalletSendAction } from "@/app/actions";
import { sendLocalPasskeyWalletTransfer } from "@/lib/local-passkey-wallet";
import {
  cn,
  dashboardButtonClassName,
  dashboardInputClassName,
  dashboardSelectClassName,
  dashboardSubPanelClassName,
  dashboardTextareaClassName,
} from "@/components/dashboard/primitives";
import type { AuthSessionRecord, TrackedAssetSnapshot } from "@/server/types/index";

interface PasskeyDirectSendPanelProps {
  assets: TrackedAssetSnapshot[];
  walletAddress: string;
  authSessionSource: AuthSessionRecord["source"] | null;
  relayerApiUrl: string;
}

interface SubmittedTransfer {
  transactionHash: string;
  explorerUrl: string | null;
  destinationAddress: string;
  amountDisplay: string;
  assetSymbol: string;
}

function parseDisplayAmount(value: string, decimals: number): bigint | null {
  const normalized = value.trim();
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    return null;
  }

  const [whole = "0", fraction = ""] = normalized.split(".");
  if (fraction.length > decimals) {
    return null;
  }

  const paddedFraction = `${fraction}${"0".repeat(decimals - fraction.length)}`;
  return BigInt(`${whole}${paddedFraction || ""}`);
}

function formatDisplayAmount(value: string, decimals: number): string {
  const normalized = value.trim();
  const [whole = "0", fraction = ""] = normalized.split(".");
  const trimmedFraction = fraction.slice(0, decimals).replace(/0+$/, "");
  return trimmedFraction ? `${whole}.${trimmedFraction}` : whole;
}

function buildHubExplorerUrl(transactionHash: string): string | null {
  return transactionHash.startsWith("0x") ? `https://sepolia.basescan.org/tx/${transactionHash}` : null;
}

export function PasskeyDirectSendPanel({
  assets,
  walletAddress,
  authSessionSource,
  relayerApiUrl,
}: PasskeyDirectSendPanelProps) {
  const router = useRouter();
  const spendableAssets = useMemo(
    () => assets.filter((asset) => {
      try {
        return BigInt(asset.amountRaw) > 0n;
      } catch {
        return Number(asset.amountDisplay) > 0;
      }
    }),
    [assets],
  );
  const [selectedAssetId, setSelectedAssetId] = useState(spendableAssets[0]?.id ?? "");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lastTransfer, setLastTransfer] = useState<SubmittedTransfer | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedAsset =
    spendableAssets.find((asset) => asset.id === selectedAssetId) ?? spendableAssets[0] ?? null;

  function submitSend() {
    if (authSessionSource !== "local") {
      setError("Direct sends currently require a local passkey wallet session on this origin.");
      return;
    }

    if (!selectedAsset) {
      setError("Fund the passkey wallet before sending assets out.");
      return;
    }

    const destinationAddress = recipientAddress.trim();
    if (!destinationAddress) {
      setError("Enter a destination Solana address.");
      return;
    }

    if (destinationAddress === walletAddress) {
      setError("Choose a different Solana address than the current passkey wallet.");
      return;
    }

    const amountRaw = parseDisplayAmount(amount, selectedAsset.decimals);
    if (amountRaw === null || amountRaw <= 0n) {
      setError(`Enter a valid ${selectedAsset.symbol} amount with at most ${selectedAsset.decimals} decimals.`);
      return;
    }

    if (amountRaw > BigInt(selectedAsset.amountRaw)) {
      setError(`The requested amount exceeds the available ${selectedAsset.symbol} balance.`);
      return;
    }

    setError(null);
    setNotice("Authenticating the local passkey and submitting the transfer through the Veridex relayer...");

    startTransition(async () => {
      try {
        const amountDisplay = formatDisplayAmount(amount, selectedAsset.decimals);
        const transfer = await sendLocalPasskeyWalletTransfer({
          recipientAddress: destinationAddress,
          token: selectedAsset.mintAddress || "native",
          amount: amountRaw,
          relayerApiUrl,
        });
        const explorerUrl = buildHubExplorerUrl(transfer.transactionHash);

        setNotice("Transfer submitted. Recording wallet activity and refreshing the dashboard...");

        const recordResult = await recordWalletSendAction({
          assetSymbol: selectedAsset.symbol,
          mintAddress: selectedAsset.mintAddress,
          amountRaw: amountRaw.toString(),
          amountDisplay,
          destinationAddress,
          transactionHash: transfer.transactionHash,
          explorerUrl,
          status: "pending",
          notes:
            `Local passkey wallet send submitted to ${destinationAddress}. ` +
            `Hub transaction ${transfer.transactionHash} accepted by the relayer; Solana settlement may finalize shortly.`,
        });

        setLastTransfer({
          transactionHash: transfer.transactionHash,
          explorerUrl,
          destinationAddress,
          amountDisplay,
          assetSymbol: selectedAsset.symbol,
        });
        setAmount("");
        setRecipientAddress("");

        if (!recordResult.success) {
          setNotice(
            `Transfer submitted, but dashboard activity logging failed: ${recordResult.error}. ` +
            "Use the Hub transaction hash below while the workspace refresh catches up.",
          );
          return;
        }

        setNotice("Transfer submitted. Refreshing wallet balances and activity history now.");
        router.refresh();
      } catch (sendError) {
        setError(sendError instanceof Error ? sendError.message : "Passkey wallet send failed.");
        setNotice(null);
      }
    });
  }

  return (
    <div className={cn(dashboardSubPanelClassName, "mt-6 p-5")}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Direct send</p>
          <h3 className="mt-3 text-xl font-semibold text-white">Send from the passkey wallet</h3>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-400">
            Submit a direct wallet transfer to another Solana address. This uses the Veridex relayer to dispatch
            the vault action, so the Hub transaction can confirm before the Solana balance refresh lands.
          </p>
        </div>
        <span className="rounded-full border border-zinc-700 bg-zinc-900/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-300">
          {authSessionSource === "local" ? "Local passkey ready" : "Local passkey required"}
        </span>
      </div>

      {authSessionSource !== "local" ? (
        <div className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-200">
          Direct sends currently use the local passkey wallet on this origin. If you connected through the Veridex
          operator session rail, you can still move funds today with payout claims and payment links, but arbitrary
          direct sends need a local passkey session here.
        </div>
      ) : null}

      {spendableAssets.length === 0 ? (
        <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3 text-sm leading-6 text-zinc-400">
          No spendable assets are currently available in this passkey wallet. Fund the wallet first, then return here
          to send SOL or SPL assets to another Solana address.
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Asset</span>
            <select
              value={selectedAsset?.id ?? ""}
              onChange={(event) => setSelectedAssetId(event.target.value)}
              className={dashboardSelectClassName}
              disabled={isPending}
            >
              {spendableAssets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.symbol} · {asset.amountDisplay}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Amount</span>
            <input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className={dashboardInputClassName}
              placeholder={selectedAsset ? `0.00 ${selectedAsset.symbol}` : "0.00"}
              inputMode="decimal"
              disabled={isPending || !selectedAsset}
            />
            {selectedAsset ? (
              <p className="mt-2 text-xs text-zinc-500">Available: {selectedAsset.amountDisplay} {selectedAsset.symbol}</p>
            ) : null}
          </label>

          <label className="block md:col-span-2">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Destination address
            </span>
            <textarea
              value={recipientAddress}
              onChange={(event) => setRecipientAddress(event.target.value)}
              className={cn(dashboardTextareaClassName, "min-h-28 font-mono")}
              placeholder="Paste the destination Solana address"
              disabled={isPending || !selectedAsset}
            />
          </label>
        </div>
      )}

      {error ? (
        <div className="mt-5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-200">
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm leading-6 text-emerald-200">
          {notice}
        </div>
      ) : null}

      {lastTransfer ? (
        <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Latest submitted send</p>
          <div className="mt-3 space-y-2 text-sm text-zinc-300">
            <p>
              {lastTransfer.amountDisplay} {lastTransfer.assetSymbol} to {lastTransfer.destinationAddress}
            </p>
            <p className="break-all font-mono text-xs text-zinc-400">{lastTransfer.transactionHash}</p>
            {lastTransfer.explorerUrl ? (
              <a
                href={lastTransfer.explorerUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex text-sm font-semibold text-emerald-400 hover:underline"
              >
                Open Hub transaction
              </a>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={submitSend}
          disabled={isPending || spendableAssets.length === 0 || authSessionSource !== "local"}
          className={cn(
            dashboardButtonClassName,
            (isPending || spendableAssets.length === 0 || authSessionSource !== "local") && "cursor-not-allowed opacity-60",
          )}
        >
          {isPending ? "Submitting send..." : "Send from passkey wallet"}
        </button>
      </div>
    </div>
  );
}
