import path from 'node:path';
import { CommerceService } from './services/CommerceService';
import { SolanaService } from './services/SolanaService';
import { TreasuryGuardService } from './services/TreasuryGuardService';
import { WorkspaceService } from './services/WorkspaceService';
import { DemoStore } from './store/DemoStore';

interface StablehacksRuntime {
  solana: SolanaService;
  treasuryGuard: TreasuryGuardService;
  workspaceService: WorkspaceService;
  commerceService: CommerceService;
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

    globalThis.__stablehacksRuntime__ = {
      solana,
      treasuryGuard,
      workspaceService,
      commerceService,
      store,
    };
  }

  return globalThis.__stablehacksRuntime__;
}
