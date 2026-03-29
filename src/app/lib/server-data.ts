import 'server-only';

import { cookies } from 'next/headers';
import { getServerRuntime } from '@/server/runtime';
import type {
  DashboardState,
  PublicPaymentLinkState,
  TreasuryWorkspaceState,
} from '@/server/types/index';

export const WORKSPACE_PROFILE_COOKIE = 'stablehacks_profile_id';
export const WORKSPACE_SESSION_COOKIE = 'stablehacks_session_id';

export interface WorkspaceCookieState {
  profileId: string | null;
  sessionId: string | null;
}

export async function getWorkspaceCookieState(): Promise<WorkspaceCookieState> {
  const cookieStore = await cookies();

  return {
    profileId: cookieStore.get(WORKSPACE_PROFILE_COOKIE)?.value ?? null,
    sessionId: cookieStore.get(WORKSPACE_SESSION_COOKIE)?.value ?? null,
  };
}

export async function getWorkspaceStateOrNull(): Promise<TreasuryWorkspaceState | null> {
  const { workspaceService } = getServerRuntime();
  const { profileId, sessionId } = await getWorkspaceCookieState();

  if (!profileId) {
    return null;
  }

  try {
    return await workspaceService.getWorkspaceState(profileId, sessionId ?? undefined);
  } catch {
    return null;
  }
}

export async function getTreasuryState(): Promise<DashboardState> {
  return getServerRuntime().treasuryGuard.getDashboardState();
}

export async function getPublicLinkState(slug: string): Promise<PublicPaymentLinkState> {
  const origin =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'http://localhost:3000';

  return getServerRuntime().commerceService.getPublicLinkState(slug, origin);
}
