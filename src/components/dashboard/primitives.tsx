import Link from "next/link";
import { twMerge } from "tailwind-merge";
import { clsx } from "clsx";

export function cn(...inputs: Array<string | false | null | undefined>) {
  return twMerge(clsx(inputs));
}

export const dashboardPanelClassName =
  "rounded-2xl border border-slate-800 bg-slate-900/80 shadow-2xl backdrop-blur-xl transition-all duration-300";

export const dashboardSubPanelClassName =
  "rounded-xl border border-slate-800 bg-slate-950/60 backdrop-blur-lg hover:border-slate-700 transition-colors";

export const dashboardInputClassName =
  "w-full rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm text-slate-100 outline-none transition-all placeholder:text-slate-500 focus:border-teal-500/50 focus:ring-2 focus:ring-teal-500/20";

export const dashboardSelectClassName = dashboardInputClassName;

export const dashboardTextareaClassName =
  "min-h-24 w-full rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm text-slate-100 outline-none transition-all placeholder:text-slate-500 focus:border-teal-500/50 focus:ring-2 focus:ring-teal-500/20";

export const dashboardButtonClassName =
  "inline-flex items-center justify-center rounded-xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-teal-500 hover:shadow-[0_0_20px_rgba(13,148,136,0.4)] active:scale-[0.98]";

export const dashboardButtonSecondaryClassName =
  "inline-flex items-center justify-center rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm font-semibold text-slate-200 transition-all hover:border-slate-600 hover:bg-slate-800 active:scale-[0.98]";

export const dashboardButtonDangerClassName =
  "inline-flex items-center justify-center rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm font-semibold text-red-400 transition-all hover:bg-red-900/40 hover:border-red-800/50";

export function DashboardPanel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <section className={cn(dashboardPanelClassName, className)}>{children}</section>;
}

export function DashboardPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
      <div className="max-w-3xl">
        <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-400">
          {eyebrow}
        </span>
        <h1 className="mt-5 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{title}</h1>
        <p className="mt-4 text-sm leading-7 text-zinc-400 sm:text-base">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  );
}

export function DashboardMetricCard({
  label,
  value,
  meta,
}: {
  label: string;
  value: string;
  meta: string;
}) {
  return (
    <article className={cn(dashboardSubPanelClassName, "p-5")}>
      <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">{label}</p>
      <p className="mt-4 text-2xl font-semibold tracking-tight text-white">{value}</p>
      <p className="mt-2 text-sm leading-6 text-zinc-400">{meta}</p>
    </article>
  );
}

export function DashboardStatusBadge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]",
        tone === "success" && "bg-emerald-500/10 text-emerald-400",
        tone === "warning" && "bg-amber-500/10 text-amber-300",
        tone === "danger" && "bg-red-500/10 text-red-300",
        tone === "neutral" && "bg-zinc-800 text-zinc-300",
      )}
    >
      {children}
    </span>
  );
}

export function DashboardEmptyState({
  title,
  description,
  ctaHref,
  ctaLabel,
}: {
  title: string;
  description: string;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  return (
    <div className={cn(dashboardPanelClassName, "p-8 sm:p-10")}>
      <h1 className="text-3xl font-semibold tracking-tight text-white">{title}</h1>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-400 sm:text-base">{description}</p>
      {ctaHref && ctaLabel ? (
        <Link href={ctaHref} className={cn(dashboardButtonClassName, "mt-8")}>
          {ctaLabel}
        </Link>
      ) : null}
    </div>
  );
}
