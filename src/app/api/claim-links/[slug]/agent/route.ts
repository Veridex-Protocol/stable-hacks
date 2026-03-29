import { NextRequest, NextResponse } from 'next/server';
import { getServerRuntime } from '@/server/runtime';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const { slug } = await params;
  const origin = new URL(request.url).origin;
  const claimantAddress = request.nextUrl.searchParams.get('claimantAddress') || '';
  const recipientAddress =
    request.nextUrl.searchParams.get('recipientAddress') ||
    claimantAddress;
  const deadline =
    Number(request.nextUrl.searchParams.get('deadline') || 0) ||
    Date.now() + 5 * 60 * 1000;
  const { commerceService } = getServerRuntime();

  try {
    if (claimantAddress && recipientAddress) {
      const manifest = await commerceService.getAgentClaimManifest(
        slug,
        claimantAddress,
        recipientAddress,
        deadline,
        origin,
      );

      return NextResponse.json({
        success: true,
        manifest,
      });
    }

    const state = await commerceService.getPublicLinkState(slug, origin);
    return NextResponse.json({
      success: true,
      protocol: 'stablehacks-agent-claim',
      network: 'solana-devnet',
      endpoint: state.agentic.agentClaimEndpoint,
      link: state.link,
      instructions: 'Supply claimantAddress, recipientAddress, and deadline as query params to receive a signable manifest.',
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Agent claim manifest could not be created.',
      },
      { status: 400 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const { slug } = await params;
  const origin = new URL(request.url).origin;
  const body = await request.json().catch(() => null);
  const { commerceService } = getServerRuntime();

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ success: false, error: 'A JSON request body is required.' }, { status: 400 });
  }

  try {
    const state = await commerceService.claimPayoutLinkWithAgent(
      slug,
      {
        claimantAddress: String(body.claimantAddress || ''),
        recipientAddress: String(body.recipientAddress || ''),
        deadline: Number(body.deadline || 0),
        signature: String(body.signature || ''),
      },
      origin,
    );

    return NextResponse.json({
      success: true,
      protocol: 'stablehacks-agent-claim',
      settlementRail: 'agent-claim',
      state,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Agent claim failed.',
      },
      { status: 400 },
    );
  }
}
