import { NextRequest, NextResponse } from 'next/server';
import { getVeridexRelayerApiUrl } from '@/lib/veridex-auth';

const RELAYER_API_URL = getVeridexRelayerApiUrl();

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ success: false, error: 'A JSON request body is required.' }, { status: 400 });
  }

  try {
    const response = await fetch(`${RELAYER_API_URL}/session/challenge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: payload.error || 'Failed to create a server-session challenge.' },
        { status: response.status },
      );
    }

    return NextResponse.json({ success: true, challenge: payload.challenge || payload });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Session challenge request failed.',
      },
      { status: 502 },
    );
  }
}
