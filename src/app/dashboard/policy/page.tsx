import { bootstrapTreasuryFormAction, refreshValidationsFormAction } from "@/app/actions";
import { getTreasuryState } from "@/app/lib/server-data";
import { ErrorBanner } from "@/components/dashboard/ErrorBanner";
import {
  DashboardPageHeader,
  DashboardPanel,
  DashboardStatusBadge,
  dashboardButtonClassName,
  dashboardButtonSecondaryClassName,
  dashboardSubPanelClassName,
  cn,
} from "@/components/dashboard/primitives";

export default async function PolicyWorkspace({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; bootstrapped?: string }>;
}) {
  const params = await searchParams;
  const treasury = await getTreasuryState();
  const policy = treasury.policy;

  return (
    <div className="space-y-8">
      {params.error ? <ErrorBanner message={params.error} /> : null}
      {params.bootstrapped ? (
        <ErrorBanner
          tone="success"
          message="Treasury vault initialized successfully. Policy controls and treasury actors are now ready."
        />
      ) : null}
      <DashboardPanel className="p-7 sm:p-8">
        <DashboardPageHeader
          eyebrow="Policy workspace"
          title="Review treasury controls"
          description="Inspect the current approval policy, stable asset allowlist, and Solana corridor controls driving payout decisions."
          actions={
            <>
              <form action={refreshValidationsFormAction}>
                <button className={dashboardButtonSecondaryClassName}>Refresh checks</button>
              </form>
              {!policy ? (
                <form action={bootstrapTreasuryFormAction}>
                  <input type="hidden" name="returnTo" value="/dashboard/policy" />
                  <button className={dashboardButtonClassName}>Initialize treasury vault</button>
                </form>
              ) : null}
            </>
          }
        />

        {policy ? (
          <div className="mt-8 grid gap-6 xl:grid-cols-2">
            <div className="space-y-6">
              <article className={cn(dashboardSubPanelClassName, "p-6")}>
                <h2 className="text-lg font-semibold text-white">Thresholds</h2>
                <dl className="mt-5 space-y-3 text-sm">
                  <div className="flex justify-between gap-6">
                    <dt className="text-zinc-500">Max transaction</dt>
                    <dd className="text-zinc-100">{policy.maxTransactionAmount.toLocaleString()} USD</dd>
                  </div>
                  <div className="flex justify-between gap-6">
                    <dt className="text-zinc-500">Daily limit</dt>
                    <dd className="text-zinc-100">{policy.dailySendLimit.toLocaleString()} USD</dd>
                  </div>
                  <div className="flex justify-between gap-6">
                    <dt className="text-zinc-500">Escalation threshold</dt>
                    <dd className="text-zinc-100">{policy.escalationThreshold.toLocaleString()} USD</dd>
                  </div>
                  <div className="flex justify-between gap-6">
                    <dt className="text-zinc-500">Travel Rule threshold</dt>
                    <dd className="text-zinc-100">{policy.travelRuleThreshold.toLocaleString()} USD</dd>
                  </div>
                </dl>
              </article>

              <article className={cn(dashboardSubPanelClassName, "p-6")}>
                <h2 className="text-lg font-semibold text-white">Allowed assets</h2>
                <div className="mt-5 space-y-3">
                  {policy.allowedAssets.map((asset) => (
                    <p key={asset} className="rounded-2xl border border-zinc-800 bg-zinc-950/80 px-4 py-3 font-mono text-sm text-zinc-200">
                      {asset}
                    </p>
                  ))}
                </div>
              </article>
            </div>

            <div className="space-y-6">
              <article className={cn(dashboardSubPanelClassName, "p-6")}>
                <h2 className="text-lg font-semibold text-white">Corridors</h2>
                <div className="mt-5 flex flex-wrap gap-3">
                  {policy.allowedCorridors.map((corridor) => (
                    <DashboardStatusBadge key={corridor} tone="neutral">
                      {corridor}
                    </DashboardStatusBadge>
                  ))}
                </div>
              </article>

              <article className={cn(dashboardSubPanelClassName, "p-6")}>
                <h2 className="text-lg font-semibold text-white">Enforcement</h2>
                <p className="mt-4 text-sm leading-7 text-zinc-400">
                  Travel Rule required: <strong className="text-zinc-100">{policy.requireTravelRule ? "yes" : "no"}</strong>
                </p>
                <p className="mt-3 text-sm leading-7 text-zinc-400">
                  Policy version <strong className="text-zinc-100">{policy.version}</strong> controls payout review, escalation, and Solana settlement eligibility.
                </p>
              </article>

              <article className={cn(dashboardSubPanelClassName, "p-6")}>
                <h2 className="text-lg font-semibold text-white">Validation snapshot</h2>
                <p className="mt-4 text-sm leading-7 text-zinc-400">
                  {treasury.validations.filter((validation) => validation.status === "healthy").length} of{" "}
                  {treasury.validations.length} dependencies are currently healthy.
                </p>
              </article>
            </div>
          </div>
        ) : (
          <div className={cn(dashboardSubPanelClassName, "mt-8 p-6 text-sm leading-7 text-zinc-400")}>
            The treasury has not been bootstrapped yet, so no policy exists. Bootstrap from Overview or here to create the live Solana treasury identities and default approval policy.
          </div>
        )}
      </DashboardPanel>
    </div>
  );
}
