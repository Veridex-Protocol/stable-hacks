import { NextRequest, NextResponse } from 'next/server';
import { getVeridexRelayerApiUrl } from '@/lib/veridex-auth';

const RELAYER_API_URL = getVeridexRelayerApiUrl();

function isLocalOrigin(url: URL): boolean {
  return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
}

function isBuiltinVeridexOrigin(url: URL): boolean {
  return url.hostname === 'veridex.network' || url.hostname.endsWith('.veridex.network');
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const origin =
    request.nextUrl.searchParams.get('origin') ||
    request.headers.get('origin') ||
    request.headers.get('x-forwarded-origin');

  if (!origin) {
    return NextResponse.json(
      { allowed: false, reason: 'invalid', error: 'An origin query parameter is required.' },
      { status: 400 },
    );
  }

  try {
    const normalized = new URL(origin).origin.toLowerCase();
    const url = new URL(normalized);

    if (isLocalOrigin(url)) {
      return NextResponse.json({
        allowed: true,
        reason: 'development',
        origin: normalized,
      });
    }

    if (isBuiltinVeridexOrigin(url)) {
      return NextResponse.json({
        allowed: true,
        reason: 'builtin',
        origin: normalized,
      });
    }

    const response = await fetch(
      `${RELAYER_API_URL}/origins/validate?origin=${encodeURIComponent(normalized)}`,
      {
        cache: 'no-store',
      },
    );

    if (response.ok) {
      const payload = await response.json().catch(() => ({}));
      return NextResponse.json({
        ...payload,
        allowed: Boolean(payload.allowed),
        origin: normalized,
      });
    }

    return NextResponse.json(
      {
        allowed: false,
        reason: 'not_registered',
        origin: normalized,
        relayerUrl: RELAYER_API_URL,
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        allowed: false,
        reason: 'invalid',
        error: error instanceof Error ? error.message : 'Origin validation failed.',
      },
      { status: 400 },
    );
  }
}
