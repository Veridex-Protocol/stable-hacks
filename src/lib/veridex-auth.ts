export const DEFAULT_VERIDEX_RELAYER_API_URL =
  'https://relayer.veridex.network/api/v1';
export const DEFAULT_VERIDEX_AUTH_PORTAL_URL = 'https://auth.veridex.network';
export const DEFAULT_VERIDEX_APP_URL = 'https://veridex.network';
export const DEFAULT_AUTH_RELAY_PATH = '/api/auth/relay';

export function normalizeRelayerApiUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!trimmed) {
    return DEFAULT_VERIDEX_RELAYER_API_URL;
  }

  return /\/api\/v1$/i.test(trimmed) ? trimmed : `${trimmed}/api/v1`;
}

export function getVeridexRelayerApiUrl(): string {
  return normalizeRelayerApiUrl(
    process.env.VERIDEX_RELAYER_API_URL ||
      process.env.NEXT_PUBLIC_VERIDEX_RELAYER_API_URL ||
      process.env.NEXT_PUBLIC_RELAYER_URL ||
      DEFAULT_VERIDEX_RELAYER_API_URL,
  );
}

export function getVeridexAuthPortalUrl(): string {
  return process.env.NEXT_PUBLIC_VERIDEX_AUTH_PORTAL_URL || DEFAULT_VERIDEX_AUTH_PORTAL_URL;
}

export function getVeridexAppUrl(): string {
  return process.env.NEXT_PUBLIC_VERIDEX_APP_URL || DEFAULT_VERIDEX_APP_URL;
}

export function getAuthRelayPath(): string {
  return process.env.NEXT_PUBLIC_VERIDEX_AUTH_RELAY_PATH || DEFAULT_AUTH_RELAY_PATH;
}

export function isPortalPasskeyRegistrationEnabled(): boolean {
  const value = process.env.NEXT_PUBLIC_ENABLE_PORTAL_PASSKEY_REGISTRATION;
  return value === 'true';
}

export function getWorkspaceRegistrationReturnPath(): string {
  return '/auth?mode=signin&rail=veridex';
}
