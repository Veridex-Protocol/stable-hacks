import { NextResponse } from "next/server";
import { getWorkspaceCookieState } from "@/app/lib/server-data";
import { getServerRuntime } from "@/server/runtime";
import { debugLog } from "@/server/utils/debugLog";

const LIVE_CACHE_TTL_MS = 15_000;

declare global {
  var __stablehacksLiveCache__: Map<string, { expiresAt: number; payload: { workspace: { assets: unknown[] }; syncedAt: number } }> | undefined;
  var __stablehacksLiveInflight__: Map<string, Promise<{ workspace: { assets: unknown[] }; syncedAt: number }>> | undefined;
}

export async function GET() {
  const { profileId, sessionId } = await getWorkspaceCookieState();

  if (!profileId) {
    return NextResponse.json({ error: "Workspace not connected." }, { status: 401 });
  }

  try {
    const { workspaceService } = getServerRuntime();
    const cacheKey = `${profileId}:${sessionId ?? "none"}`;
    const cache = globalThis.__stablehacksLiveCache__ ?? (globalThis.__stablehacksLiveCache__ = new Map());
    const inflight = globalThis.__stablehacksLiveInflight__ ?? (globalThis.__stablehacksLiveInflight__ = new Map());
    const cached = cache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      debugLog(
        "workspace.live",
        "served cached live assets",
        {
          profileId,
          sessionId: sessionId ?? "none",
          assetCount: cached.payload.workspace.assets.length,
        },
        {
          throttleKey: `workspace-live-cache:${cacheKey}`,
          throttleMs: 5_000,
        },
      );
      return NextResponse.json(cached.payload);
    }

    const existing = inflight.get(cacheKey);
    if (existing) {
      debugLog(
        "workspace.live",
        "joined inflight live-assets refresh",
        {
          profileId,
          sessionId: sessionId ?? "none",
        },
        {
          throttleKey: `workspace-live-inflight:${cacheKey}`,
          throttleMs: 5_000,
        },
      );
    }
    const loadPromise =
      existing ??
      (async () => {
        debugLog("workspace.live", "starting fresh live-assets refresh", {
          profileId,
          sessionId: sessionId ?? "none",
        });
        const liveAssets = await workspaceService.getLiveAssets(profileId, sessionId ?? undefined);
        const payload = {
          workspace: {
            assets: liveAssets,
          },
          syncedAt: Date.now(),
        };
        cache.set(cacheKey, {
          expiresAt: Date.now() + LIVE_CACHE_TTL_MS,
          payload,
        });
        debugLog("workspace.live", "completed fresh live-assets refresh", {
          profileId,
          sessionId: sessionId ?? "none",
          assetCount: liveAssets.length,
        });
        return payload;
      })();

    inflight.set(cacheKey, loadPromise);
    const payload = await loadPromise.finally(() => {
      if (inflight.get(cacheKey) === loadPromise) {
        inflight.delete(cacheKey);
      }
    });

    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load live workspace balances.";
    const isTimeout = message.includes("timeout") || message.includes("ETIMEDOUT");
    debugLog(
      "workspace.live",
      "live-assets refresh failed",
      {
        profileId,
        sessionId: sessionId ?? "none",
        retryable: isTimeout,
        error: message,
      },
      { level: "warn" },
    );
    return NextResponse.json(
      { error: message, retryable: isTimeout },
      { status: isTimeout ? 503 : 500 },
    );
  }
}
