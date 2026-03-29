import Link from "next/link";
import {
  bootstrapTreasuryFormAction,
  createClaimLinkFormAction,
  createInvoiceFormAction,
  createPaymentLinkFormAction,
} from "@/app/actions";
import { getTreasuryState, getWorkspaceStateOrNull } from "@/app/lib/server-data";
import { ErrorBanner } from "@/components/dashboard/ErrorBanner";
import {
  DashboardEmptyState,
  DashboardPageHeader,
  DashboardPanel,
  DashboardStatusBadge,
  dashboardButtonClassName,
  dashboardInputClassName,
  dashboardSelectClassName,
  dashboardSubPanelClassName,
  dashboardTextareaClassName,
  cn,
} from "@/components/dashboard/primitives";

function formatAmount(value: string) {
  return Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function CollectionsPage({
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
        title="Connect a workspace to manage collections"
        description="Payment links, payout claims, invoices, and receipts are tied to the connected Solana passkey workspace. Connect the operator wallet first to activate commerce workflows."
        ctaHref="/auth"
        ctaLabel="Connect passkey wallet"
      />
    );
  }

  const stableAsset = treasury.summary.stableAsset;
  const treasuryReady = Boolean(treasury.policy && stableAsset && treasury.actors.treasuryAddress);
  const walletHasTokens = workspace.assets.some((asset) => Number(asset.amountDisplay) > 0);

  return (
    <div className="space-y-8">
      {params.error ? <ErrorBanner message={params.error} /> : null}
      {params.bootstrapped ? (
        <ErrorBanner
          tone="success"
          message={`Treasury bootstrapped successfully. ${stableAsset ? `${stableAsset.symbol} settlement rails are now live on Solana devnet.` : "Refresh the page if the asset details are still loading."}`}
        />
      ) : null}
      <DashboardPanel className="p-7 sm:p-8">
        <DashboardPageHeader
          eyebrow="Collections readiness"
          title={treasuryReady ? "Treasury vault is ready for payment and claim links" : "Treasury vault initialization will run on first commerce action"}
          description={
            treasuryReady
              ? `Claims, payment links, and invoices will settle against ${stableAsset!.symbol} on Solana devnet from treasury vault ${workspace.treasury.vaultAddress}.`
              : walletHasTokens
                ? "Your connected wallet already has assets. The first payment link, payout claim, or invoice will only initialize the dedicated treasury vault used for claim settlement and audit state."
                : "The first payment link, payout claim, or invoice you create will initialize the Solana treasury vault and settlement asset automatically. You can also initialize it manually first."
          }
          actions={
            !treasuryReady ? (
              <form action={bootstrapTreasuryFormAction}>
                <input type="hidden" name="returnTo" value="/dashboard/collections" />
                <button className={dashboardButtonClassName}>Initialize treasury vault</button>
              </form>
            ) : undefined
          }
        />

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className={cn(dashboardSubPanelClassName, "p-5")}>
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Settlement asset</p>
            <div className="mt-4 flex items-center gap-3">
              <DashboardStatusBadge tone={treasuryReady ? "success" : "warning"}>
                {treasuryReady ? stableAsset!.symbol : "Pending bootstrap"}
              </DashboardStatusBadge>
            </div>
            <p className="mt-4 break-all text-sm leading-6 text-zinc-400">
              {treasuryReady ? stableAsset!.mintAddress : "A treasury settlement asset will be attached on first commerce action."}
            </p>
          </div>

          <div className={cn(dashboardSubPanelClassName, "p-5")}>
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Treasury vault</p>
            <p className="mt-4 break-all text-sm leading-6 text-zinc-100">
              {treasury.actors.treasuryAddress || "Will be generated during treasury bootstrap"}
            </p>
            <p className="mt-3 text-sm leading-6 text-zinc-400">
              {treasury.summary.explorerAddressUrl && treasury.actors.treasuryAddress ? (
                <a href={treasury.summary.explorerAddressUrl} target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline">
                  Open Solana explorer
                </a>
              ) : (
                "Explorer link becomes available after bootstrap."
              )}
            </p>
          </div>

          <div className={cn(dashboardSubPanelClassName, "p-5")}>
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">First-run behavior</p>
            <p className="mt-4 text-sm leading-7 text-zinc-400">
              {treasuryReady
                ? "Commerce flows are already live. New payment links, payout claims, and invoices will use the bootstrapped treasury immediately."
                : walletHasTokens
                  ? "Creating your first commerce object will initialize the treasury vault only. It will not add more tokens to your connected wallet."
                  : "Creating your first commerce object will initialize the treasury vault and settlement asset, then continue the request."}
            </p>
          </div>
        </div>
      </DashboardPanel>

      <DashboardPanel className="p-7 sm:p-8">
        <DashboardPageHeader
          eyebrow="Collections and commerce"
          title="Issue Solana-native payment requests"
          description="Create real payment links, payout claim links, and invoices backed by the live treasury. Receipts and settlement rails stay tied to the same passkey workspace."
        />

        <div className="mt-8 grid gap-6 xl:grid-cols-3">
          <form action={createPaymentLinkFormAction} className={cn(dashboardSubPanelClassName, "p-5")}>
            <h2 className="text-lg font-semibold text-white">Payment link</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">Human-friendly collection page with optional x402 endpoint for agentic payment flows.</p>
            <div className="mt-5 space-y-4">
              <input name="title" required className={dashboardInputClassName} placeholder="Quarterly treasury retainer" />
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <input name="amount" required type="number" min="0.01" step="0.01" className={dashboardInputClassName} placeholder="1000.00" />
                <select name="currency" defaultValue="USDC" className={dashboardSelectClassName}>
                  <option value="USDC">USDC</option>
                  <option value="EURC">EURC</option>
                  <option value="SOL">SOL</option>
                </select>
              </div>
              <input name="customerName" className={dashboardInputClassName} placeholder="Customer name" />
              <input name="customerEmail" type="email" className={dashboardInputClassName} placeholder="customer@email.com" />
              <textarea name="description" className={dashboardTextareaClassName} placeholder="What this payment covers" />
              <label className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-800 bg-zinc-950/80 px-4 py-3 text-sm text-zinc-300">
                <span>
                  <strong className="block text-white">Enable Solana x402</strong>
                  <span className="text-zinc-500">Expose the machine-payable endpoint beside the public pay page.</span>
                </span>
                <input type="checkbox" name="x402Enabled" defaultChecked className="h-4 w-4 accent-emerald-500" />
              </label>
            </div>
            <button className={cn(dashboardButtonClassName, "mt-6 w-full")}>Create payment link</button>
          </form>

          <form action={createClaimLinkFormAction} className={cn(dashboardSubPanelClassName, "p-5")}>
            <h2 className="text-lg font-semibold text-white">Payout claim link</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Issue a claimable payout that can be settled by a human or an agent, based on the selected mode.
              {!treasuryReady ? " If this is your first claim link, the treasury vault will initialize automatically before the link is created." : ""}
            </p>
            <div className="mt-5 space-y-4">
              <input name="title" required className={dashboardInputClassName} placeholder="Vendor reimbursement" />
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <input name="amount" required type="number" min="0.01" step="0.01" className={dashboardInputClassName} placeholder="250.00" />
                <select name="currency" defaultValue="USDC" className={dashboardSelectClassName}>
                  <option value="USDC">USDC</option>
                  <option value="EURC">EURC</option>
                  <option value="SOL">SOL</option>
                </select>
              </div>
              <input name="customerName" className={dashboardInputClassName} placeholder="Recipient name" />
              <input name="customerEmail" type="email" className={dashboardInputClassName} placeholder="recipient@email.com" />
              <textarea name="description" className={dashboardTextareaClassName} placeholder="Why this payout is claimable" />
              <select name="claimMode" defaultValue="either" className={dashboardSelectClassName}>
                <option value="either">Human or agent can claim</option>
                <option value="human">Human-only claim</option>
                <option value="agent">Agent-only claim</option>
              </select>
            </div>
            <button className={cn(dashboardButtonClassName, "mt-6 w-full")}>Create claim link</button>
          </form>

          <form action={createInvoiceFormAction} className={cn(dashboardSubPanelClassName, "p-5")}>
            <h2 className="text-lg font-semibold text-white">Invoice</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">Generate a receivable record with a public settlement path and receipt generation after payment.</p>
            <div className="mt-5 space-y-4">
              <input name="title" required className={dashboardInputClassName} placeholder="Implementation invoice" />
              <input name="customerName" required className={dashboardInputClassName} placeholder="Customer name" />
              <input name="customerEmail" type="email" className={dashboardInputClassName} placeholder="customer@email.com" />
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <input name="amount" required type="number" min="0.01" step="0.01" className={dashboardInputClassName} placeholder="5000.00" />
                <select name="currency" defaultValue="USDC" className={dashboardSelectClassName}>
                  <option value="USDC">USDC</option>
                  <option value="EURC">EURC</option>
                  <option value="SOL">SOL</option>
                </select>
              </div>
              <textarea name="description" className={dashboardTextareaClassName} placeholder="Invoice notes" />
            </div>
            <button className={cn(dashboardButtonClassName, "mt-6 w-full")}>Create invoice</button>
          </form>
        </div>
      </DashboardPanel>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <DashboardPanel className="p-7 sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">Live commerce links</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">Payment requests and payout claims</h2>
            </div>
            <Link href="/dashboard/collections/links" className={cn(dashboardButtonClassName, "whitespace-nowrap")}>
              Manage links →
            </Link>
          </div>

          <div className="mt-8 overflow-hidden rounded-3xl border border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-950/80 text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Rails</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Endpoints</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800 bg-zinc-900/70">
                {workspace.paymentLinks.length ? (
                  workspace.paymentLinks.map((link) => (
                    <tr key={link.id}>
                      <td className="px-4 py-4 align-top">
                        <strong className="block text-white">{link.title}</strong>
                        <span className="text-zinc-500">{link.customerEmail || "No customer email"}</span>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <p className="text-zinc-200">{link.kind}</p>
                        <p className="mt-1 text-xs text-zinc-500">{link.supportedSettlementRails.join(" / ")}</p>
                      </td>
                      <td className="px-4 py-4 align-top text-zinc-200">
                        {formatAmount(link.amountDisplay)} {link.assetSymbol}
                      </td>
                      <td className="px-4 py-4 align-top">
                        <DashboardStatusBadge tone={link.status === "paid" || link.status === "claimed" ? "success" : "neutral"}>
                          {link.status}
                        </DashboardStatusBadge>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="space-y-2">
                          <Link href={`/${link.kind === "payment-request" ? "pay" : "claim"}/${link.slug}`} className="block text-sm font-semibold text-emerald-400 hover:underline">
                            Open public page
                          </Link>
                          {link.x402Url ? <p className="break-all text-xs text-zinc-500">{link.x402Url}</p> : null}
                          {link.agentClaimUrl ? <p className="break-all text-xs text-zinc-500">{link.agentClaimUrl}</p> : null}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-zinc-500">No commerce links created yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </DashboardPanel>

        <div className="space-y-6">
          <DashboardPanel className="p-7 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">Invoices</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">Receivables</h2>
            <div className="mt-6 space-y-4">
              {workspace.invoices.length ? (
                workspace.invoices.map((invoice) => (
                  <article key={invoice.id} className={cn(dashboardSubPanelClassName, "p-5")}>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">{invoice.invoiceNumber}</p>
                    <h3 className="mt-2 text-lg font-semibold text-white">{invoice.title}</h3>
                    <p className="mt-2 text-sm text-zinc-500">{invoice.customerName}</p>
                    <p className="mt-3 text-lg font-medium text-zinc-100">{formatAmount(invoice.amountDisplay)} {invoice.assetSymbol}</p>
                    <div className="mt-4">
                      <DashboardStatusBadge tone={invoice.status === "paid" ? "success" : invoice.status === "void" ? "danger" : "warning"}>
                        {invoice.status}
                      </DashboardStatusBadge>
                    </div>
                  </article>
                ))
              ) : (
                <div className={cn(dashboardSubPanelClassName, "p-5 text-sm leading-7 text-zinc-400")}>No invoices yet.</div>
              )}
            </div>
          </DashboardPanel>

          <DashboardPanel className="p-7 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">Receipts</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">Settlement proof</h2>
            <div className="mt-6 space-y-4">
              {workspace.receipts.length ? (
                workspace.receipts.map((receipt) => (
                  <article key={receipt.id} className={cn(dashboardSubPanelClassName, "p-5")}>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">{receipt.receiptNumber}</p>
                    <h3 className="mt-2 text-lg font-semibold capitalize text-white">{receipt.kind}</h3>
                    <p className="mt-3 text-lg font-medium text-zinc-100">{formatAmount(receipt.amountDisplay)} {receipt.assetSymbol}</p>
                    <p className="mt-2 text-sm text-zinc-500">Rail: {receipt.settlementRail}</p>
                    <p className="mt-2 break-all text-xs text-zinc-500">{receipt.txSignature || "Pending signature"}</p>
                  </article>
                ))
              ) : (
                <div className={cn(dashboardSubPanelClassName, "p-5 text-sm leading-7 text-zinc-400")}>
                  Receipts appear after payments or payout claims settle on Solana.
                </div>
              )}
            </div>
          </DashboardPanel>
        </div>
      </section>
    </div>
  );
}
