import { NextResponse } from 'next/server';
import { getVeridexRelayerApiUrl } from '@/lib/veridex-auth';

const RELAYER_API_URL = getVeridexRelayerApiUrl();

export async function proxyRelayerRequest(
  pathname: string,
  init?: RequestInit,
): Promise<NextResponse> {
  try {
    const response = await fetch(`${RELAYER_API_URL}${pathname}`, {
      ...init,
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
    });

    const payload = await response.json().catch(() => ({}));

    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Relayer request failed.',
      },
      { status: 502 },
    );
  }
}

export async function requireJsonBody(request: Request): Promise<Record<string, unknown> | NextResponse> {
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'A JSON request body is required.' }, { status: 400 });
  }

  return body as Record<string, unknown>;
}
