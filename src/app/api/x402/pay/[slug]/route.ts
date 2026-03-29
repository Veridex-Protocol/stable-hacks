import { NextRequest, NextResponse } from 'next/server';
import { getServerRuntime } from '@/server/runtime';

function paymentRequiredResponse(body: Record<string, unknown>, header: string): NextResponse {
  return NextResponse.json(body, {
    status: 402,
    headers: {
      'PAYMENT-REQUIRED': header,
      'x-stablehacks-x402-settlement-header': 'x-solana-tx-signature',
    },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const { slug } = await params;
  const origin = new URL(request.url).origin;
  const { commerceService } = getServerRuntime();
  const state = await commerceService.getPublicLinkState(slug, origin);

  if (state.link.kind !== 'payment-request') {
    return NextResponse.json({ error: 'This link does not accept x402 payments.' }, { status: 400 });
  }

  if (!state.link.x402Enabled || !state.agentic.x402Endpoint) {
    return NextResponse.json({ error: 'x402 is not enabled for this payment link.' }, { status: 400 });
  }

  const header = commerceService.getX402ChallengeHeader(state.link);

  return paymentRequiredResponse(
    {
      error: 'Payment Required',
      protocol: 'x402',
      network: state.agentic.network,
      settlementRail: 'solana-x402',
      settlementHeader: 'x-solana-tx-signature',
      endpoint: state.agentic.x402Endpoint,
      link: state.link,
    },
    header,
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const { slug } = await params;
  const origin = new URL(request.url).origin;
  const { commerceService } = getServerRuntime();

  const paymentPayload =
    request.headers.get('payment-signature') ||
    request.headers.get('PAYMENT-SIGNATURE') ||
    '';
  const txSignatureFromHeader = request.headers.get('x-solana-tx-signature') || '';
  const body = await request.json().catch(() => null);
  const txSignature =
    txSignatureFromHeader ||
    (body && typeof body.txSignature === 'string' ? body.txSignature : '');

  if (!paymentPayload || !txSignature) {
    const state = await commerceService.getPublicLinkState(slug, origin);

    if (!state.link.x402Enabled || !state.agentic.x402Endpoint) {
      return NextResponse.json({ error: 'x402 is not enabled for this payment link.' }, { status: 400 });
    }

    const header = commerceService.getX402ChallengeHeader(state.link);
    return paymentRequiredResponse(
      {
        error: 'Attach PAYMENT-SIGNATURE and x-solana-tx-signature to settle this Solana x402 payment.',
        protocol: 'x402',
        endpoint: state.agentic.x402Endpoint,
        settlementHeader: 'x-solana-tx-signature',
        link: state.link,
      },
      header,
    );
  }

  try {
    const state = await commerceService.settlePaymentLinkViaX402(
      slug,
      {
        paymentPayload,
        txSignature,
      },
      origin,
    );

    return NextResponse.json({
      success: true,
      protocol: 'x402',
      settlementRail: 'solana-x402',
      state,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'x402 settlement failed.',
      },
      { status: 400 },
    );
  }
}
