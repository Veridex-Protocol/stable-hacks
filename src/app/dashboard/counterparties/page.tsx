import { createCounterpartyFormAction } from "@/app/actions";
import { getTreasuryState } from "@/app/lib/server-data";
import {
  DashboardPageHeader,
  DashboardPanel,
  DashboardStatusBadge,
  dashboardButtonClassName,
  dashboardInputClassName,
  dashboardSelectClassName,
  dashboardSubPanelClassName,
  cn,
} from "@/components/dashboard/primitives";

export default async function CounterpartyRegistryPage() {
  const treasury = await getTreasuryState();

  return (
    <div className="space-y-8">
      <DashboardPanel className="p-7 sm:p-8">
        <DashboardPageHeader
          eyebrow="Counterparties"
          title="Maintain the payout registry"
          description="Register Solana counterparties with corridor rules, live wallet telemetry, and compliance context before submitting treasury payouts."
        />

        <div className="mt-8 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <form action={createCounterpartyFormAction} className={cn(dashboardSubPanelClassName, "p-6")}>
            <h2 className="text-lg font-semibold text-white">Add counterparty</h2>
            <div className="mt-5 space-y-4">
              <input name="name" required className={dashboardInputClassName} placeholder="Acme Vendor Ltd" />
              <div className="grid gap-4 md:grid-cols-2">
                <input name="country" required className={dashboardInputClassName} placeholder="NG" />
                <select name="kycStatus" className={dashboardSelectClassName}>
                  <option value="verified">verified</option>
                  <option value="pending">pending</option>
                  <option value="rejected">rejected</option>
                  <option value="expired">expired</option>
                </select>
              </div>
              <input name="walletAddress" className={dashboardInputClassName} placeholder="Optional Solana address" />
              <input name="approvedCorridors" className={dashboardInputClassName} placeholder="NG-SG, NG-US" />
              <label className="flex items-center gap-3 text-sm text-zinc-400">
                <input type="checkbox" name="generateWallet" className="h-4 w-4 accent-emerald-500" />
                Generate a Solana address if one is not supplied
              </label>
              <label className="flex items-center gap-3 text-sm text-zinc-400">
                <input type="checkbox" name="sanctioned" className="h-4 w-4 accent-emerald-500" />
                Flag as sanctioned
              </label>
            </div>
            <button className={cn(dashboardButtonClassName, "mt-6 w-full")}>Save counterparty</button>
          </form>

          <div className={cn(dashboardSubPanelClassName, "p-6")}>
            <h2 className="text-lg font-semibold text-white">Registered counterparties</h2>
            <div className="mt-5 space-y-4">
              {treasury.counterparties.length ? (
                treasury.counterparties.map((counterparty) => (
                  <article key={counterparty.id} className={cn(dashboardSubPanelClassName, "border-zinc-700 p-5")}>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="text-xl font-semibold text-white">{counterparty.name}</h3>
                        <p className="mt-1 text-sm text-zinc-500">{counterparty.country}</p>
                      </div>
                      <DashboardStatusBadge tone={counterparty.kycStatus === "verified" ? "success" : counterparty.kycStatus === "rejected" ? "danger" : "warning"}>
                        {counterparty.kycStatus}
                      </DashboardStatusBadge>
                    </div>
                    <p className="mt-4 break-all font-mono text-sm text-zinc-200">{counterparty.walletAddress}</p>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <p className="text-sm text-zinc-400">
                        Risk: <span className="font-semibold text-zinc-100">{counterparty.kytRiskLevel}</span>
                      </p>
                      <p className="text-sm text-zinc-400">
                        Corridors:{" "}
                        <span className="font-semibold text-zinc-100">
                          {counterparty.approvedCorridors.join(", ") || "None"}
                        </span>
                      </p>
                    </div>
                  </article>
                ))
              ) : (
                <div className={cn(dashboardSubPanelClassName, "p-5 text-sm leading-7 text-zinc-400")}>
                  No counterparties registered yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </DashboardPanel>
    </div>
  );
}
