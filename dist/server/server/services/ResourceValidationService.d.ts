import type { ResourceValidation } from '../types/index.js';
import { SolanaService } from './SolanaService.js';
export declare class ResourceValidationService {
    private readonly solana;
    constructor(solana: SolanaService);
    validateAll(): Promise<ResourceValidation[]>;
    private validateUrl;
    private validateUrlWithCurl;
    private validateSolanaRpc;
    private validateRelayerHealth;
    private validateSdkClient;
    private validateAgentClient;
}
