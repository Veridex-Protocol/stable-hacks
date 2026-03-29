import { NextRequest, NextResponse } from 'next/server';
import { proxyRelayerRequest } from '@/app/api/auth/_utils';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;
  return proxyRelayerRequest(`/session/${encodeURIComponent(id)}`);
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;
  return proxyRelayerRequest(`/session/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
