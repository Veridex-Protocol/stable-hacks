"use server";

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getServerRuntime } from '@/server/runtime';
import {
  WORKSPACE_PROFILE_COOKIE,
  WORKSPACE_SESSION_COOKIE,
  getWorkspaceCookieState,
} from '@/app/lib/server-data';
import { debugLog } from '@/server/utils/debugLog';
import type {
  ClaimPaymentLinkInput,
  CounterpartyInput,
  CreateClaimLinkInput,
  CreateInvoiceInput,
  CreatePaymentLinkInput,
  DashboardState,
  PublicPaymentLinkState,
  TreasuryWorkspaceState,
  WorkspaceConnectInput,
} from '@/server/types/index';

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

function failure<T>(error: unknown): ActionResult<T> {
  return {
    success: false,
    error: error instanceof Error ? error.message : 'Unknown server error.',
  };
}

async function setWorkspaceCookies(profileId: string, sessionId: string | null): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(WORKSPACE_PROFILE_COOKIE, profileId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });

  if (sessionId) {
    cookieStore.set(WORKSPACE_SESSION_COOKIE, sessionId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    });
  }
}

async function clearWorkspaceCookies(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(WORKSPACE_PROFILE_COOKIE);
  cookieStore.delete(WORKSPACE_SESSION_COOKIE);
}

async function requireWorkspaceIdentity(): Promise<{ profileId: string; sessionId: string | null }> {
  const { profileId, sessionId } = await getWorkspaceCookieState();

  if (!profileId) {
    throw new Error('Connect a passkey wallet before using the dashboard.');
  }

  return { profileId, sessionId };
}

function revalidateWorkspaceViews(): void {
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/collections');
  revalidatePath('/dashboard/collections/links');
  revalidatePath('/dashboard/reviews');
  revalidatePath('/dashboard/counterparties');
  revalidatePath('/dashboard/logs');
  revalidatePath('/dashboard/policy');
}

export async function connectWorkspaceAction(
  input: WorkspaceConnectInput,
): Promise<ActionResult<TreasuryWorkspaceState>> {
  try {
    const { workspaceService } = getServerRuntime();
    const state = await workspaceService.connectWallet(input);
    await setWorkspaceCookies(state.profile.id, state.authSession?.id ?? input.authSession?.id ?? null);
    revalidateWorkspaceViews();
    return { success: true, data: state };
  } catch (error) {
    return failure(error);
  }
}

export async function logoutWorkspaceAction(): Promise<void> {
  await clearWorkspaceCookies();
  redirect('/auth');
}

export async function bootstrapTreasuryAction(): Promise<ActionResult<DashboardState>> {
  try {
    const { treasuryGuard } = getServerRuntime();
    debugLog('treasury.action', 'bootstrap action started');
    const state = await treasuryGuard.bootstrap();
    debugLog('treasury.action', 'bootstrap action completed', {
      treasuryAddress: state.actors.treasuryAddress,
      mintAddress: state.summary.stableAsset?.mintAddress,
      mode: state.summary.stableAsset?.mode,
    });
    revalidateWorkspaceViews();
    return { success: true, data: state };
  } catch (error) {
    debugLog(
      'treasury.action',
      'bootstrap action failed',
      {
        error: error instanceof Error ? error.message : 'Unknown server error.',
      },
      { level: 'warn' },
    );
    return failure(error);
  }
}

export async function bootstrapTreasuryFormAction(formData: FormData): Promise<void> {
  const returnTo = String(formData.get('returnTo') || '').trim();
  debugLog('treasury.action', 'bootstrap form submitted', {
    returnTo: returnTo || '(none)',
  });
  const result = await bootstrapTreasuryAction();

  if (!result.success) {
    debugLog(
      'treasury.action',
      'bootstrap form redirecting with error',
      {
        returnTo: returnTo || '(none)',
        error: result.error,
      },
      { level: 'warn' },
    );
    if (returnTo) {
      redirect(`${returnTo}${returnTo.includes('?') ? '&' : '?'}error=${encodeURIComponent(result.error)}`);
    }
    return;
  }

  debugLog('treasury.action', 'bootstrap form redirecting with success', {
    returnTo: returnTo || '(none)',
  });
  if (returnTo) {
    redirect(`${returnTo}${returnTo.includes('?') ? '&' : '?'}bootstrapped=1`);
  }
}

export async function refreshAssetsAction(): Promise<ActionResult<TreasuryWorkspaceState>> {
  try {
    const { workspaceService } = getServerRuntime();
    const { profileId, sessionId } = await requireWorkspaceIdentity();
    const state = await workspaceService.refreshAssets(profileId, sessionId ?? undefined);
    revalidateWorkspaceViews();
    return { success: true, data: state };
  } catch (error) {
    return failure(error);
  }
}

export async function refreshAssetsFormAction(): Promise<void> {
  await refreshAssetsAction();
}

export async function requestAirdropAction(amount = 1): Promise<ActionResult<TreasuryWorkspaceState>> {
  try {
    const { workspaceService } = getServerRuntime();
    const { profileId, sessionId } = await requireWorkspaceIdentity();
    const state = await workspaceService.requestWalletAirdrop(profileId, sessionId ?? undefined, amount);
    revalidateWorkspaceViews();
    return { success: true, data: state };
  } catch (error) {
    return failure(error);
  }
}

export async function requestAirdropFormAction(formData: FormData): Promise<void> {
  const amount = Number(formData.get('amount') || 1);
  await requestAirdropAction(Number.isFinite(amount) && amount > 0 ? amount : 1);
}

export async function seedStablecoinAction(amount = 250): Promise<ActionResult<TreasuryWorkspaceState>> {
  try {
    const { workspaceService } = getServerRuntime();
    const { profileId, sessionId } = await requireWorkspaceIdentity();
    const state = await workspaceService.seedStablecoin(profileId, sessionId ?? undefined, amount);
    revalidateWorkspaceViews();
    return { success: true, data: state };
  } catch (error) {
    return failure(error);
  }
}

export async function seedStablecoinFormAction(formData: FormData): Promise<void> {
  const amount = Number(formData.get('amount') || 250);
  await seedStablecoinAction(Number.isFinite(amount) && amount > 0 ? amount : 250);
}

export async function recordWalletSendAction(input: {
  assetSymbol: string;
  mintAddress?: string | null;
  amountRaw: string;
  amountDisplay: string;
  destinationAddress: string;
  transactionHash?: string | null;
  explorerUrl?: string | null;
  notes?: string | null;
  status?: 'pending' | 'confirmed' | 'failed';
}): Promise<ActionResult<TreasuryWorkspaceState>> {
  try {
    const { workspaceService } = getServerRuntime();
    const { profileId, sessionId } = await requireWorkspaceIdentity();

    debugLog('wallet.send', 'record wallet send action started', {
      profileId,
      assetSymbol: input.assetSymbol,
      destinationAddress: input.destinationAddress,
      amountDisplay: input.amountDisplay,
      status: input.status || 'pending',
      transactionHash: input.transactionHash || null,
    });

    const state = await workspaceService.recordManualWalletSend(profileId, sessionId ?? undefined, {
      ...input,
      status:
        input.status === 'confirmed'
          ? 'CONFIRMED'
          : input.status === 'failed'
            ? 'FAILED'
            : 'PENDING',
    });

    revalidateWorkspaceViews();
    return { success: true, data: state };
  } catch (error) {
    debugLog(
      'wallet.send',
      'record wallet send action failed',
      {
        error: error instanceof Error ? error.message : 'Unknown server error.',
        transactionHash: input.transactionHash || null,
      },
      { level: 'warn' },
    );
    return failure(error);
  }
}

export async function createPaymentLinkAction(
  input: Omit<CreatePaymentLinkInput, 'sessionId'>,
): Promise<ActionResult<TreasuryWorkspaceState>> {
  try {
    const { commerceService, workspaceService } = getServerRuntime();
    const { profileId, sessionId } = await requireWorkspaceIdentity();
    await commerceService.createPaymentLink(profileId, { ...input, sessionId: sessionId ?? undefined });
    const state = await workspaceService.getWorkspaceState(profileId, sessionId ?? undefined);
    revalidateWorkspaceViews();
    return { success: true, data: state };
  } catch (error) {
    return failure(error);
  }
}

export async function createPaymentLinkFormAction(formData: FormData): Promise<void> {
  const currency = String(formData.get('currency') || '') as 'SOL' | 'USDC' | 'EURC' | '';
  const result = await createPaymentLinkAction({
    title: String(formData.get('title') || ''),
    description: String(formData.get('description') || ''),
    amount: Number(formData.get('amount') || 0),
    currency: currency === 'SOL' || currency === 'USDC' || currency === 'EURC' ? currency : undefined,
    customerName: String(formData.get('customerName') || ''),
    customerEmail: String(formData.get('customerEmail') || ''),
    expiresAt: String(formData.get('expiresAt') || ''),
    x402Enabled: String(formData.get('x402Enabled') || 'on') !== 'off',
  });
  if (!result.success) {
    redirect(`/dashboard/collections?error=${encodeURIComponent(result.error)}`);
  }
}

export async function createClaimLinkAction(
  input: Omit<CreateClaimLinkInput, 'sessionId'>,
): Promise<ActionResult<TreasuryWorkspaceState>> {
  try {
    const { commerceService, workspaceService } = getServerRuntime();
    const { profileId, sessionId } = await requireWorkspaceIdentity();
    await commerceService.createClaimLink(profileId, { ...input, sessionId: sessionId ?? undefined });
    const state = await workspaceService.getWorkspaceState(profileId, sessionId ?? undefined);
    revalidateWorkspaceViews();
    return { success: true, data: state };
  } catch (error) {
    return failure(error);
  }
}

export async function createClaimLinkFormAction(formData: FormData): Promise<void> {
  const currency = String(formData.get('currency') || '') as 'SOL' | 'USDC' | 'EURC' | '';
  const result = await createClaimLinkAction({
    title: String(formData.get('title') || ''),
    description: String(formData.get('description') || ''),
    amount: Number(formData.get('amount') || 0),
    currency: currency === 'SOL' || currency === 'USDC' || currency === 'EURC' ? currency : undefined,
    customerName: String(formData.get('customerName') || ''),
    customerEmail: String(formData.get('customerEmail') || ''),
    expiresAt: String(formData.get('expiresAt') || ''),
    claimMode:
      String(formData.get('claimMode') || 'either') === 'human'
        ? 'human'
        : String(formData.get('claimMode') || 'either') === 'agent'
          ? 'agent'
          : 'either',
  });
  if (!result.success) {
    redirect(`/dashboard/collections?error=${encodeURIComponent(result.error)}`);
  }
}

export async function createInvoiceAction(
  input: Omit<CreateInvoiceInput, 'sessionId'>,
): Promise<ActionResult<TreasuryWorkspaceState>> {
  try {
    const { commerceService, workspaceService } = getServerRuntime();
    const { profileId, sessionId } = await requireWorkspaceIdentity();
    await commerceService.createInvoice(profileId, { ...input, sessionId: sessionId ?? undefined });
    const state = await workspaceService.getWorkspaceState(profileId, sessionId ?? undefined);
    revalidateWorkspaceViews();
    return { success: true, data: state };
  } catch (error) {
    return failure(error);
  }
}

export async function createInvoiceFormAction(formData: FormData): Promise<void> {
  const currency = String(formData.get('currency') || '') as 'SOL' | 'USDC' | 'EURC' | '';
  const result = await createInvoiceAction({
    title: String(formData.get('title') || ''),
    description: String(formData.get('description') || ''),
    customerName: String(formData.get('customerName') || ''),
    customerEmail: String(formData.get('customerEmail') || ''),
    amount: Number(formData.get('amount') || 0),
    currency: currency === 'SOL' || currency === 'USDC' || currency === 'EURC' ? currency : undefined,
    dueDate: String(formData.get('dueDate') || ''),
  });
  if (!result.success) {
    redirect(`/dashboard/collections?error=${encodeURIComponent(result.error)}`);
  }
}

export async function createCounterpartyAction(
  input: CounterpartyInput,
): Promise<ActionResult<DashboardState>> {
  try {
    const { treasuryGuard } = getServerRuntime();
    const state = await treasuryGuard.createCounterparty(input);
    revalidateWorkspaceViews();
    return { success: true, data: state };
  } catch (error) {
    return failure(error);
  }
}

export async function createCounterpartyFormAction(formData: FormData): Promise<void> {
  const approvedCorridors = String(formData.get('approvedCorridors') || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  await createCounterpartyAction({
    name: String(formData.get('name') || ''),
    country: String(formData.get('country') || ''),
    walletAddress: String(formData.get('walletAddress') || '') || undefined,
    kycStatus: (String(formData.get('kycStatus') || 'pending') as CounterpartyInput['kycStatus']),
    approvedCorridors,
    sanctioned: formData.get('sanctioned') === 'on',
    generateWallet: formData.get('generateWallet') === 'on',
  });
}

export async function submitPayoutFormAction(formData: FormData): Promise<void> {
  try {
    const { treasuryGuard } = getServerRuntime();
    await treasuryGuard.submitPayout({
      counterpartyId: String(formData.get('counterpartyId') || ''),
      amount: Number(formData.get('amount') || 0),
      corridor: String(formData.get('corridor') || ''),
      memo: String(formData.get('memo') || ''),
    });
    revalidateWorkspaceViews();
  } catch {
    // The page re-renders into its current state on failure.
  }
}

export async function approvePayoutFormAction(formData: FormData): Promise<void> {
  try {
    const { treasuryGuard } = getServerRuntime();
    await treasuryGuard.approvePayout(String(formData.get('payoutId') || ''), {
      approvalNote: String(formData.get('approvalNote') || ''),
    });
    revalidateWorkspaceViews();
  } catch {
    // No-op; page keeps current state.
  }
}

export async function rejectPayoutFormAction(formData: FormData): Promise<void> {
  try {
    const { treasuryGuard } = getServerRuntime();
    await treasuryGuard.rejectPayout(String(formData.get('payoutId') || ''), {
      approvalNote: String(formData.get('approvalNote') || ''),
    });
    revalidateWorkspaceViews();
  } catch {
    // No-op; page keeps current state.
  }
}

export async function refreshValidationsFormAction(): Promise<void> {
  try {
    await getServerRuntime().treasuryGuard.refreshValidations();
    revalidateWorkspaceViews();
  } catch {
    // No-op
  }
}

export async function getPublicLinkStateAction(
  slug: string,
): Promise<ActionResult<PublicPaymentLinkState>> {
  try {
    const origin =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'http://localhost:3000';
    return {
      success: true,
      data: await getServerRuntime().commerceService.getPublicLinkState(slug, origin),
    };
  } catch (error) {
    return failure(error);
  }
}

export async function verifyPaymentLinkAction(
  slug: string,
  txSignature: string,
): Promise<ActionResult<PublicPaymentLinkState>> {
  try {
    const origin =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'http://localhost:3000';
    const state = await getServerRuntime().commerceService.verifyPaymentLink(slug, txSignature, origin);
    revalidatePath(`/pay/${slug}`);
    revalidatePath('/dashboard');
    revalidatePath('/dashboard/collections');
    return { success: true, data: state };
  } catch (error) {
    return failure(error);
  }
}

export async function claimPayoutLinkAction(
  slug: string,
  input: ClaimPaymentLinkInput,
): Promise<ActionResult<PublicPaymentLinkState>> {
  try {
    const origin =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'http://localhost:3000';
    const state = await getServerRuntime().commerceService.claimPayoutLink(
      slug,
      input.recipientAddress,
      origin,
    );
    revalidatePath(`/claim/${slug}`);
    revalidatePath('/dashboard');
    revalidatePath('/dashboard/collections');
    return { success: true, data: state };
  } catch (error) {
    return failure(error);
  }
}

export async function disablePaymentLinkAction(linkId: string): Promise<ActionResult<void>> {
  try {
    const { profileId } = await requireWorkspaceIdentity();
    await getServerRuntime().commerceService.disablePaymentLink(profileId, linkId);
    revalidateWorkspaceViews();
    return { success: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}

export async function disablePaymentLinkFormAction(formData: FormData): Promise<void> {
  const linkId = String(formData.get('linkId') || '');
  const result = await disablePaymentLinkAction(linkId);
  if (!result.success) {
    redirect(`/dashboard/collections/links?error=${encodeURIComponent(result.error)}`);
  }
}
