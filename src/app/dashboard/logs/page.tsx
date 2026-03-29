import { refreshValidationsFormAction } from "@/app/actions";
import { getTreasuryState } from "@/app/lib/server-data";
import {
  DashboardPageHeader,
  DashboardPanel,
  DashboardStatusBadge,
  dashboardButtonSecondaryClassName,
  dashboardSubPanelClassName,
  cn,
} from "@/components/dashboard/primitives";

export default async function AuditLogsPage() {
  const treasury = await getTreasuryState();

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <DashboardPanel className="p-7 sm:p-8">
        <DashboardPageHeader
          eyebrow="Audit ledger"
          title="Operational evidence and policy events"
          description="Treasury actions, policy decisions, and settlement updates sourced from the live Solana devnet workflow."
          actions={
            <form action={refreshValidationsFormAction}>
              <button className={dashboardButtonSecondaryClassName}>Refresh checks</button>
            </form>
          }
        />

        <div className="mt-8 space-y-4">
          {treasury.auditEntries.length ? (
            treasury.auditEntries.map((entry) => (
              <article key={entry.id} className={cn(dashboardSubPanelClassName, "p-5")}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">{entry.action}</p>
                    <h2 className="mt-2 text-xl font-semibold text-white">{entry.details}</h2>
                  </div>
                  <DashboardStatusBadge tone="neutral">v{entry.policyVersion}</DashboardStatusBadge>
                </div>
                <p className="mt-4 text-sm text-zinc-400">
                  Actor: {entry.actor} · {new Date(entry.timestamp).toLocaleString()}
                </p>
                {entry.verdictReasons.length ? (
                  <ul className="mt-4 space-y-2 text-sm text-zinc-400">
                    {entry.verdictReasons.map((reason) => (
                      <li key={`${entry.id}-${reason.code}`}>
                        <strong className="text-zinc-100">{reason.code}</strong>: {reason.description}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))
          ) : (
            <div className={cn(dashboardSubPanelClassName, "p-5 text-sm leading-7 text-zinc-400")}>
              Audit entries appear after bootstrap, counterparty registration, policy updates, and payout actions.
            </div>
          )}
        </div>
      </DashboardPanel>

      <DashboardPanel className="p-7 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">Dependency health</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">Resource validation</h2>
        <p className="mt-3 text-sm leading-7 text-zinc-400">
          These checks confirm the Solana docs, Colosseum resources, SDK Solana spoke, agent SDK Solana spoke, RPC, and relayer endpoints the app depends on.
        </p>

        <div className="mt-6 space-y-4">
          {treasury.validations.map((validation) => (
            <article key={validation.id} className={cn(dashboardSubPanelClassName, "p-5")}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">{validation.label}</h3>
                  <p className="mt-2 break-all text-sm text-zinc-500">{validation.target}</p>
                </div>
                <DashboardStatusBadge tone={validation.status === "healthy" ? "success" : "warning"}>
                  {validation.status}
                </DashboardStatusBadge>
              </div>
              <p className="mt-4 text-sm text-zinc-400">{validation.details}</p>
            </article>
          ))}
        </div>
      </DashboardPanel>
    </div>
  );
}
