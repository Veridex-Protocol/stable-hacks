import path from 'node:path';
import { CommerceService } from './services/CommerceService';
import { SixMarketDataService } from './services/SixMarketDataService';
import { SolanaService } from './services/SolanaService';
import { TreasuryGuardService } from './services/TreasuryGuardService';
import { WorkspaceService } from './services/WorkspaceService';
import { DemoStore } from './store/DemoStore';

interface StablehacksRuntime {
  solana: SolanaService;
  treasuryGuard: TreasuryGuardService;
  workspaceService: WorkspaceService;
  commerceService: CommerceService;
  marketData: SixMarketDataService;
  store: DemoStore;
}

declare global {
  var __stablehacksRuntime__: StablehacksRuntime | undefined;
}

export function getServerRuntime(): StablehacksRuntime {
  if (!globalThis.__stablehacksRuntime__) {
    const solana = new SolanaService(process.env.SOLANA_RPC_URL);
    const dataFile = path.resolve(process.cwd(), '.data/stablehacks-state.json');
    const store = new DemoStore(dataFile, solana.getRpcUrl(), solana.getExplorerBaseUrl());
    const treasuryGuard = new TreasuryGuardService(store, solana);
    const workspaceService = new WorkspaceService(solana, treasuryGuard);
    const commerceService = new CommerceService(solana, treasuryGuard);
    const marketData = new SixMarketDataService({
      cert: process.env.SIX_API_CERT,
      key: process.env.SIX_API_KEY,
      pfx: process.env.SIX_API_PFX,
      passphrase: process.env.SIX_API_PFX_PASSWORD,
      certPath: process.env.SIX_API_CERT_PATH,
      keyPath: process.env.SIX_API_KEY_PATH,
      pfxPath: process.env.SIX_API_PFX_PATH,
      passphrasePath: process.env.SIX_API_PFX_PASSWORD_PATH,
      baseUrl: process.env.SIX_API_BASE_URL,
    });

    globalThis.__stablehacksRuntime__ = {
      solana,
      treasuryGuard,
      workspaceService,
      commerceService,
      marketData,
      store,
    };
  }

  return globalThis.__stablehacksRuntime__;
}
