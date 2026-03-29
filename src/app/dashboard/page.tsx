import Link from "next/link";
import {
  bootstrapTreasuryFormAction,
  refreshAssetsFormAction,
  refreshValidationsFormAction,
  requestAirdropFormAction,
  seedStablecoinFormAction,
} from "@/app/actions";
import { getTreasuryState, getWorkspaceStateOrNull } from "@/app/lib/server-data";
import { LiveAssetsPanel } from "@/components/dashboard/LiveAssetsPanel";
import { ErrorBanner } from "@/components/dashboard/ErrorBanner";
import { ForexRatesWidget } from "@/components/dashboard/ForexRatesWidget";
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

function formatFullAmount(value: string) {
  const [wholePart, fractionalPart] = value.split(".");
  const formattedWhole = Number(wholePart || "0").toLocaleString();
  return fractionalPart ? `${formattedWhole}.${fractionalPart}` : formattedWhole;
}

export default async function DashboardOverview({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; bootstrapped?: string }>;
}) {
  const [workspace, treasury, params] = await Promise.all([
    getWorkspaceStateOrNull(),
    getTreasuryState(),
    searchParams,
  ]);

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

  const solAsset = workspace.assets.find((a) => a.symbol === "SOL");
  const stableBalance = stableAsset
    ? workspace.assets.find((a) => a.mintAddress === stableAsset.mintAddress)
    : null;
  const walletIsEmpty = workspace.assets.length === 0 || workspace.assets.every((a) => Number(a.amountDisplay) === 0);
  const walletHasTokens = workspace.assets.some((asset) => Number(asset.amountDisplay) > 0);
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
      {params.error ? <ErrorBanner message={params.error} /> : null}
      {params.bootstrapped ? (
        <ErrorBanner
          tone="success"
          message={`Treasury vault initialized successfully. ${stableAsset ? `${stableAsset.symbol} settlement rails are now configured.` : "Refresh the page if the treasury asset details are still loading."}`}
        />
      ) : null}
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
            label="Wallet balance"
            value={
              solAsset
                ? `${formatFullAmount(solAsset.amountDisplay)} SOL`
                : "0 SOL"
            }
            meta={
              stableBalance
                ? `${formatFullAmount(stableBalance.amountDisplay)} ${stableAsset!.symbol}`
                : stableAsset
                  ? `0 ${stableAsset.symbol}`
                  : "Bootstrap treasury asset pending"
            }
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
                {stableAsset ? "Treasury vault is settlement-ready" : "Treasury vault initialization required"}
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-400">
                {walletHasTokens
                  ? "Your connected wallet already holds assets. This step only initializes the server-side treasury vault used for payout claims, audit state, and treasury-backed settlement."
                  : "Review the treasury vault identity, stable asset posture, payout queue, and funding guidance before moving capital or issuing links."}
              </p>
            </div>
            {!stableAsset && (
              <form action={bootstrapTreasuryFormAction}>
                <input type="hidden" name="returnTo" value="/dashboard" />
                <button className={dashboardButtonClassName}>Initialize treasury vault</button>
              </form>
            )}
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className={cn(dashboardSubPanelClassName, "p-5")}>
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Passkey vault</p>
              <p className="mt-4 break-all font-mono text-sm text-zinc-100">{workspace.profile.walletAddress}</p>
              <p className="mt-3 text-sm leading-6 text-zinc-400">
                Explorer:{" "}
                {workspace.profile.walletAddress ? (
                  <a href={`https://explorer.solana.com/address/${workspace.profile.walletAddress}?cluster=devnet`} className="text-emerald-400 hover:underline" target="_blank" rel="noreferrer">
                    open address
                  </a>
                ) : (
                  "unavailable"
                )}
              </p>
              {walletIsEmpty && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <form action={requestAirdropFormAction}>
                    <input type="hidden" name="amount" value="1" />
                    <button className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400 transition-all hover:bg-emerald-500/20 active:scale-95">
                      + 1 SOL
                    </button>
                  </form>
                  {stableAsset && (
                    <form action={seedStablecoinFormAction}>
                      <input type="hidden" name="amount" value="250" />
                      <button className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-400 transition-all hover:bg-cyan-500/20 active:scale-95">
                        + 250 {stableAsset.symbol}
                      </button>
                    </form>
                  )}
                </div>
              )}
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
                ? `Treasury settlement asset ${stableAsset.symbol} is live at mint ${stableAsset.mintAddress} on Solana devnet.`
                : "Initializing the treasury vault creates the treasury identities, policy controls, and settlement asset used for payout claims on Solana devnet."}
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
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">
                {walletIsEmpty ? "Funding actions" : "Wallet overview"}
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">
                {walletIsEmpty ? "Fund your operator wallet" : "Operator wallet balances"}
              </h2>
              <p className="mt-3 text-sm leading-7 text-zinc-400">
                {walletIsEmpty
                  ? "Request devnet SOL for fees, then seed treasury stable liquidity into your passkey-controlled Solana wallet."
                  : "Live tracked balances across all token accounts in this workspace wallet."}
              </p>
            </div>
          </div>

          {walletIsEmpty ? (
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <form action={requestAirdropFormAction} className={cn(dashboardSubPanelClassName, "p-5")}>
                <input type="hidden" name="amount" value="1" />
                <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Devnet SOL</p>
                <p className="mt-4 text-sm leading-7 text-zinc-400">
                  Request 1 SOL to cover token-account creation, transaction fees, and claim settlement tests.
                </p>
                <button className={cn(dashboardButtonClassName, "mt-6 w-full")}>Request airdrop</button>
              </form>

              {stableAsset && (
                <form action={seedStablecoinFormAction} className={cn(dashboardSubPanelClassName, "p-5")}>
                  <input type="hidden" name="amount" value="250" />
                  <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Treasury stablecoin</p>
                  <p className="mt-4 text-sm leading-7 text-zinc-400">
                    Seed 250 {stableAsset.symbol} from the treasury so this workspace can test real Solana payment flows.
                  </p>
                  <button className={cn(dashboardButtonClassName, "mt-6 w-full")}>Seed wallet</button>
                </form>
              )}
            </div>
          ) : (
            <div className="mt-8 space-y-3">
              {workspace.assets.map((asset) => (
                <div key={asset.id} className={cn(dashboardSubPanelClassName, "flex items-center justify-between p-4")}>
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 text-xs font-bold text-zinc-300">
                      {asset.symbol.slice(0, 3)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{asset.name || asset.symbol}</p>
                      <p className="text-xs text-zinc-500">{asset.assetType === "native" ? "Native" : "SPL Token"}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums text-white">
                      {Number(asset.amountDisplay).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: asset.decimals > 4 ? 4 : asset.decimals,
                      })}
                    </p>
                    <p className="text-xs text-zinc-500">{asset.symbol}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

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
          <LiveAssetsPanel initialAssets={workspace.assets} initialReceipt={latestReceipt} />
        </DashboardPanel>
      </section>

      {/* SIX Group forex rates */}
      <DashboardPanel className="p-7 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">SIX Group market data</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">Live forex rates</h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-400">
          Real-time FX rates from SIX Financial Information via mTLS-authenticated API. Refreshes every 60 seconds.
        </p>
        <div className="mt-6">
          <ForexRatesWidget />
        </div>
      </DashboardPanel>
    </div>
  );
}
