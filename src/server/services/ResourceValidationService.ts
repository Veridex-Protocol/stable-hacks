import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { ResourceValidation } from '../types/index';
import { SolanaService } from './SolanaService';

const execFileAsync = promisify(execFile);
const RELAYER_API_FALLBACK = 'https://amused-kameko-veridex-demo-37453117.koyeb.app/api/v1';
const RELAYER_ROOT_CANDIDATES = Array.from(
  new Set(
    [
      process.env.VERIDEX_RELAYER_API_URL,
      RELAYER_API_FALLBACK,
    ]
      .filter((value): value is string => Boolean(value))
      .map((value) => value.replace(/\/api\/v1\/?$/, '')),
  ),
);

async function timed<T>(task: () => Promise<T>): Promise<{ result: T; latencyMs: number }> {
  const started = Date.now();
  const result = await task();
  return {
    result,
    latencyMs: Date.now() - started,
  };
}

export class ResourceValidationService {
  constructor(private readonly solana: SolanaService) {}

  async validateAll(): Promise<ResourceValidation[]> {
    const docsChecks = await Promise.all([
      this.validateUrl(
        'solana-quick-start',
        'Solana Quick Start',
        'docs',
        'https://solana.com/docs/intro/quick-start',
      ),
      this.validateUrl(
        'colosseum-cypherpunk-resources',
        'Colosseum Cypherpunk Resources',
        'docs',
        'https://colosseum.com/cypherpunk/resources',
      ),
      this.validateUrl(
        'circle-faucet',
        'Circle Public Faucet',
        'api',
        'https://faucet.circle.com/',
      ),
      this.validateRelayerHealth(),
    ]);

    const rpcCheck = await this.validateSolanaRpc();
    const sdkCheck = await this.validateSdkClient();
    const agentCheck = await this.validateAgentClient();

    return [rpcCheck, sdkCheck, agentCheck, ...docsChecks];
  }

  private async validateUrl(
    id: string,
    label: string,
    category: ResourceValidation['category'],
    target: string,
  ): Promise<ResourceValidation> {
    try {
      const { result, latencyMs } = await timed(async () =>
        fetch(target, {
          method: 'GET',
          redirect: 'follow',
          headers: {
            'user-agent': 'Veridex-Treasury-Guard/1.0 (+StableHacks-2026)',
            accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
          },
        }),
      );

      return {
        id,
        label,
        category,
        target,
        status: result.ok ? 'healthy' : 'degraded',
        statusCode: result.status,
        latencyMs,
        details: result.ok
          ? `Reached ${label} successfully.`
          : `Received HTTP ${result.status} from ${label}.`,
        checkedAt: Date.now(),
      };
    } catch (error) {
      const curlFallback = await this.validateUrlWithCurl(id, label, category, target);
      if (curlFallback) {
        return curlFallback;
      }

      return {
        id,
        label,
        category,
        target,
        status: 'failed',
        details: error instanceof Error ? error.message : 'Unknown network error.',
        checkedAt: Date.now(),
      };
    }
  }

  private async validateUrlWithCurl(
    id: string,
    label: string,
    category: ResourceValidation['category'],
    target: string,
  ): Promise<ResourceValidation | null> {
    try {
      const { result, latencyMs } = await timed(async () => {
        const { stdout } = await execFileAsync('curl', [
          '-I',
          '-L',
          '-A',
          'Veridex-Treasury-Guard/1.0 (+StableHacks-2026)',
          target,
        ]);
        return stdout;
      });

      const match = result.match(/HTTP\/[0-9.]+\s+(\d{3})/g);
      const finalStatus = match?.at(-1)?.match(/(\d{3})/)?.[1];
      const statusCode = finalStatus ? Number(finalStatus) : undefined;

      return {
        id,
        label,
        category,
        target,
        status: statusCode && statusCode < 400 ? 'healthy' : 'failed',
        statusCode,
        latencyMs,
        details: statusCode
          ? `Validated ${label} via curl fallback with HTTP ${statusCode}.`
          : `Validated ${label} via curl fallback.`,
        checkedAt: Date.now(),
      };
    } catch {
      return null;
    }
  }

  private async validateSolanaRpc(): Promise<ResourceValidation> {
    const target = this.solana.getRpcUrl();

    try {
      const { result, latencyMs } = await timed(async () => {
        const response = await fetch(target, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 'stablehacks-resource-check',
            method: 'getSlot',
          }),
        });

        const json = (await response.json()) as { result?: number; error?: { message?: string } };
        return {
          ok: response.ok,
          status: response.status,
          slot: json.result,
          error: json.error?.message,
        };
      });

      return {
        id: 'solana-devnet-rpc',
        label: 'Solana Devnet RPC',
        category: 'rpc',
        target,
        status: result.ok && typeof result.slot === 'number' ? 'healthy' : 'failed',
        statusCode: result.status,
        latencyMs,
        details:
          typeof result.slot === 'number'
            ? `JSON-RPC getSlot returned slot ${result.slot}.`
            : `RPC validation failed${result.error ? `: ${result.error}` : '.'}`,
        checkedAt: Date.now(),
      };
    } catch (error) {
      return {
        id: 'solana-devnet-rpc',
        label: 'Solana Devnet RPC',
        category: 'rpc',
        target,
        status: 'failed',
        details: error instanceof Error ? error.message : 'Unknown RPC validation error.',
        checkedAt: Date.now(),
      };
    }
  }

  private async validateRelayerHealth(): Promise<ResourceValidation> {
    for (const root of RELAYER_ROOT_CANDIDATES) {
      const target = `${root}/health`;

      try {
        const { result, latencyMs } = await timed(async () => {
          const response = await fetch(target, {
            headers: {
              'user-agent': 'Veridex-Treasury-Guard/1.0 (+StableHacks-2026)',
              accept: 'application/json,text/plain;q=0.9,*/*;q=0.8',
            },
          });
          const payload = (await response.json().catch(() => null)) as
            | { status?: string; chains?: Record<string, string> }
            | null;
          return {
            ok: response.ok,
            status: response.status,
            payload,
          };
        });

        const chainSummary = result.payload?.chains
          ? Object.entries(result.payload.chains)
              .map(([chain, status]) => `${chain}:${status}`)
              .join(', ')
          : 'No chain summary returned.';

        return {
          id: 'veridex-relayer-health',
          label: 'Veridex Relayer Health',
          category: 'api',
          target,
          status: result.ok ? 'healthy' : 'degraded',
          statusCode: result.status,
          latencyMs,
          details: result.ok
            ? `Relayer status ${result.payload?.status || 'healthy'}; ${chainSummary}`
            : `Relayer health returned HTTP ${result.status}.`,
          checkedAt: Date.now(),
        };
      } catch {
        continue;
      }
    }

    return {
      id: 'veridex-relayer-health',
      label: 'Veridex Relayer Health',
      category: 'api',
      target: `${RELAYER_ROOT_CANDIDATES[0] || 'unknown'}/health`,
      status: 'failed',
      details: 'All configured relayer health checks failed.',
      checkedAt: Date.now(),
    };
  }

  private async validateSdkClient(): Promise<ResourceValidation> {
    try {
      const { result, latencyMs } = await timed(() => this.solana.getCurrentSlot());

      return {
        id: 'veridex-sdk-solana-spoke',
        label: '@veridex/sdk Solana spoke',
        category: 'sdk',
        target: this.solana.getRpcUrl(),
        status: result > 0 ? 'healthy' : 'failed',
        latencyMs,
        details: `SolanaClient observed slot ${result}.`,
        checkedAt: Date.now(),
      };
    } catch (error) {
      return {
        id: 'veridex-sdk-solana-spoke',
        label: '@veridex/sdk Solana spoke',
        category: 'sdk',
        target: this.solana.getRpcUrl(),
        status: 'failed',
        details: error instanceof Error ? error.message : 'Unknown SDK validation error.',
        checkedAt: Date.now(),
      };
    }
  }

  private async validateAgentClient(): Promise<ResourceValidation> {
    try {
      const { result, latencyMs } = await timed(() => this.solana.getAgentObservedSlot());

      return {
        id: 'veridex-agent-sdk-solana-spoke',
        label: '@veridex/agentic-payments Solana spoke',
        category: 'agent-sdk',
        target: this.solana.getRpcUrl(),
        status: result > 0 ? 'healthy' : 'failed',
        latencyMs,
        details: `SolanaChainClient observed slot ${result}.`,
        checkedAt: Date.now(),
      };
    } catch (error) {
      return {
        id: 'veridex-agent-sdk-solana-spoke',
        label: '@veridex/agentic-payments Solana spoke',
        category: 'agent-sdk',
        target: this.solana.getRpcUrl(),
        status: 'failed',
        details: error instanceof Error ? error.message : 'Unknown Agent SDK validation error.',
        checkedAt: Date.now(),
      };
    }
  }
}
