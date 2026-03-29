"use client";

import React, { startTransition, useEffect, useEffectEvent, useState } from "react";
import type { ReceiptRecord, TrackedAssetSnapshot } from "@/server/types/index";
import {
  DashboardStatusBadge,
  dashboardSubPanelClassName,
  cn,
} from "@/components/dashboard/primitives";

function formatAmount(value: string) {
  const [wholePart, fractionalPart] = value.split(".");
  const formattedWhole = Number(wholePart || "0").toLocaleString();
  return fractionalPart ? `${formattedWhole}.${fractionalPart}` : formattedWhole;
}

interface LiveWorkspaceResponse {
  workspace: {
    assets: TrackedAssetSnapshot[];
  };
  syncedAt: number;
}

export function LiveAssetsPanel({
  initialAssets,
  initialReceipt,
}: {
  initialAssets: TrackedAssetSnapshot[];
  initialReceipt: ReceiptRecord | null;
}) {
  const [assets, setAssets] = useState(initialAssets);
  const [syncedAt, setSyncedAt] = useState<number | null>(initialAssets[0]?.capturedAt ?? null);
  const [syncState, setSyncState] = useState<"idle" | "syncing" | "error">("idle");
  const failCountRef = React.useRef(0);
  const refreshInFlightRef = React.useRef(false);
  const BASE_INTERVAL = 30_000;
  const MAX_INTERVAL = 300_000;

  const refreshAssets = useEffectEvent(async () => {
    if (document.visibilityState === "hidden") {
      return;
    }

    if (refreshInFlightRef.current) {
      return;
    }

    refreshInFlightRef.current = true;

    setSyncState("syncing");

    try {
      const response = await fetch("/api/workspace/live", {
        method: "GET",
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        throw new Error("Live balance refresh failed.");
      }

      const payload = (await response.json()) as LiveWorkspaceResponse;

      failCountRef.current = 0;
      startTransition(() => {
        setAssets(payload.workspace.assets);
        setSyncedAt(payload.syncedAt);
        setSyncState("idle");
      });
    } catch {
      failCountRef.current = Math.min(failCountRef.current + 1, 6);
      setSyncState("error");
    } finally {
      refreshInFlightRef.current = false;
    }
  });

  useEffect(() => {
    let timerId: ReturnType<typeof setTimeout>;

    function schedule() {
      const delay = Math.min(BASE_INTERVAL * 2 ** failCountRef.current, MAX_INTERVAL);
      timerId = setTimeout(async () => {
        await refreshAssets();
        schedule();
      }, delay);
    }

    void refreshAssets().then(schedule);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        failCountRef.current = 0;
        void refreshAssets();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearTimeout(timerId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">Assets and activity</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">Live balances and recent settlement proof</h2>
          <p className="mt-3 text-sm leading-7 text-zinc-400">
            Asset balances are refreshed directly from Solana devnet every 30 seconds so new wallet funding shows up without a full page reload.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <DashboardStatusBadge tone={syncState === "error" ? "warning" : "success"}>
            {syncState === "syncing" ? "Syncing live balances" : syncState === "error" ? "Live sync retrying" : "Realtime balance tracking"}
          </DashboardStatusBadge>
          <p className="text-xs text-zinc-500">
            {syncedAt ? `Last synced ${new Date(syncedAt).toLocaleTimeString()}` : "Waiting for first sync"}
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {assets.length ? (
          assets.map((asset) => (
            <div key={asset.id} className={cn(dashboardSubPanelClassName, "p-5")}>
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">{asset.assetType}</p>
              <p className="mt-4 text-3xl font-semibold tracking-tight text-white">{asset.symbol}</p>
              <p className="mt-2 text-lg font-medium text-zinc-100">{formatAmount(asset.amountDisplay)}</p>
              <p className="mt-2 text-sm text-zinc-400">{asset.name}</p>
              {asset.explorerUrl ? (
                <a
                  href={asset.explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex text-xs font-medium text-emerald-400 hover:text-emerald-300"
                >
                  View on explorer
                </a>
              ) : null}
            </div>
          ))
        ) : (
          <div className={cn(dashboardSubPanelClassName, "p-5 md:col-span-2 xl:col-span-3")}>
            <p className="text-sm leading-7 text-zinc-400">No live balances yet. Fund the workspace wallet and the dashboard will refresh automatically.</p>
          </div>
        )}
      </div>

      <div className={cn(dashboardSubPanelClassName, "mt-6 p-5")}>
        <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Latest receipt</p>
        {initialReceipt ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            <p>Receipt: {initialReceipt.receiptNumber}</p>
            <p>Amount: {initialReceipt.amountDisplay} {initialReceipt.assetSymbol}</p>
            <p>Rail: {initialReceipt.settlementRail}</p>
            <p className="break-all">Signature: {initialReceipt.txSignature || "Unavailable"}</p>
          </div>
        ) : (
          <p className="mt-4 text-sm leading-7 text-zinc-400">No receipts yet. Create a payment link or payout claim from Collections.</p>
        )}
      </div>
    </div>
  );
}
