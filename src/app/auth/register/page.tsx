import Link from "next/link";
import { ArrowLeft, ExternalLink, Fingerprint, ShieldCheck } from "lucide-react";
import {
  getVeridexAppUrl,
  getVeridexAuthPortalUrl,
  getWorkspaceRegistrationReturnPath,
  isPortalPasskeyRegistrationEnabled,
} from "@/lib/veridex-auth";
import {
  cn,
  dashboardButtonClassName,
  dashboardButtonSecondaryClassName,
  dashboardPanelClassName,
  dashboardSubPanelClassName,
} from "@/components/dashboard/primitives";

export default async function AuthRegisterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const username =
    typeof params.username === "string" ? params.username : Array.isArray(params.username) ? params.username[0] || "" : "";
  const displayName =
    typeof params.displayName === "string"
      ? params.displayName
      : Array.isArray(params.displayName)
        ? params.displayName[0] || ""
        : "";
  const returnTo =
    typeof params.returnTo === "string"
      ? params.returnTo
      : Array.isArray(params.returnTo)
        ? params.returnTo[0] || getWorkspaceRegistrationReturnPath()
        : getWorkspaceRegistrationReturnPath();

  const reconnectParams = new URLSearchParams();
  reconnectParams.set("mode", "signin");
  reconnectParams.set("rail", "veridex");
  reconnectParams.set("registered", "1");

  if (username.trim()) {
    reconnectParams.set("username", username.trim());
  }

  if (displayName.trim()) {
    reconnectParams.set("displayName", displayName.trim());
  }

  const reconnectPath = `/auth?${reconnectParams.toString()}`;
  const portalRegistrationEnabled = isPortalPasskeyRegistrationEnabled();
  const appOrigin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const hostedRegistrationUrl = new URL("/auth", getVeridexAuthPortalUrl());
  hostedRegistrationUrl.searchParams.set("register", "true");
  hostedRegistrationUrl.searchParams.set("origin", appOrigin);
  hostedRegistrationUrl.searchParams.set("redirect_uri", `${appOrigin}${returnTo}`);

  if (username.trim()) {
    hostedRegistrationUrl.searchParams.set("username", username.trim());
  }

  if (displayName.trim()) {
    hostedRegistrationUrl.searchParams.set("display_name", displayName.trim());
  }

  return (
    <div className="dashboard-shell min-h-screen bg-background px-6 py-10 text-on-background">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <Link href={reconnectPath} className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200">
          <ArrowLeft className="h-4 w-4" />
          Back to workspace sign-in
        </Link>

        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <section className={cn(dashboardPanelClassName, "p-8")}>
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">
              Registration prerequisite
            </span>
            <h1 className="mt-6 font-headline text-4xl font-bold tracking-tight text-white">
              First-time Veridex passkey creation happens on a Veridex-owned origin.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-400">
              StableHacks now treats registration conservatively on purpose. We do not attempt to fabricate
              cross-origin passkey creation from localhost or an unverified third-party origin. Instead, you
              create the credential where Veridex owns the RP, then return here and reconnect the workspace.
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <article className={cn(dashboardSubPanelClassName, "p-5")}>
                <span className="text-[11px] uppercase tracking-[0.2em] text-emerald-400">1</span>
                <h2 className="mt-3 font-headline text-lg font-bold">Open Veridex</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  Start from a Veridex-owned origin so the passkey is created under the supported RP.
                </p>
              </article>
              <article className={cn(dashboardSubPanelClassName, "p-5")}>
                <span className="text-[11px] uppercase tracking-[0.2em] text-emerald-400">2</span>
                <h2 className="mt-3 font-headline text-lg font-bold">Create the passkey</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  Use the same handle and display identity you want to operate the Solana treasury with.
                </p>
              </article>
              <article className={cn(dashboardSubPanelClassName, "p-5")}>
                <span className="text-[11px] uppercase tracking-[0.2em] text-emerald-400">3</span>
                <h2 className="mt-3 font-headline text-lg font-bold">Return and reconnect</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  Come back to StableHacks and mint the relayer-backed Auth Session inside the workspace flow.
                </p>
              </article>
            </div>

            {(username || displayName) ? (
              <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5 text-sm text-zinc-300">
                <div className="flex items-start gap-3">
                  <Fingerprint className="mt-0.5 h-5 w-5 text-emerald-300" />
                  <div>
                    <p className="font-semibold text-white">Suggested registration identity</p>
                    <p className="mt-2">
                      Handle: <span className="font-mono text-emerald-300">{username || "not provided"}</span>
                    </p>
                    <p className="mt-1">
                      Display name: <span className="text-zinc-100">{displayName || "StableHacks Treasury"}</span>
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
          </section>

          <section className={cn(dashboardPanelClassName, "p-8")}>
            <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4 text-sm leading-6 text-cyan-100">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-semibold">Docs-first behavior</p>
                  <p className="mt-1">
                    The default path follows public Veridex guidance: register the passkey on{" "}
                    <span className="font-mono">veridex.network</span>, then reconnect from this workspace.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-3">
              <Link
                href={getVeridexAppUrl()}
                target="_blank"
                className={cn(dashboardButtonClassName, "w-full gap-3")}
              >
                <ExternalLink className="h-4 w-4" />
                Open Veridex to create the passkey
              </Link>

              {portalRegistrationEnabled ? (
                <Link
                  href={hostedRegistrationUrl.toString()}
                  className={cn(dashboardButtonSecondaryClassName, "w-full gap-3")}
                >
                  <ExternalLink className="h-4 w-4" />
                  Use hosted registration beta
                </Link>
              ) : (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-100">
                  Hosted portal registration remains behind
                  <span className="mx-1 font-mono">NEXT_PUBLIC_ENABLE_PORTAL_PASSKEY_REGISTRATION=true</span>
                  until you explicitly opt into it.
                </div>
              )}

              <Link href={reconnectPath} className={cn(dashboardButtonSecondaryClassName, "w-full gap-3")}>
                Return and reconnect the workspace
              </Link>
            </div>

            <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5 text-sm leading-7 text-zinc-400">
              After the passkey exists, the reconnect flow on{" "}
              <span className="font-mono text-zinc-200">/auth</span>{" "}
              will validate the origin, create a relayer-backed Auth Session, and send you into the Solana dashboard.
            </div>

            <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950/50 p-5 text-sm leading-7 text-zinc-400">
              Need something that works entirely on localhost? Return to{" "}
              <span className="font-mono text-zinc-200">/auth</span> and switch to the local wallet rail to create a real device-scoped passkey wallet directly in the app.
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
