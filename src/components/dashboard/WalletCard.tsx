"use client";

import { CopyButton } from "@/components/dashboard/CopyButton";
import { cn, dashboardSubPanelClassName } from "@/components/dashboard/primitives";

export function WalletCard({ address, explorerUrl }: { address: string; explorerUrl?: string }) {
  const truncated = `${address.slice(0, 6)}...${address.slice(-4)}`;

  return (
    <article className={cn(dashboardSubPanelClassName, "p-5")}>
      <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Wallet</p>
      <div className="mt-4 flex items-center gap-2">
        <p className="font-mono text-sm text-zinc-100" title={address}>{truncated}</p>
        <CopyButton text={address} label="Copy" />
      </div>
      <p className="mt-2 text-sm leading-6 text-zinc-400">Solana wallet derived from the live passkey credential</p>
      {explorerUrl && (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-xs text-emerald-400 hover:underline"
        >
          View on explorer ↗
        </a>
      )}
    </article>
  );
}
