import { SolanaService } from '../services/SolanaService';
import { ResourceValidationService } from '../services/ResourceValidationService';

async function main() {
  const solana = new SolanaService(process.env.SOLANA_RPC_URL);
  const validator = new ResourceValidationService(solana);
  const results = await validator.validateAll();

  console.table(
    results.map((result) => ({
      id: result.id,
      status: result.status,
      target: result.target,
      latencyMs: result.latencyMs ?? null,
      statusCode: result.statusCode ?? null,
      details: result.details,
    })),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
