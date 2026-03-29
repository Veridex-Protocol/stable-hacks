"use client";

import { Suspense, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Fingerprint,
  KeyRound,
  Loader2,
  MonitorUp,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { connectWorkspaceAction } from "@/app/actions";
import {
  getAuthRelayPath,
  getVeridexAuthPortalUrl,
  getWorkspaceRegistrationReturnPath,
} from "@/lib/veridex-auth";
import {
  reconnectLocalPasskeyWallet,
  registerLocalPasskeyWallet,
  type LocalWorkspaceSession,
} from "@/lib/local-passkey-wallet";
import {
  cn,
  dashboardButtonClassName,
  dashboardButtonSecondaryClassName,
  dashboardInputClassName,
  dashboardPanelClassName,
  dashboardSubPanelClassName,
} from "@/components/dashboard/primitives";

type ConnectionMode = "popup" | "redirect";
type AuthRail = "local" | "veridex";

interface BrowserPasskeyCredential {
  credentialId: string;
  publicKeyX: bigint | string;
  publicKeyY: bigint | string;
  keyHash: string;
}

interface BrowserAuthSignature {
  authenticatorData: string;
  clientDataJSON: string;
  challengeIndex: number;
  typeIndex: number;
  r: bigint | string;
  s: bigint | string;
}

interface BrowserCrossOriginSession {
  address: string;
  sessionPublicKey: string;
  expiresAt: number;
  signature: BrowserAuthSignature;
  credential: BrowserPasskeyCredential;
  serverSessionId?: string;
}

interface NormalizedPasskeyCredential extends Omit<BrowserPasskeyCredential, "publicKeyX" | "publicKeyY"> {
  publicKeyX: bigint;
  publicKeyY: bigint;
}

interface NormalizedAuthSignature extends Omit<BrowserAuthSignature, "r" | "s"> {
  r: bigint;
  s: bigint;
}

interface NormalizedCrossOriginSession extends Omit<BrowserCrossOriginSession, "signature" | "credential"> {
  signature: NormalizedAuthSignature;
  credential: NormalizedPasskeyCredential;
}

interface ServerSessionToken {
  id: string;
  keyHash: string;
  appOrigin: string;
  permissions: string[];
  expiresAt: number;
  createdAt: number;
}

type WorkspaceSessionToken = ServerSessionToken | LocalWorkspaceSession;

interface OriginValidationPayload {
  allowed?: boolean;
  valid?: boolean;
  authorized?: boolean;
  app?: { name?: string; status?: string };
  error?: string;
}

const AUTH_SESSION_OPTIONS = {
  permissions: [
    "treasury:read",
    "wallet:fund",
    "assets:refresh",
    "payments:manage",
    "claims:manage",
    "receipts:read",
  ],
  expiresInMs: 12 * 60 * 60 * 1000,
};

async function getCrossOriginAuthToolkit() {
  const { createCrossOriginAuth } = await import("@veridex/sdk");
  return { createCrossOriginAuth };
}

function toSerializedCredential(credential: BrowserPasskeyCredential) {
  return {
    credentialId: credential.credentialId,
    publicKeyX: credential.publicKeyX.toString(),
    publicKeyY: credential.publicKeyY.toString(),
    keyHash: credential.keyHash,
  };
}

function normalizeCrossOriginSession(session: BrowserCrossOriginSession): NormalizedCrossOriginSession {
  return {
    ...session,
    credential: {
      ...session.credential,
      publicKeyX:
        typeof session.credential.publicKeyX === "bigint"
          ? session.credential.publicKeyX
          : BigInt(session.credential.publicKeyX),
      publicKeyY:
        typeof session.credential.publicKeyY === "bigint"
          ? session.credential.publicKeyY
          : BigInt(session.credential.publicKeyY),
    },
    signature: {
      ...session.signature,
      r: typeof session.signature.r === "bigint" ? session.signature.r : BigInt(session.signature.r),
      s: typeof session.signature.s === "bigint" ? session.signature.s : BigInt(session.signature.s),
    },
  };
}

function buildRedirectUri(handle: string, displayName: string): string {
  const url = new URL(window.location.href);
  url.pathname = "/auth";
  url.searchParams.set("mode", "signin");
  url.searchParams.set("rail", "veridex");

  if (handle.trim()) {
    url.searchParams.set("username", handle.trim());
  }

  if (displayName.trim()) {
    url.searchParams.set("displayName", displayName.trim());
  }

  return url.toString();
}

function buildRegistrationPath(handle: string, displayName: string): string {
  const params = new URLSearchParams();

  if (handle.trim()) {
    params.set("username", handle.trim());
  }

  if (displayName.trim()) {
    params.set("displayName", displayName.trim());
  }

  params.set("returnTo", getWorkspaceRegistrationReturnPath());

  return `/auth/register?${params.toString()}`;
}

function getRelayBaseUrl(): string {
  return `${window.location.origin}${getAuthRelayPath()}`;
}

function formatAuthError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Passkey authentication failed.";

  if (message.includes("Credential not found") || message.includes("InvalidStateError")) {
    return "No Veridex passkey could be resolved for this workspace. Create the passkey on veridex.network first, then return here and reconnect.";
  }

  if (message.includes("Origin not registered") || message.includes("Origin not authorized")) {
    return "This origin is not registered with the Veridex relayer. Add it in developers.veridex.network before attempting sign-in.";
  }

  if (message.includes("Failed to open auth popup")) {
    return "Popup authentication was blocked by the browser. Switch to redirect fallback or allow popups for this site.";
  }

  if (
    message === "Not found" ||
    message.includes("Failed to create server session: 404") ||
    message.includes("Failed to issue server session challenge: 404")
  ) {
    return "The configured relayer is reachable but does not expose the Auth Session API. Update VERIDEX_RELAYER_API_URL to the live Veridex session relayer before reconnecting.";
  }

  if (message.includes("Authentication timed out")) {
    return "The Veridex auth window timed out before completion. Retry the sign-in flow and approve the browser prompt.";
  }

  if (message.includes("Invalid auth state")) {
    return "The redirect auth session expired or was interrupted. Start the reconnect flow again to mint a fresh Auth Session.";
  }

  return message;
}

function formatLocalWalletError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Local passkey authentication failed.";

  if (message.includes("Credential not found")) {
    return "This local passkey could not be recovered from the current device. Recreate the local wallet here, or use the Veridex reconnect rail for a portable operator identity.";
  }

  if (message.includes("cancelled") || message.includes("NotAllowedError")) {
    return "The browser prompt was cancelled before the local passkey wallet could be confirmed.";
  }

  if (message.includes("WebAuthn is not supported")) {
    return "This browser does not support passkeys for the local wallet flow.";
  }

  return message;
}

function AuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectHandled = useRef(false);
  const initialAuthRail = searchParams.get("rail") === "veridex" ? "veridex" : "local";
  const [username, setUsername] = useState(searchParams.get("username") || "");
  const [displayName, setDisplayName] = useState(searchParams.get("displayName") || "");
  const [authRail, setAuthRail] = useState<AuthRail>(initialAuthRail);
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>("popup");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(
    searchParams.get("registered") === "1"
      ? "Passkey registration should now be complete. Reconnect here to mint the workspace Auth Session."
      : null,
  );
  const [originStatus, setOriginStatus] = useState<{
    loading: boolean;
    allowed: boolean;
    summary: string;
    detail: string;
  }>({
    loading: true,
    allowed: false,
    summary: "Checking origin registration",
    detail: "Validating this workspace origin against the Veridex relayer.",
  });
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const nextHandle = searchParams.get("username");
    const nextDisplayName = searchParams.get("displayName");
    const nextRail = searchParams.get("rail");

    if (nextHandle) {
      setUsername(nextHandle);
    }

    if (nextDisplayName) {
      setDisplayName(nextDisplayName);
    }

    if (nextRail === "local" || nextRail === "veridex") {
      setAuthRail(nextRail);
    }
  }, [searchParams]);

  const resolvedDisplayName = useMemo(
    () => displayName.trim() || `${username.trim() || "StableHacks"} Treasury`,
    [displayName, username],
  );

  async function refreshOriginStatus(): Promise<boolean> {
    setOriginStatus({
      loading: true,
      allowed: false,
      summary: "Checking origin registration",
      detail: "Validating this workspace origin against the Veridex relayer.",
    });

    try {
      const response = await fetch(
        `/api/auth/origin/validate?origin=${encodeURIComponent(window.location.origin)}`,
        {
          cache: "no-store",
        },
      );

      const payload = (await response.json().catch(() => null)) as OriginValidationPayload | null;
      const allowed = Boolean(payload?.allowed ?? payload?.valid ?? payload?.authorized);

      if (allowed) {
        setOriginStatus({
          loading: false,
          allowed: true,
          summary: "Origin registered",
          detail:
            payload?.app?.name
              ? `${payload.app.name} is allowed to mint relayer-backed Auth Sessions from this origin.`
              : "This origin is authorized to create Veridex Auth Sessions.",
        });
        return true;
      }

      setOriginStatus({
        loading: false,
        allowed: false,
        summary: "Origin registration required",
        detail:
          payload?.error ||
          "Register this origin at developers.veridex.network before attempting reconnect.",
      });
      return false;
    } catch (validationError) {
      setOriginStatus({
        loading: false,
        allowed: false,
        summary: "Origin validation failed",
        detail:
          validationError instanceof Error
            ? validationError.message
            : "The relayer origin validation check could not be completed.",
      });
      return false;
    }
  }

  async function finalizeWorkspaceConnection({
    credential,
    walletAddress,
    serverSession,
    currentHandle,
    currentDisplayName,
  }: {
    credential: BrowserPasskeyCredential | { credentialId: string; publicKeyX: string; publicKeyY: string; keyHash: string };
    walletAddress?: string;
    serverSession: WorkspaceSessionToken;
    currentHandle: string;
    currentDisplayName: string;
  }) {
    let serializedCredential: {
      credentialId: string;
      publicKeyX: string;
      publicKeyY: string;
      keyHash: string;
    };

    if (typeof credential.publicKeyX === "bigint") {
      serializedCredential = toSerializedCredential(credential as BrowserPasskeyCredential);
    } else {
      serializedCredential = credential as {
        credentialId: string;
        publicKeyX: string;
        publicKeyY: string;
        keyHash: string;
      };
    }

    startTransition(() => {
      void (async () => {
        const result = await connectWorkspaceAction({
          username: currentHandle,
          displayName: currentDisplayName,
          credential: serializedCredential,
          walletAddress,
          authOrigin: window.location.origin,
          authSession: serverSession,
        });

        if (!result.success) {
          setError(result.error);
          setBusyLabel(null);
          return;
        }

        router.push("/dashboard");
        router.refresh();
      })();
    });
  }

  useEffect(() => {
    void refreshOriginStatus();
  }, []);

  useEffect(() => {
    const hasRedirectPayload =
      searchParams.has("session") || searchParams.has("error") || searchParams.has("state");

    if (!hasRedirectPayload || redirectHandled.current) {
      return;
    }

    redirectHandled.current = true;
    const currentHandle = searchParams.get("username") || username.trim();
    const currentDisplayName = searchParams.get("displayName") || resolvedDisplayName;

    setAuthRail("veridex");
    setError(null);
    setNotice("Redirect authentication completed. Finalizing your workspace session.");
    setBusyLabel("Finalizing redirect session...");

    void (async () => {
      try {
        const originAllowed = await refreshOriginStatus();

        if (!originAllowed) {
          throw new Error(
            "This origin is not registered with Veridex. Complete origin registration before reconnecting.",
          );
        }

        const { createCrossOriginAuth } = await getCrossOriginAuthToolkit();
        const auth = createCrossOriginAuth({
          authPortalUrl: getVeridexAuthPortalUrl(),
          relayerUrl: getRelayBaseUrl(),
          mode: "redirect",
          redirectUri: buildRedirectUri(currentHandle, currentDisplayName),
          timeout: 5 * 60 * 1000,
        });

        const redirectedSession = auth.completeRedirectAuth() as BrowserCrossOriginSession | null;

        if (!redirectedSession) {
          throw new Error("The redirect flow did not return a Veridex session.");
        }

        const serverSession = (await auth.createServerSession(
          normalizeCrossOriginSession(redirectedSession),
        )) as ServerSessionToken;

        await finalizeWorkspaceConnection({
          credential: redirectedSession.credential,
          walletAddress: undefined,
          serverSession,
          currentHandle,
          currentDisplayName,
        });
      } catch (redirectError) {
        setError(formatAuthError(redirectError));
        setBusyLabel(null);
      }
    })();
  }, [resolvedDisplayName, searchParams, router, username]);

  async function reconnectVeridexWorkspace() {
    const currentHandle = username.trim();
    const currentDisplayName = resolvedDisplayName;

    if (!currentHandle) {
      setError("Enter the workspace handle tied to the treasury operator identity.");
      return;
    }

    setError(null);
    setNotice(null);

    const originAllowed = await refreshOriginStatus();
    if (!originAllowed) {
      setError(
        "This workspace origin must be registered with Veridex before it can mint Auth Sessions.",
      );
      return;
    }

    setBusyLabel(
      connectionMode === "redirect"
        ? "Redirecting to Veridex..."
        : "Minting your verified Auth Session...",
    );

    try {
      const { createCrossOriginAuth } = await getCrossOriginAuthToolkit();
      const auth = createCrossOriginAuth({
        authPortalUrl: getVeridexAuthPortalUrl(),
        relayerUrl: getRelayBaseUrl(),
        mode: connectionMode,
        redirectUri: buildRedirectUri(currentHandle, currentDisplayName),
        timeout: 5 * 60 * 1000,
      });

      if (connectionMode === "redirect") {
        await auth.connectWithVeridex();
        return;
      }

      const { session, serverSession } = (await auth.authenticateAndCreateSession(
        AUTH_SESSION_OPTIONS,
      )) as {
        session: BrowserCrossOriginSession;
        serverSession: ServerSessionToken;
      };

      await finalizeWorkspaceConnection({
        credential: session.credential,
        walletAddress: undefined,
        serverSession,
        currentHandle,
        currentDisplayName,
      });
    } catch (authError) {
      const message = formatAuthError(authError);
      setError(message);
      if (message.includes("Popup authentication was blocked")) {
        setConnectionMode("redirect");
      }
      setBusyLabel(null);
    }
  }

  async function connectLocalWorkspace(mode: "register" | "reconnect") {
    const currentHandle = username.trim();
    const currentDisplayName = resolvedDisplayName;

    if (!currentHandle) {
      setError("Enter the workspace handle tied to the local passkey wallet.");
      return;
    }

    setError(null);
    setNotice(
      mode === "register"
        ? "Creating a device-scoped local passkey wallet on this origin."
        : "Reconnecting the existing local passkey wallet from this device.",
    );
    setBusyLabel(mode === "register" ? "Creating local passkey wallet..." : "Reconnecting local wallet...");

    try {
      const result =
        mode === "register"
          ? await registerLocalPasskeyWallet({
              username: currentHandle,
              displayName: currentDisplayName,
              ...AUTH_SESSION_OPTIONS,
            })
          : await reconnectLocalPasskeyWallet(AUTH_SESSION_OPTIONS);

      await finalizeWorkspaceConnection({
        credential: result.credential,
        walletAddress: result.walletAddress,
        serverSession: result.authSession,
        currentHandle,
        currentDisplayName,
      });
    } catch (localError) {
      setError(formatLocalWalletError(localError));
      setBusyLabel(null);
    }
  }

  return (
    <div className="dashboard-shell min-h-screen bg-background text-on-background">
      <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="font-headline text-xl font-bold tracking-tight gradient-text">
            StableHacks 2026
          </Link>
          <div className="hidden items-center gap-4 text-xs uppercase tracking-[0.2em] text-slate-500 md:flex">
            <span>Passkey-First Treasury</span>
            <span>Auth Sessions</span>
            <span>Solana Devnet</span>
          </div>
        </div>
      </header>

      <main className="mx-auto grid min-h-[calc(100vh-73px)] max-w-6xl grid-cols-1 gap-12 px-6 py-12 lg:grid-cols-[1.08fr_0.92fr]">
        <section className="flex flex-col justify-center">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-teal-500/20 bg-teal-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-teal-400">
            <span className="h-2 w-2 rounded-full bg-teal-400" />
            Passkey Treasury Control Plane
          </span>
          <h1 className="mt-6 font-headline text-5xl font-extrabold tracking-tight text-on-background">
            Create a local passkey wallet or reconnect a Veridex operator, then fund the Solana treasury flow judges can follow.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-400">
            StableHacks 2026 is a passkey-first treasury workspace for Solana teams. Developers can now
            start with a real local passkey wallet on this origin or use the Veridex operator rail for a
            relayer-backed session, then fund the devnet wallet, create an x402 payment or payout claim,
            and show the receipt plus audit trail.
          </p>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <article className={cn(dashboardSubPanelClassName, "p-5")}>
              <span className="text-[11px] uppercase tracking-[0.2em] text-teal-400">Step 1</span>
              <h2 className="mt-3 font-headline text-lg font-bold">Choose the passkey rail</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Create a local wallet directly in the app for development, or reconnect a Veridex passkey for a portable operator session.
              </p>
            </article>
            <article className={cn(dashboardSubPanelClassName, "p-5")}>
              <span className="text-[11px] uppercase tracking-[0.2em] text-teal-400">Step 2</span>
              <h2 className="mt-3 font-headline text-lg font-bold">Fund on Solana devnet</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                The dashboard then airdrops devnet SOL, seeds the managed treasury stable asset, and exposes explorer-linked balances.
              </p>
            </article>
            <article className={cn(dashboardSubPanelClassName, "p-5")}>
              <span className="text-[11px] uppercase tracking-[0.2em] text-teal-400">Step 3</span>
              <h2 className="mt-3 font-headline text-lg font-bold">Create payment rails</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Operators can issue Solana x402 collection links or payout claims for either human claimants or autonomous agents.
              </p>
            </article>
            <article className={cn(dashboardSubPanelClassName, "p-5")}>
              <span className="text-[11px] uppercase tracking-[0.2em] text-teal-400">Step 4</span>
              <h2 className="mt-3 font-headline text-lg font-bold">Surface receipts and evidence</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Every live settlement resolves into receipts, signatures, mint references, and audit-ready traces in Prisma.
              </p>
            </article>
          </div>
        </section>

        <section className="relative">
          <div className={cn(dashboardPanelClassName, "p-8 shadow-2xl")}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="inline-flex items-center rounded-full bg-teal-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-300">
                  Workspace Access
                </span>
                <h2 className="mt-4 font-headline text-3xl font-bold text-white">
                  {authRail === "local" ? "Create a local passkey wallet" : "Mint a verified Auth Session"}
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-400">
                  {authRail === "local"
                    ? "Use the live Solana SDK to create a device-scoped passkey wallet directly on this origin, then enter the treasury dashboard without touching the auth portal."
                    : "Reconnect an existing Veridex passkey here. First-time cross-origin passkey creation still routes through a Veridex-owned origin so we never fake portable registration from localhost."}
                </p>
              </div>
              <div className="rounded-2xl border border-teal-500/15 bg-teal-500/10 p-3 text-teal-300">
                {authRail === "local" ? <WalletCards className="h-6 w-6" /> : <Fingerprint className="h-6 w-6" />}
              </div>
            </div>

            <div className="mt-8">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                  Auth Rail
                </span>
                <span className="text-xs text-slate-500">
                  Local is fastest for development. Veridex is the portable operator identity flow.
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setAuthRail("local");
                    setError(null);
                    setNotice("Local passkey wallets are created directly in this browser and persisted for this device.");
                  }}
                  className={cn(
                    dashboardButtonSecondaryClassName,
                    "justify-center gap-2",
                    authRail === "local"
                      ? "border-teal-500/40 bg-teal-500/10 text-white"
                      : "",
                  )}
                >
                  <WalletCards className="h-4 w-4" />
                  Local wallet
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthRail("veridex");
                    setError(null);
                    setNotice("Veridex operator mode will validate the origin and mint a relayer-backed Auth Session.");
                  }}
                  className={cn(
                    dashboardButtonSecondaryClassName,
                    "justify-center gap-2",
                    authRail === "veridex"
                      ? "border-sky-500/40 bg-sky-500/10 text-white"
                      : "",
                  )}
                >
                  <Fingerprint className="h-4 w-4" />
                  Veridex operator
                </button>
              </div>
            </div>

            <div className="mt-8 grid gap-4">
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                  Workspace Handle
                </span>
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") {
                      return;
                    }

                    void (
                      authRail === "local"
                        ? connectLocalWorkspace("reconnect")
                        : reconnectVeridexWorkspace()
                    );
                  }}
                  placeholder="stablehack"
                  className={dashboardInputClassName}
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                  Display Name
                </span>
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="StableHacks Treasury"
                  className={dashboardInputClassName}
                />
              </label>
            </div>

            {authRail === "veridex" ? (
              <>
                <div className="mt-6">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                      Connection Rail
                    </span>
                    <span className="text-xs text-slate-500">
                      Popup is recommended. Redirect is the fallback if popups are blocked.
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setConnectionMode("popup")}
                      className={cn(
                        dashboardButtonSecondaryClassName,
                        "justify-center gap-2",
                        connectionMode === "popup"
                          ? "border-teal-500/40 bg-teal-500/10 text-white"
                          : "",
                      )}
                    >
                      <MonitorUp className="h-4 w-4" />
                      Popup
                    </button>
                    <button
                      type="button"
                      onClick={() => setConnectionMode("redirect")}
                      className={cn(
                        dashboardButtonSecondaryClassName,
                        "justify-center gap-2",
                        connectionMode === "redirect"
                          ? "border-sky-500/40 bg-sky-500/10 text-white"
                          : "",
                      )}
                    >
                      <ArrowRight className="h-4 w-4" />
                      Redirect
                    </button>
                  </div>
                </div>

                <div
                  className={cn(
                    "mt-6 rounded-2xl border p-4 text-sm leading-6",
                    originStatus.allowed
                      ? "border-teal-500/20 bg-teal-500/10 text-teal-200"
                      : "border-amber-500/20 bg-amber-500/10 text-amber-100",
                  )}
                >
                  <div className="flex items-start gap-3">
                    {originStatus.allowed ? (
                      <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
                    ) : (
                      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                    )}
                    <div>
                      <p className="font-semibold">
                        {originStatus.loading ? "Checking origin registration..." : originStatus.summary}
                      </p>
                      <p className="mt-1 text-sm opacity-90">{originStatus.detail}</p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="mt-6 rounded-2xl border border-teal-500/20 bg-teal-500/10 p-4 text-sm leading-6 text-teal-100">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <p className="font-semibold">Local passkey wallet mode</p>
                    <p className="mt-1 text-sm opacity-90">
                      This flow creates a real browser passkey on the current origin, derives the Solana wallet through the live SDK, and stores a device-scoped workspace session for this app.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {notice ? (
              <div className="mt-4 rounded-2xl border border-sky-500/20 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
                {notice}
              </div>
            ) : null}

            {error ? (
              <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {authRail === "local" ? (
                <>
                  <button
                    type="button"
                    className={cn(dashboardButtonClassName, "w-full gap-3")}
                    onClick={() => void connectLocalWorkspace("register")}
                    disabled={Boolean(busyLabel) || isPending}
                  >
                    {Boolean(busyLabel) || isPending ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <WalletCards className="h-5 w-5" />
                    )}
                    Create local passkey wallet
                  </button>

                  <button
                    type="button"
                    className={cn(dashboardButtonSecondaryClassName, "w-full gap-3")}
                    onClick={() => void connectLocalWorkspace("reconnect")}
                    disabled={Boolean(busyLabel) || isPending}
                  >
                    <KeyRound className="h-5 w-5" />
                    Reconnect local passkey
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className={cn(dashboardButtonClassName, "w-full gap-3")}
                    onClick={() => void reconnectVeridexWorkspace()}
                    disabled={Boolean(busyLabel) || isPending || originStatus.loading}
                  >
                    {Boolean(busyLabel) || isPending ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <KeyRound className="h-5 w-5" />
                    )}
                    {connectionMode === "redirect" ? "Reconnect with redirect" : "Reconnect existing passkey"}
                  </button>

                  <button
                    type="button"
                    className={cn(dashboardButtonSecondaryClassName, "w-full gap-3")}
                    onClick={() => router.push(buildRegistrationPath(username, resolvedDisplayName))}
                    disabled={Boolean(busyLabel) || isPending}
                  >
                    <WalletCards className="h-5 w-5" />
                    Open Veridex registration
                  </button>
                </>
              )}
            </div>

            <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/80 p-4 text-sm leading-6 text-slate-400">
              Workspace wallet addresses are derived through the live Veridex Solana SDK. No mock wallet IDs are created in this path.
            </div>

            <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-sm leading-6 text-slate-400">
              {authRail === "local" ? (
                <>
                  Local passkey wallets are intentionally device-scoped. They are great for development, treasury demos, and same-device testing, but they do not mint a portable Veridex Auth Session unless you switch to the Veridex operator rail.
                </>
              ) : (
                <>
                  Need first-time setup? Start on a Veridex-owned origin, create the passkey there, then
                  return to this workspace and reconnect to mint the server-validated Auth Session.
                  <Link
                    href={buildRegistrationPath(username, resolvedDisplayName)}
                    className="mt-3 inline-flex items-center gap-2 font-semibold text-teal-300 hover:text-teal-200"
                  >
                    Open registration instructions
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </>
              )}
            </div>
          </div>

          {busyLabel ? (
            <div className="absolute inset-0 flex items-center justify-center rounded-[28px] bg-black/50 backdrop-blur-md">
              <div className={cn(dashboardSubPanelClassName, "px-8 py-7 text-center shadow-2xl")}>
                <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-teal-400" />
                <p className="font-headline text-lg font-bold">{busyLabel}</p>
                <p className="mt-2 text-sm text-slate-400">
                  {authRail === "local"
                    ? "Complete the browser passkey prompt and we will carry the local wallet into the dashboard."
                    : "Complete the browser prompt or the Veridex redirect, then we will carry you into the dashboard."}
                </p>
              </div>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}

function AuthFallback() {
  return (
    <div className="dashboard-shell flex min-h-screen items-center justify-center bg-background px-6 text-on-background">
      <div className={cn(dashboardSubPanelClassName, "w-full max-w-md p-8 text-center")}>
        <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-teal-400" />
        <h1 className="text-xl font-semibold text-white">Loading authentication</h1>
        <p className="mt-2 text-sm text-slate-400">Preparing the passkey workspace flow.</p>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<AuthFallback />}>
      <AuthContent />
    </Suspense>
  );
}
