import Link from "next/link";
import {
  bootstrapTreasuryFormAction,
  refreshAssetsFormAction,
  refreshValidationsFormAction,
  requestAirdropFormAction,
  seedStablecoinFormAction,
} from "@/app/actions";
import { getTreasuryState, getWorkspaceStateOrNull } from "@/app/lib/server-data";
import {
  DashboardEmptyState,
  DashboardMetricCard,
  DashboardPageHeader,
  DashboardPanel,
  DashboardStatusBadge,
  dashboardButtonClassName,
  dashboardButtonSecondaryClassName,
  dashboardSubPanelClassName,
  cn,
} from "@/components/dashboard/primitives";
import { WalletCard } from "@/components/dashboard/WalletCard";
import { OnboardingWelcome } from "@/components/dashboard/OnboardingWelcome";

function formatAmount(value: string) {
  return Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function DashboardOverview() {
  const [workspace, treasury] = await Promise.all([getWorkspaceStateOrNull(), getTreasuryState()]);

  if (!workspace) {
    return (
      <DashboardEmptyState
        title="Connect a treasury operator workspace"
        description="Passkey onboarding unlocks Solana wallet funding, x402 payment links, payout claims, invoices, receipts, and treasury approvals. Connect the workspace first, then return here for the full control plane."
        ctaHref="/auth"
        ctaLabel="Connect passkey wallet"
      />
    );
  }

  const stableAsset = treasury.summary.stableAsset;
  const latestFunding = workspace.fundingEvents[0] ?? null;
  const latestReceipt = workspace.receipts[0] ?? null;
  const authSessionLabel = workspace.authSession
    ? workspace.authSession.source === "local"
      ? "Local device session"
      : "Veridex Auth Session"
    : "No active session";
  const x402LinkCount = workspace.paymentLinks.filter((link) => link.x402Enabled).length;
  const agentClaimCount = workspace.paymentLinks.filter((link) => link.kind === "payout-claim" && link.agentClaimUrl).length;
  const outstandingInvoices = workspace.invoices.filter((invoice) => invoice.status !== "paid" && invoice.status !== "void").length;

  return (
    <div className="space-y-8">
      <OnboardingWelcome
        displayName={workspace.profile.displayName}
        isBootstrapped={!!stableAsset}
        hasAssets={workspace.assets.length > 0}
        hasLinks={workspace.paymentLinks.length > 0}
      />

      <DashboardPanel className="p-7 sm:p-8">
        <DashboardPageHeader
          eyebrow="Treasury workspace"
          title={workspace.profile.displayName}
          description="This operator workspace is backed by a live passkey credential, a persisted workspace session, Prisma-backed Solana asset tracking, and production-style collection workflows."
          actions={
            <>
              <form action={refreshAssetsFormAction}>
                <button className={dashboardButtonSecondaryClassName}>Refresh assets</button>
              </form>
              <form action={refreshValidationsFormAction}>
                <button className={dashboardButtonSecondaryClassName}>Refresh checks</button>
              </form>
            </>
          }
        />

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <WalletCard
            address={workspace.profile.walletAddress}
            explorerUrl={treasury.summary.explorerAddressUrl || undefined}
          />
          <DashboardMetricCard
            label="Auth session"
            value={workspace.authSession ? `${authSessionLabel} · ${workspace.authSession.status}` : "missing"}
            meta={
              workspace.authSession
                ? `Expires ${new Date(workspace.authSession.expiresAt).toLocaleString()}`
                : "Create a fresh session from the auth page"
            }
          />
          <DashboardMetricCard
            label="Tracked assets"
            value={String(workspace.assets.length)}
            meta={stableAsset ? `Primary treasury asset: ${stableAsset.symbol}` : "Bootstrap treasury asset pending"}
          />
          <DashboardMetricCard
            label="Agentic rails"
            value={String(x402LinkCount + agentClaimCount)}
            meta={`${x402LinkCount} x402 payment endpoints and ${agentClaimCount} agent claim links`}
          />
        </div>
      </DashboardPanel>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <DashboardPanel className="p-7 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">Treasury runtime</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">
                {stableAsset ? "Bootstrapped and settlement-ready" : "Bootstrap required"}
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-400">
                Review the managed treasury identity, stable asset posture, payout queue, and funding guidance before moving capital or issuing links.
              </p>
            </div>
            <form action={bootstrapTreasuryFormAction}>
              <button className={dashboardButtonClassName}>{stableAsset ? "Re-run bootstrap checks" : "Bootstrap treasury"}</button>
            </form>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className={cn(dashboardSubPanelClassName, "p-5")}>
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Treasury vault</p>
              <p className="mt-4 break-all font-mono text-sm text-zinc-100">{treasury.actors.treasuryAddress || "Not bootstrapped"}</p>
              <p className="mt-3 text-sm leading-6 text-zinc-400">
                Explorer:{" "}
                {treasury.summary.explorerAddressUrl ? (
                  <a href={treasury.summary.explorerAddressUrl} className="text-emerald-400 hover:underline" target="_blank" rel="noreferrer">
                    open address
                  </a>
                ) : (
                  "unavailable"
                )}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <form action={requestAirdropFormAction}>
                  <input type="hidden" name="amount" value="1" />
                  <button className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400 transition-all hover:bg-emerald-500/20 active:scale-95">
                    + 1 SOL
                  </button>
                </form>
                <form action={seedStablecoinFormAction}>
                  <input type="hidden" name="amount" value="250" />
                  <button className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-400 transition-all hover:bg-cyan-500/20 active:scale-95">
                    + 250 {stableAsset?.symbol || "Stable"}
                  </button>
                </form>
              </div>
            </div>
            <div className={cn(dashboardSubPanelClassName, "p-5")}>
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Payout queue</p>
              <p className="mt-4 text-3xl font-semibold text-white">{treasury.payouts.length}</p>
              <p className="mt-3 text-sm leading-6 text-zinc-400">{treasury.summary.pendingApprovals} pending approval or escalation</p>
            </div>
          </div>

          <div className={cn(dashboardSubPanelClassName, "mt-6 p-5")}>
            <div className="flex flex-wrap items-center gap-3">
              <DashboardStatusBadge tone={stableAsset ? "success" : "warning"}>
                {stableAsset ? stableAsset.symbol : "No stable asset"}
              </DashboardStatusBadge>
              <DashboardStatusBadge tone={treasury.validations.every((item) => item.status === "healthy") ? "success" : "warning"}>
                {treasury.validations.filter((item) => item.status === "healthy").length}/{treasury.validations.length} healthy checks
              </DashboardStatusBadge>
            </div>
            <p className="mt-4 text-sm leading-7 text-zinc-400">
              {stableAsset
                ? `Managed treasury asset ${stableAsset.symbol} is live at mint ${stableAsset.mintAddress} on Solana devnet.`
                : "Bootstrap creates the treasury identities, policy controls, and managed stable asset on Solana devnet."}
            </p>
          </div>
        </DashboardPanel>

        <DashboardPanel className="p-7 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">Commerce posture</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">Collections, claims, and invoice pressure</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <DashboardMetricCard label="x402 links" value={String(x402LinkCount)} meta="Agent-compatible collection endpoints" />
            <DashboardMetricCard label="Claim links" value={String(agentClaimCount)} meta="Payout claims available to agents" />
            <DashboardMetricCard label="Open invoices" value={String(outstandingInvoices)} meta="Invoices awaiting settlement" />
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/dashboard/collections" className={dashboardButtonClassName}>
              Open collections
            </Link>
            <Link href="/dashboard/reviews" className={dashboardButtonSecondaryClassName}>
              Review payout queue
            </Link>
          </div>
        </DashboardPanel>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <DashboardPanel className="p-7 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">Funding actions</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">Keep the operator wallet liquid</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-400">
                Refresh balances, request devnet SOL for fees, or seed treasury stable liquidity into this passkey-controlled Solana wallet.
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <form action={requestAirdropFormAction} className={cn(dashboardSubPanelClassName, "p-5")}>
              <input type="hidden" name="amount" value="1" />
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Devnet SOL</p>
              <p className="mt-4 text-sm leading-7 text-zinc-400">
                Request 1 SOL to cover token-account creation, transaction fees, and claim settlement tests.
              </p>
              <button className={cn(dashboardButtonClassName, "mt-6 w-full")}>Request airdrop</button>
            </form>

            <form action={seedStablecoinFormAction} className={cn(dashboardSubPanelClassName, "p-5")}>
              <input type="hidden" name="amount" value="250" />
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Treasury stablecoin</p>
              <p className="mt-4 text-sm leading-7 text-zinc-400">
                Seed 250 {stableAsset?.symbol || "stable"} from the treasury so this workspace can test real Solana payment flows.
              </p>
              <button className={cn(dashboardButtonClassName, "mt-6 w-full")}>Seed wallet</button>
            </form>
          </div>

          <div className={cn(dashboardSubPanelClassName, "mt-6 p-5")}>
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Latest funding event</p>
            {latestFunding ? (
              <div className="mt-4 space-y-2 text-sm text-zinc-300">
                <p>Type: {latestFunding.eventType}</p>
                <p>Amount: {latestFunding.amountDisplay} {latestFunding.assetSymbol}</p>
                <p>Status: {latestFunding.status}</p>
              </div>
            ) : (
              <p className="mt-4 text-sm leading-7 text-zinc-400">No wallet funding has been requested yet.</p>
            )}
          </div>
        </DashboardPanel>

        <DashboardPanel className="p-7 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">Assets and activity</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">Live balances and recent settlement proof</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-400">
                Asset snapshots are sourced from the connected Solana wallet and the treasury ledger, then paired with the latest payment or claim receipt.
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {workspace.assets.length ? (
              workspace.assets.map((asset) => (
                <div key={asset.id} className={cn(dashboardSubPanelClassName, "p-5")}>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">{asset.assetType}</p>
                  <p className="mt-4 text-3xl font-semibold tracking-tight text-white">{asset.symbol}</p>
                  <p className="mt-2 text-lg font-medium text-zinc-100">{formatAmount(asset.amountDisplay)}</p>
                  <p className="mt-2 text-sm text-zinc-400">{asset.name}</p>
                </div>
              ))
            ) : (
              <div className={cn(dashboardSubPanelClassName, "p-5 md:col-span-2 xl:col-span-3")}>
                <p className="text-sm leading-7 text-zinc-400">No asset snapshots yet. Refresh balances after funding the workspace wallet.</p>
              </div>
            )}
          </div>

          <div className={cn(dashboardSubPanelClassName, "mt-6 p-5")}>
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Latest receipt</p>
            {latestReceipt ? (
              <div className="mt-4 space-y-2 text-sm text-zinc-300">
                <p>Receipt: {latestReceipt.receiptNumber}</p>
                <p>Amount: {latestReceipt.amountDisplay} {latestReceipt.assetSymbol}</p>
                <p>Rail: {latestReceipt.settlementRail}</p>
                <p className="break-all">Signature: {latestReceipt.txSignature || "Unavailable"}</p>
              </div>
            ) : (
              <p className="mt-4 text-sm leading-7 text-zinc-400">No receipts yet. Create a payment link or payout claim from Collections.</p>
            )}
          </div>
        </DashboardPanel>
      </section>
    </div>
  );
}
