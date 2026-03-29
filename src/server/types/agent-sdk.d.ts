declare module '@veridex/agentic-payments' {
  export interface PaymentRecord {
    id: string;
    txHash: string;
    status: 'pending' | 'confirmed' | 'failed';
    chain: number;
    token: string;
    amount: bigint;
    recipient: string;
    protocol?: string;
    timestamp: number;
    sessionKeyHash?: string;
  }

  export class SolanaChainClient {
    constructor(config: {
      rpcUrl: string;
      programId: string;
      wormholeCoreBridge: string;
      tokenBridge: string;
      wormholeChainId: number;
      network: 'devnet' | 'mainnet';
    });

    getConnection(): {
      getSlot(commitment?: 'processed' | 'confirmed' | 'finalized'): Promise<number>;
    };
  }

  export class ComplianceExporter {
    exportToJSON(records: PaymentRecord[]): string;
    exportToCSV(records: PaymentRecord[]): string;
  }
}
