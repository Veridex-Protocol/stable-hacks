import Link from "next/link";
import { disablePaymentLinkFormAction } from "@/app/actions";
import { getWorkspaceStateOrNull } from "@/app/lib/server-data";
import { ErrorBanner } from "@/components/dashboard/ErrorBanner";
import {
  DashboardEmptyState,
  DashboardPageHeader,
  DashboardPanel,
  DashboardStatusBadge,
  dashboardButtonClassName,
  dashboardSubPanelClassName,
  cn,
} from "@/components/dashboard/primitives";

function formatAmount(value: string) {
  return Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusTone(status: string): "success" | "warning" | "danger" | "neutral" {
  switch (status) {
    case "paid":
    case "claimed":
      return "success";
    case "expired":
      return "danger";
    default:
      return "neutral";
  }
}

export default async function PaymentLinksPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string }>;
}) {
  const workspace = await getWorkspaceStateOrNull();
  const params = await searchParams;
  const filterStatus = params.status ?? "all";

  if (!workspace) {
    return (
      <DashboardEmptyState
        title="Connect a workspace first"
        description="Payment links are tied to the connected passkey workspace."
        ctaHref="/auth"
        ctaLabel="Connect passkey wallet"
      />
    );
  }

  const links = workspace.paymentLinks.filter(
    (link) => filterStatus === "all" || link.status === filterStatus,
  );

  return (
    <div className="space-y-8">
      {params.error ? <ErrorBanner message={params.error} /> : null}
      <DashboardPanel className="p-7 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <DashboardPageHeader
            eyebrow="Commerce management"
            title="Payment links"
            description="View, inspect, and manage all payment requests and payout claims created under this workspace."
          />
          <Link href="/dashboard/collections" className={cn(dashboardButtonClassName, "whitespace-nowrap self-start")}>
            ← Back to collections
          </Link>
        </div>

        {/* Status filters */}
        <nav className="mt-6 flex flex-wrap gap-2">
          {["all", "active", "paid", "claimed", "expired"].map((s) => (
            <Link
              key={s}
              href={s === "all" ? "/dashboard/collections/links" : `/dashboard/collections/links?status=${s}`}
              className={cn(
                "rounded-full border px-4 py-1.5 text-xs font-medium capitalize transition-colors",
                filterStatus === s
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                  : "border-zinc-700 bg-zinc-900/60 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300",
              )}
            >
              {s === "all" ? `All (${workspace.paymentLinks.length})` : `${s} (${workspace.paymentLinks.filter((l) => l.status === s).length})`}
            </Link>
          ))}
        </nav>
      </DashboardPanel>

      {/* Links list */}
      {links.length === 0 ? (
        <DashboardPanel className="p-7 sm:p-8">
          <p className="text-sm text-zinc-500">
            {filterStatus === "all"
              ? "No payment links created yet. Head to Collections to create one."
              : `No ${filterStatus} links found.`}
          </p>
        </DashboardPanel>
      ) : (
        <div className="space-y-4">
          {links.map((link) => (
            <DashboardPanel key={link.id} className="p-6 sm:p-7">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                {/* Left column — detail */}
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-lg font-semibold text-white">{link.title}</h3>
                    <DashboardStatusBadge tone={statusTone(link.status)}>
                      {link.status}
                    </DashboardStatusBadge>
                    <span className="rounded-full border border-zinc-700 bg-zinc-800/60 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                      {link.kind}
                    </span>
                  </div>

                  {link.description ? (
                    <p className="text-sm leading-relaxed text-zinc-400">{link.description}</p>
                  ) : null}

                  <div className="grid gap-x-8 gap-y-2 text-sm text-zinc-400 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <span className="text-zinc-500">Amount:</span>{" "}
                      <span className="text-zinc-200">{formatAmount(link.amountDisplay)} {link.assetSymbol}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500">Destination:</span>{" "}
                      <span className="break-all font-mono text-xs text-zinc-300">{link.destinationAddress.slice(0, 8)}…{link.destinationAddress.slice(-6)}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500">Created:</span>{" "}
                      <span className="text-zinc-300">{formatDate(link.createdAt)}</span>
                    </div>
                    {link.customerName ? (
                      <div>
                        <span className="text-zinc-500">Customer:</span>{" "}
                        <span className="text-zinc-200">{link.customerName}</span>
                      </div>
                    ) : null}
                    {link.customerEmail ? (
                      <div>
                        <span className="text-zinc-500">Email:</span>{" "}
                        <span className="text-zinc-200">{link.customerEmail}</span>
                      </div>
                    ) : null}
                    {link.expiresAt ? (
                      <div>
                        <span className="text-zinc-500">Expires:</span>{" "}
                        <span className="text-zinc-300">{formatDate(link.expiresAt)}</span>
                      </div>
                    ) : null}
                    <div>
                      <span className="text-zinc-500">Claim mode:</span>{" "}
                      <span className="text-zinc-300">{link.claimMode}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500">Rails:</span>{" "}
                      <span className="text-zinc-300">{link.supportedSettlementRails.join(", ")}</span>
                    </div>
                    {link.settledSignature ? (
                      <div className="sm:col-span-2 lg:col-span-3">
                        <span className="text-zinc-500">Tx:</span>{" "}
                        {link.explorerUrl ? (
                          <a href={link.explorerUrl} target="_blank" rel="noopener noreferrer" className="break-all font-mono text-xs text-emerald-400 hover:underline">
                            {link.settledSignature}
                          </a>
                        ) : (
                          <span className="break-all font-mono text-xs text-zinc-300">{link.settledSignature}</span>
                        )}
                      </div>
                    ) : null}
                    {link.payerAddress ? (
                      <div>
                        <span className="text-zinc-500">Payer:</span>{" "}
                        <span className="break-all font-mono text-xs text-zinc-300">{link.payerAddress}</span>
                      </div>
                    ) : null}
                    {link.claimantAddress ? (
                      <div>
                        <span className="text-zinc-500">Claimant:</span>{" "}
                        <span className="break-all font-mono text-xs text-zinc-300">{link.claimantAddress}</span>
                      </div>
                    ) : null}
                  </div>

                  {/* Endpoints */}
                  <div className={cn(dashboardSubPanelClassName, "mt-3 space-y-2 p-4")}>
                    <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Endpoints</p>
                    <div className="space-y-1.5 text-xs">
                      <div>
                        <span className="text-zinc-500">Public URL:</span>{" "}
                        <Link
                          href={`/${link.kind === "payment-request" ? "pay" : "claim"}/${link.slug}`}
                          className="text-emerald-400 hover:underline"
                        >
                          {link.url}
                        </Link>
                      </div>
                      {link.x402Url ? (
                        <div>
                          <span className="text-zinc-500">x402:</span>{" "}
                          <span className="break-all font-mono text-zinc-300">{link.x402Url}</span>
                        </div>
                      ) : null}
                      {link.agentClaimUrl ? (
                        <div>
                          <span className="text-zinc-500">Agent claim:</span>{" "}
                          <span className="break-all font-mono text-zinc-300">{link.agentClaimUrl}</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* Right column — actions */}
                {link.status === "active" ? (
                  <div className="flex-shrink-0 lg:ml-6">
                    <form action={disablePaymentLinkFormAction}>
                      <input type="hidden" name="linkId" value={link.id} />
                      <button
                        type="submit"
                        className="rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-2.5 text-sm font-medium text-red-400 transition-colors hover:border-red-500/50 hover:bg-red-500/20 hover:text-red-300"
                      >
                        Disable link
                      </button>
                    </form>
                  </div>
                ) : null}
              </div>
            </DashboardPanel>
          ))}
        </div>
      )}
    </div>
  );
}
