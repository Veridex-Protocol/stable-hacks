import { NextResponse } from "next/server";
import { getWorkspaceCookieState } from "@/app/lib/server-data";
import { getServerRuntime } from "@/server/runtime";

export async function GET() {
  const { profileId, sessionId } = await getWorkspaceCookieState();

  if (!profileId) {
    return NextResponse.json({ error: "Workspace not connected." }, { status: 401 });
  }

  try {
    const { workspaceService } = getServerRuntime();
    const liveAssets = await workspaceService.getLiveAssets(profileId, sessionId ?? undefined);

    return NextResponse.json({
      workspace: {
        assets: liveAssets,
      },
      syncedAt: Date.now(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load live workspace balances.";
    const isTimeout = message.includes("timeout") || message.includes("ETIMEDOUT");
    return NextResponse.json(
      { error: message, retryable: isTimeout },
      { status: isTimeout ? 503 : 500 },
    );
  }
}
