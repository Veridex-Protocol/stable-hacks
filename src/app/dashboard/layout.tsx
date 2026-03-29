"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  ChevronLeft,
  FileStack,
  LayoutDashboard,
  Link2,
  Logs,
  Menu,
  Settings,
  ShieldCheck,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { logoutWorkspaceAction } from "@/app/actions";
import { cn } from "@/components/dashboard/primitives";

const NAV_ITEMS = [
  {
    href: "/dashboard",
    label: "Overview",
    description: "Treasury posture and wallet state",
    icon: LayoutDashboard,
  },
  {
    href: "/dashboard/collections",
    label: "Collections",
    description: "Links, invoices, and receipts",
    icon: FileStack,
  },
  {
    href: "/dashboard/collections/links",
    label: "Manage Links",
    description: "View, filter, and disable payment links",
    icon: Link2,
  },
  {
    href: "/dashboard/reviews",
    label: "Payout Queue",
    description: "Submission and approvals",
    icon: ArrowLeftRight,
  },
  {
    href: "/dashboard/counterparties",
    label: "Counterparties",
    description: "Registry and risk controls",
    icon: Users,
  },
  {
    href: "/dashboard/logs",
    label: "Audit Logs",
    description: "Operational events and checks",
    icon: Logs,
  },
  {
    href: "/dashboard/policy",
    label: "Policy",
    description: "Treasury rules and thresholds",
    icon: ShieldCheck,
  },
  {
    href: "/dashboard/settings",
    label: "Settings",
    description: "Workspace and session config",
    icon: Settings,
  },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const currentItem = useMemo(
    () => NAV_ITEMS.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`)) ?? NAV_ITEMS[0],
    [pathname],
  );

  return (
    <div className="dashboard-shell min-h-screen text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_22%),radial-gradient(circle_at_top_right,rgba(34,211,238,0.1),transparent_18%)]" />

      <header className="fixed left-0 right-0 top-0 z-50 flex h-16 items-center justify-between border-b border-zinc-800 bg-zinc-950/90 px-4 backdrop-blur-xl lg:hidden">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileMenuOpen((value) => !value)}
            className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-2 text-zinc-300 transition hover:bg-zinc-800"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <div>
                <p className="text-sm font-semibold gradient-text">Settla</p>
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Solana treasury</p>
          </div>
        </div>
        <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-400">
          Live
        </div>
      </header>

      {mobileMenuOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
        />
      ) : null}

      <aside
        className={cn(
          "fixed left-0 top-0 z-50 flex h-screen flex-col border-r border-zinc-800 bg-gradient-to-b from-zinc-900 to-zinc-950 transition-all duration-300",
          sidebarCollapsed ? "w-20" : "w-72",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-zinc-800 px-4">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 shadow-lg shadow-emerald-500/20">
              <Wallet className="h-5 w-5 text-white" />
            </div>
            {!sidebarCollapsed ? (
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-white">Settla</p>
                <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Solana treasury workspace</p>
              </div>
            ) : null}
          </Link>
          <button
            onClick={() => setSidebarCollapsed((value) => !value)}
            className="hidden rounded-xl border border-zinc-800 bg-zinc-900/70 p-2 text-zinc-400 transition hover:bg-zinc-800 lg:inline-flex"
          >
            <ChevronLeft className={cn("h-4 w-4 transition-transform", sidebarCollapsed && "rotate-180")} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "border border-emerald-500/20 bg-gradient-to-r from-emerald-500/12 to-cyan-500/10 text-white"
                    : "text-zinc-400 hover:bg-zinc-800/70 hover:text-white",
                )}
              >
                <item.icon
                  className={cn(
                    "h-5 w-5 shrink-0",
                    isActive ? "text-emerald-400" : "text-zinc-500 group-hover:text-emerald-400",
                  )}
                />
                {!sidebarCollapsed ? (
                  <div className="min-w-0">
                    <p className="truncate">{item.label}</p>
                    <p className="truncate text-xs text-zinc-500">{item.description}</p>
                  </div>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-zinc-800 p-4">
          {!sidebarCollapsed ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
              <p className="text-sm font-medium text-white">Passkey-native treasury ops</p>
              <p className="mt-2 text-xs leading-6 text-zinc-400">
                Solana balances, x402 collection rails, payout claims, invoices, receipts, and audit checks are all managed from this workspace.
              </p>
            </div>
          ) : null}
          <form action={logoutWorkspaceAction} className="mt-4">
            <button className="inline-flex w-full items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800">
              Log out
            </button>
          </form>
        </div>
      </aside>

      <main
        className={cn(
          "relative min-h-screen transition-all duration-300",
          "pt-16 lg:pt-0",
          sidebarCollapsed ? "lg:ml-20" : "lg:ml-72",
        )}
      >
        <div className="sticky top-0 z-30 hidden border-b border-zinc-800 bg-zinc-950/75 backdrop-blur-xl lg:block">
          <div className="flex items-center justify-between px-8 py-5">
            <div>
              <p className="text-lg font-semibold text-white">{currentItem.label}</p>
              <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">{currentItem.description}</p>
            </div>
            <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-400">
              Solana devnet live state
            </div>
          </div>
        </div>
        <div className="relative px-4 pb-12 pt-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
