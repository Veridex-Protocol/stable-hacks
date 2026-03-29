import { getTreasuryState, getWorkspaceStateOrNull } from "@/app/lib/server-data";
import {
  logoutWorkspaceAction,
  refreshAssetsFormAction,
  refreshValidationsFormAction,
} from "@/app/actions";
import {
  DashboardEmptyState,
  DashboardPageHeader,
  DashboardPanel,
  DashboardStatusBadge,
  dashboardButtonClassName,
  dashboardButtonDangerClassName,
  dashboardButtonSecondaryClassName,
  dashboardSubPanelClassName,
  cn,
} from "@/components/dashboard/primitives";
import { WalletCard } from "@/components/dashboard/WalletCard";

export default async function SettingsPage() {
  const [workspace, treasury] = await Promise.all([getWorkspaceStateOrNull(), getTreasuryState()]);

  if (!workspace) {
    return (
      <DashboardEmptyState
        title="No workspace connected"
        description="Connect a passkey wallet to access workspace settings."
        ctaHref="/auth"
        ctaLabel="Connect wallet"
      />
    );
  }

  const authSession = workspace.authSession;

  return (
    <div className="space-y-8">
      <DashboardPanel className="p-7 sm:p-8">
        <DashboardPageHeader
          eyebrow="Settings"
          title="Workspace configuration"
          description="Manage your operator identity, wallet credentials, session state, and workspace preferences."
        />
      </DashboardPanel>

      {/* Profile & identity */}
      <DashboardPanel className="p-7 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">Operator identity</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">{workspace.profile.displayName}</h2>
        <p className="mt-2 text-sm text-zinc-400">@{workspace.profile.username}</p>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className={cn(dashboardSubPanelClassName, "p-5")}>
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Credential ID</p>
            <p className="mt-4 break-all font-mono text-xs text-zinc-300">{workspace.profile.credentialId}</p>
          </div>
          <div className={cn(dashboardSubPanelClassName, "p-5")}>
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Key hash</p>
            <p className="mt-4 break-all font-mono text-xs text-zinc-300">{workspace.profile.keyHash}</p>
          </div>
        </div>
      </DashboardPanel>

      {/* Wallet */}
      <DashboardPanel className="p-7 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">Wallet</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">Solana wallet</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Your wallet address is deterministically derived from your passkey credential.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <WalletCard
            address={workspace.profile.walletAddress}
            explorerUrl={treasury.summary.explorerAddressUrl || undefined}
          />
          <div className={cn(dashboardSubPanelClassName, "p-5")}>
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Network</p>
            <p className="mt-4 text-2xl font-semibold tracking-tight text-white">Devnet</p>
            <p className="mt-2 text-sm leading-6 text-zinc-400">Solana devnet cluster</p>
          </div>
        </div>
      </DashboardPanel>

      {/* Session */}
      <DashboardPanel className="p-7 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">Session</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">Auth session</h2>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className={cn(dashboardSubPanelClassName, "p-5")}>
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Status</p>
            <div className="mt-4">
              <DashboardStatusBadge tone={authSession?.status === "active" ? "success" : "warning"}>
                {authSession?.status ?? "No session"}
              </DashboardStatusBadge>
            </div>
          </div>
          <div className={cn(dashboardSubPanelClassName, "p-5")}>
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Source</p>
            <p className="mt-4 text-lg font-semibold text-white">
              {authSession?.source === "local" ? "Local device" : authSession?.source === "veridex" ? "Veridex relay" : "None"}
            </p>
          </div>
          <div className={cn(dashboardSubPanelClassName, "p-5")}>
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Expires</p>
            <p className="mt-4 text-sm text-zinc-300">
              {authSession?.expiresAt ? new Date(authSession.expiresAt).toLocaleString() : "N/A"}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <form action={refreshAssetsFormAction}>
            <button className={dashboardButtonSecondaryClassName}>Refresh assets</button>
          </form>
          <form action={refreshValidationsFormAction}>
            <button className={dashboardButtonSecondaryClassName}>Refresh checks</button>
          </form>
        </div>
      </DashboardPanel>

      {/* Danger zone */}
      <DashboardPanel className="p-7 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-400">Danger zone</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">Disconnect workspace</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Logging out clears the workspace session cookies. Your passkey and on-chain data are not affected.
        </p>
        <form action={logoutWorkspaceAction} className="mt-6">
          <button className={dashboardButtonDangerClassName}>Log out and disconnect</button>
        </form>
      </DashboardPanel>
    </div>
  );
}
