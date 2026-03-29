import { NextRequest, NextResponse } from 'next/server';
import { getVeridexRelayerApiUrl } from '@/lib/veridex-auth';

const RELAYER_API_URL = getVeridexRelayerApiUrl();
const REMOTE_CREDENTIAL_RELAY_ENABLED = process.env.VERIDEX_ENABLE_REMOTE_CREDENTIAL_RELAY === 'true';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ success: false, error: 'A JSON request body is required.' }, { status: 400 });
  }

  if (!REMOTE_CREDENTIAL_RELAY_ENABLED) {
    return NextResponse.json({
      success: true,
      skipped: true,
      detail: 'Remote credential relay is disabled for this workspace.',
    });
  }

  try {
    const response = await fetch(`${RELAYER_API_URL}/credential`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: payload.error || 'Failed to store credential in relayer.' },
        { status: response.status },
      );
    }

    return NextResponse.json({ success: true, data: payload });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Credential relay request failed.',
      },
      { status: 502 },
    );
  }
}
