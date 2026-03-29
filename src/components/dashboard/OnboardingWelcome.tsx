"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Coins, Rocket, Shield, Wallet, X } from "lucide-react";
import { cn, dashboardPanelClassName, dashboardSubPanelClassName } from "@/components/dashboard/primitives";

const STEPS = [
  {
    icon: Wallet,
    title: "Wallet connected",
    description: "Your passkey credential created a Solana wallet. Copy your address from the dashboard overview.",
    done: true,
  },
  {
    icon: Rocket,
    title: "Bootstrap the treasury",
    description: "Hit the Bootstrap button on the Overview page to initialize treasury identities, policy controls, and the managed stable asset.",
    done: false,
    action: { label: "Go to Overview", href: "/dashboard" },
  },
  {
    icon: Coins,
    title: "Fund your wallet",
    description: "Request a devnet SOL airdrop for transaction fees, then seed stablecoin liquidity into your wallet.",
    done: false,
    action: { label: "Go to Overview", href: "/dashboard" },
  },
  {
    icon: Shield,
    title: "Create your first payment link",
    description: "Head to Collections to create an x402 payment link, payout claim, or invoice.",
    done: false,
    action: { label: "Open Collections", href: "/dashboard/collections" },
  },
];

const DISMISS_KEY = "settla_onboarding_dismissed";

export function OnboardingWelcome({
  displayName,
  isBootstrapped,
  hasAssets,
  hasLinks,
}: {
  displayName: string;
  isBootstrapped: boolean;
  hasAssets: boolean;
  hasLinks: boolean;
}) {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(DISMISS_KEY) === "true";
  });

  if (dismissed) return null;

  const steps = STEPS.map((step, i) => {
    if (i === 0) return { ...step, done: true };
    if (i === 1) return { ...step, done: isBootstrapped };
    if (i === 2) return { ...step, done: hasAssets };
    if (i === 3) return { ...step, done: hasLinks };
    return step;
  });

  const completedCount = steps.filter((s) => s.done).length;
  const allDone = completedCount === steps.length;

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, "true");
    setDismissed(true);
  }

  return (
    <div className={cn(dashboardPanelClassName, "relative p-7 sm:p-8 mb-8 border-emerald-500/20 bg-gradient-to-br from-zinc-900 via-zinc-900 to-emerald-950/20")}>
      <button
        onClick={handleDismiss}
        className="absolute right-4 top-4 rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-center gap-3 mb-2">
        <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-400">
          Getting started
        </span>
        <span className="text-xs text-zinc-500">{completedCount}/{steps.length} complete</span>
      </div>

      <h2 className="mt-4 text-2xl font-semibold tracking-tight text-white">
        Welcome to Settla{displayName ? `, ${displayName}` : ""}
      </h2>
      <p className="mt-2 text-sm leading-7 text-zinc-400">
        {allDone
          ? "You're all set! Your treasury workspace is fully operational."
          : "Complete these steps to start receiving payments and managing your Solana treasury."}
      </p>

      {/* Progress bar */}
      <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-500"
          style={{ width: `${(completedCount / steps.length) * 100}%` }}
        />
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {steps.map((step, i) => (
          <div
            key={i}
            className={cn(
              dashboardSubPanelClassName,
              "p-4 transition-all",
              step.done && "border-emerald-500/20 bg-emerald-500/5",
            )}
          >
            <div className="flex items-center gap-2 mb-3">
              {step.done ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              ) : (
                <step.icon className="h-5 w-5 text-zinc-500" />
              )}
              <span className={cn("text-sm font-semibold", step.done ? "text-emerald-400" : "text-white")}>
                {step.title}
              </span>
            </div>
            <p className="text-xs leading-5 text-zinc-400">{step.description}</p>
            {!step.done && step.action && (
              <Link
                href={step.action.href}
                className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition"
              >
                {step.action.label} <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        ))}
      </div>

      {allDone && (
        <button
          onClick={handleDismiss}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-emerald-500 active:scale-95"
        >
          Dismiss and get started
        </button>
      )}
    </div>
  );
}
