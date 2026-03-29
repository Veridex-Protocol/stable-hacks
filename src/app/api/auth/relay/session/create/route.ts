import { NextRequest, NextResponse } from 'next/server';
import { proxyRelayerRequest, requireJsonBody } from '@/app/api/auth/_utils';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await requireJsonBody(request);

  if (body instanceof NextResponse) {
    return body;
  }

  return proxyRelayerRequest('/session/create', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
