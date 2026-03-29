export interface SerializedPasskeyCredential {
  credentialId: string;
  publicKeyX: string;
  publicKeyY: string;
  keyHash: string;
}

export interface LocalWorkspaceSession {
  id: string;
  source: "local";
  keyHash: string;
  appOrigin: string;
  permissions: string[];
  expiresAt: number;
  createdAt: number;
}

export interface LocalPasskeyResult {
  credential: SerializedPasskeyCredential;
  walletAddress: string;
  authSession: LocalWorkspaceSession;
}

export interface LocalPasskeyTransferInput {
  recipientAddress: string;
  token: string;
  amount: bigint;
  relayerApiUrl: string;
}

export interface LocalPasskeyTransferResult {
  walletAddress: string;
  transactionHash: string;
  sequence: string;
}

interface LocalPasskeyOptions {
  username: string;
  displayName: string;
  permissions: string[];
  expiresInMs: number;
}

interface PasskeyCredentialShape {
  credentialId: string;
  publicKeyX: bigint;
  publicKeyY: bigint;
  keyHash: string;
}

const LOCAL_SESSION_PREFIX = "local_";

function serializeCredential(credential: PasskeyCredentialShape): SerializedPasskeyCredential {
  return {
    credentialId: credential.credentialId,
    publicKeyX: credential.publicKeyX.toString(),
    publicKeyY: credential.publicKeyY.toString(),
    keyHash: credential.keyHash,
  };
}

function createLocalSession(keyHash: string, permissions: string[], expiresInMs: number): LocalWorkspaceSession {
  const createdAt = Date.now();
  return {
    id: `${LOCAL_SESSION_PREFIX}${crypto.randomUUID()}`,
    source: "local",
    keyHash,
    appOrigin: window.location.origin,
    permissions,
    createdAt,
    expiresAt: createdAt + expiresInMs,
  };
}

function normalizeRelayerBaseUrl(relayerApiUrl: string): string {
  return relayerApiUrl.trim().replace(/\/api\/v1$/i, '').replace(/\/+$/, '');
}

async function createLocalSdk(relayerApiUrl?: string) {
  const { createSDK } = await import("@veridex/sdk");
  return createSDK("solana", {
    network: "testnet",
    ...(relayerApiUrl ? { relayerUrl: normalizeRelayerBaseUrl(relayerApiUrl) } : {}),
  });
}

export async function registerLocalPasskeyWallet(
  options: LocalPasskeyOptions,
): Promise<LocalPasskeyResult> {
  const sdk = await createLocalSdk();
  const credential = await sdk.passkey.register(options.username, options.displayName);
  sdk.passkey.saveToLocalStorage();

  return {
    credential: serializeCredential(credential),
    walletAddress: sdk.getVaultAddress(),
    authSession: createLocalSession(credential.keyHash, options.permissions, options.expiresInMs),
  };
}

export async function reconnectLocalPasskeyWallet(
  options: Pick<LocalPasskeyOptions, "permissions" | "expiresInMs">,
): Promise<LocalPasskeyResult> {
  const sdk = await createLocalSdk();
  const { credential } = await sdk.passkey.authenticate();
  sdk.setCredential(credential);
  sdk.passkey.saveToLocalStorage();

  return {
    credential: serializeCredential(credential),
    walletAddress: sdk.getVaultAddress(),
    authSession: createLocalSession(credential.keyHash, options.permissions, options.expiresInMs),
  };
}

export async function sendLocalPasskeyWalletTransfer(
  input: LocalPasskeyTransferInput,
): Promise<LocalPasskeyTransferResult> {
  if (!input.relayerApiUrl.trim()) {
    throw new Error("A Veridex relayer URL is required before sending from the passkey wallet.");
  }

  const sdk = await createLocalSdk(input.relayerApiUrl);
  const { credential } = await sdk.passkey.authenticate();
  sdk.setCredential(credential);
  sdk.passkey.saveToLocalStorage();

  const result = await sdk.transferViaRelayer({
    targetChain: 1,
    token: input.token,
    recipient: input.recipientAddress,
    amount: input.amount,
  });

  return {
    walletAddress: sdk.getVaultAddress(),
    transactionHash: result.transactionHash,
    sequence: result.sequence.toString(),
  };
}
