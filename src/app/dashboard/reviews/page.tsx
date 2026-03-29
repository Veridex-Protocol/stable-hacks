import {
  approvePayoutFormAction,
  rejectPayoutFormAction,
  submitPayoutFormAction,
} from "@/app/actions";
import { getTreasuryState } from "@/app/lib/server-data";
import {
  DashboardPageHeader,
  DashboardPanel,
  DashboardStatusBadge,
  dashboardButtonClassName,
  dashboardButtonDangerClassName,
  dashboardInputClassName,
  dashboardSelectClassName,
  dashboardSubPanelClassName,
  dashboardTextareaClassName,
  cn,
} from "@/components/dashboard/primitives";

export default async function ReviewsPage() {
  const treasury = await getTreasuryState();

  return (
    <div className="space-y-8">
      <DashboardPanel className="p-7 sm:p-8">
        <DashboardPageHeader
          eyebrow="Payout queue"
          title="Review treasury disbursements"
          description="Submit treasury payouts against registered counterparties, then approve or reject queue items against the live policy engine."
        />

        <div className="mt-8 grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
          <form action={submitPayoutFormAction} className={cn(dashboardSubPanelClassName, "p-6")}>
            <h2 className="text-lg font-semibold text-white">Submit payout</h2>
            <div className="mt-5 space-y-4">
              <select name="counterpartyId" required className={dashboardSelectClassName}>
                <option value="">Select counterparty</option>
                {treasury.counterparties.map((counterparty) => (
                  <option key={counterparty.id} value={counterparty.id}>
                    {counterparty.name}
                  </option>
                ))}
              </select>
              <input name="amount" required type="number" min="0.01" step="0.01" className={dashboardInputClassName} placeholder="1000.00" />
              <input name="corridor" required className={dashboardInputClassName} placeholder="NG-SG" />
              <textarea name="memo" required className={dashboardTextareaClassName} placeholder="Why this payout should be sent" />
            </div>
            <button className={cn(dashboardButtonClassName, "mt-6 w-full")}>Queue payout</button>
          </form>

          <div className={cn(dashboardSubPanelClassName, "p-6")}>
            <h2 className="text-lg font-semibold text-white">Pending reviews</h2>
            <div className="mt-5 space-y-4">
              {treasury.payouts.length ? (
                treasury.payouts.map((payout) => (
                  <article key={payout.id} className={cn(dashboardSubPanelClassName, "border-zinc-700 p-5")}>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">{payout.status}</p>
                        <h3 className="mt-2 text-xl font-semibold text-white">{payout.counterpartyName}</h3>
                        <p className="mt-2 text-sm text-zinc-500">
                          {payout.amount.toLocaleString()} · {payout.corridor}
                        </p>
                      </div>
                      <DashboardStatusBadge tone={payout.verdict === "approved" ? "success" : payout.verdict === "blocked" ? "danger" : "warning"}>
                        {payout.verdict || "pending"}
                      </DashboardStatusBadge>
                    </div>

                    <p className="mt-4 text-sm leading-7 text-zinc-400">{payout.memo}</p>

                    {payout.verdictReasons.length ? (
                      <ul className="mt-4 space-y-2 text-sm text-zinc-400">
                        {payout.verdictReasons.map((reason) => (
                          <li key={`${payout.id}-${reason.code}`}>
                            <strong className="text-zinc-100">{reason.code}</strong>: {reason.description}
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    {payout.status === "pending" || payout.status === "escalated" ? (
                      <div className="mt-5 grid gap-3 md:grid-cols-2">
                        <form action={approvePayoutFormAction} className="space-y-3">
                          <input type="hidden" name="payoutId" value={payout.id} />
                          <input name="approvalNote" className={dashboardInputClassName} placeholder="Approval note" />
                          <button className={cn(dashboardButtonClassName, "w-full")}>Approve</button>
                        </form>
                        <form action={rejectPayoutFormAction} className="space-y-3">
                          <input type="hidden" name="payoutId" value={payout.id} />
                          <input name="approvalNote" className={dashboardInputClassName} placeholder="Rejection note" />
                          <button className={cn(dashboardButtonDangerClassName, "w-full")}>Reject</button>
                        </form>
                      </div>
                    ) : null}
                  </article>
                ))
              ) : (
                <div className={cn(dashboardSubPanelClassName, "p-5 text-sm leading-7 text-zinc-400")}>
                  No payouts have been queued yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </DashboardPanel>
    </div>
  );
}
