import fs from 'node:fs';
import https from 'node:https';
import path from 'node:path';
import { SIX_FOREX_IDENTIFIERS } from './sixIdentifiers';

export interface SixForexRate {
  pair: string;
  valorBc: string;
  bid: number | null;
  ask: number | null;
  last: number | null;
  high: number | null;
  low: number | null;
  timestamp: number;
}

export interface SixInstrument {
  valor: string;
  name: string;
  isin: string | null;
  symbol: string | null;
  currency: string | null;
  market: string | null;
  bc: string | null;
}

export interface SixIntradaySnapshot {
  valorBc: string;
  name: string | null;
  last: number | null;
  bid: number | null;
  ask: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  volume: number | null;
  currency: string | null;
  timestamp: number;
}

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const CACHE_TTL_INTRADAY = 60_000;
const CACHE_TTL_REFERENCE = 300_000;

export class SixMarketDataService {
  private readonly baseUrl: string;
  private readonly agent: https.Agent | null;
  private readonly cache = new Map<string, CacheEntry<unknown>>();
  private readonly available: boolean;

  constructor(options?: {
    certPath?: string;
    keyPath?: string;
    pfxPath?: string;
    passphrasePath?: string;
    baseUrl?: string;
  }) {
    this.baseUrl = options?.baseUrl ?? process.env.SIX_API_BASE_URL ?? 'https://api.six-group.com/web/v2';

    const certPath = options?.certPath ?? process.env.SIX_API_CERT_PATH;
    const keyPath = options?.keyPath ?? process.env.SIX_API_KEY_PATH;
    const pfxPath = options?.pfxPath ?? process.env.SIX_API_PFX_PATH;
    const passphrasePath = options?.passphrasePath ?? process.env.SIX_API_PFX_PASSWORD_PATH;

    try {
      if (pfxPath) {
        const resolvedPfx = path.isAbsolute(pfxPath) ? pfxPath : path.resolve(process.cwd(), pfxPath);
        const pfx = fs.readFileSync(resolvedPfx);
        const passphrase = passphrasePath
          ? fs.readFileSync(
              path.isAbsolute(passphrasePath) ? passphrasePath : path.resolve(process.cwd(), passphrasePath),
              'utf8',
            ).trim()
          : undefined;

        this.agent = new https.Agent({
          pfx,
          passphrase,
          rejectUnauthorized: true,
          keepAlive: true,
        });
        this.available = true;
        return;
      }

      if (certPath && keyPath) {
        const resolvedCert = path.isAbsolute(certPath) ? certPath : path.resolve(process.cwd(), certPath);
        const resolvedKey = path.isAbsolute(keyPath) ? keyPath : path.resolve(process.cwd(), keyPath);

        const cert = fs.readFileSync(resolvedCert);
        const key = fs.readFileSync(resolvedKey);
        this.agent = new https.Agent({
          cert,
          key,
          rejectUnauthorized: true,
          keepAlive: true,
        });
        this.available = true;
        return;
      }

      this.agent = null;
      this.available = false;
    } catch (err) {
      console.warn('[SixMarketData] Failed to load mTLS certificates:', err instanceof Error ? err.message : err);
      this.agent = null;
      this.available = false;
    }
  }

  isAvailable(): boolean {
    return this.available;
  }

  private getCached<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  private setCache<T>(key: string, data: T, ttl: number): void {
    this.cache.set(key, { data, expiresAt: Date.now() + ttl });
  }

  private async fetchApi(urlPath: string): Promise<unknown> {
    if (!this.agent) {
      throw new Error('SIX API not configured — mTLS certificates missing.');
    }

    const url = `${this.baseUrl}${urlPath}`;
    const requestUrl = new URL(url);

    return new Promise((resolve, reject) => {
      const request = https.request(
        requestUrl,
        {
          method: 'GET',
          agent: this.agent ?? undefined,
          headers: {
            Accept: 'application/json',
          },
        },
        (response) => {
          const chunks: Buffer[] = [];
          response.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
          response.on('end', () => {
            const body = Buffer.concat(chunks).toString('utf8');
            const status = response.statusCode ?? 0;

            if (status < 200 || status >= 300) {
              reject(new Error(`SIX API ${status}: ${body.slice(0, 200)}`));
              return;
            }

            try {
              resolve(JSON.parse(body));
            } catch (error) {
              reject(new Error(`SIX API returned non-JSON payload: ${error instanceof Error ? error.message : String(error)}`));
            }
          });
        },
      );

      request.setTimeout(15_000, () => {
        request.destroy(new Error('SIX API request timed out after 15 seconds.'));
      });

      request.on('error', reject);
      request.end();
    });
  }

  async getForexRate(pair: string): Promise<SixForexRate> {
    const upperPair = pair.toUpperCase();
    const valorBc = SIX_FOREX_IDENTIFIERS[upperPair];
    if (!valorBc) {
      throw new Error(`Unknown forex pair: ${pair}. Available: ${Object.keys(SIX_FOREX_IDENTIFIERS).join(', ')}`);
    }

    const cacheKey = `forex:${valorBc}`;
    const cached = this.getCached<SixForexRate>(cacheKey);
    if (cached) return cached;

    const raw = await this.fetchApi(
      `/listings/marketData/intradaySnapshot?scheme=VALOR_BC&ids=${valorBc}&preferredLanguage=EN`,
    ) as Record<string, unknown>;

    const rate = this.parseIntradayToForex(raw, upperPair, valorBc);
    this.setCache(cacheKey, rate, CACHE_TTL_INTRADAY);
    return rate;
  }

  async getAllForexRates(): Promise<SixForexRate[]> {
    const cacheKey = 'forex:all';
    const cached = this.getCached<SixForexRate[]>(cacheKey);
    if (cached) return cached;

    const ids = Object.values(SIX_FOREX_IDENTIFIERS).join(',');
    const raw = await this.fetchApi(
      `/listings/marketData/intradaySnapshot?scheme=VALOR_BC&ids=${ids}&preferredLanguage=EN`,
    ) as Record<string, unknown>;

    const rates = this.parseAllForexRates(raw);
    this.setCache(cacheKey, rates, CACHE_TTL_INTRADAY);
    return rates;
  }

  async getIntradaySnapshot(valorBc: string): Promise<SixIntradaySnapshot> {
    const cacheKey = `snapshot:${valorBc}`;
    const cached = this.getCached<SixIntradaySnapshot>(cacheKey);
    if (cached) return cached;

    const raw = await this.fetchApi(
      `/listings/marketData/intradaySnapshot?scheme=VALOR_BC&ids=${valorBc}&preferredLanguage=EN`,
    ) as Record<string, unknown>;

    const snapshot = this.parseIntradaySnapshot(raw, valorBc);
    this.setCache(cacheKey, snapshot, CACHE_TTL_INTRADAY);
    return snapshot;
  }

  async searchInstruments(text: string, size = 5): Promise<SixInstrument[]> {
    const cacheKey = `search:${text}:${size}`;
    const cached = this.getCached<SixInstrument[]>(cacheKey);
    if (cached) return cached;

    const raw = await this.fetchApi(
      `/search/freeTextSearch/instruments?text=${encodeURIComponent(text)}&size=${size}&preferredLanguage=EN`,
    ) as Record<string, unknown>;

    const instruments = this.parseInstrumentSearch(raw);
    this.setCache(cacheKey, instruments, CACHE_TTL_REFERENCE);
    return instruments;
  }

  // ---------------------------------------------------------------------------
  // Parsers — defensive, handles various SIX response shapes
  // ---------------------------------------------------------------------------

  private parseIntradayToForex(raw: Record<string, unknown>, pair: string, valorBc: string): SixForexRate {
    const listing = this.extractFirstListing(raw);
    return {
      pair,
      valorBc,
      bid: this.safeNumber(listing, 'bidPrice'),
      ask: this.safeNumber(listing, 'askPrice'),
      last: this.safeNumber(listing, 'lastTradedPrice') ?? this.safeNumber(listing, 'closingPrice'),
      high: this.safeNumber(listing, 'highPrice'),
      low: this.safeNumber(listing, 'lowPrice'),
      timestamp: Date.now(),
    };
  }

  private parseAllForexRates(raw: Record<string, unknown>): SixForexRate[] {
    const listings = this.extractListings(raw);
    const pairsByVb = Object.fromEntries(Object.entries(SIX_FOREX_IDENTIFIERS).map(([k, v]) => [v, k]));

    return listings.map((listing: Record<string, unknown>) => {
      const vb = String(listing.valorBc ?? listing.valor_bc ?? '');
      return {
        pair: pairsByVb[vb] ?? vb,
        valorBc: vb,
        bid: this.safeNumber(listing, 'bidPrice'),
        ask: this.safeNumber(listing, 'askPrice'),
        last: this.safeNumber(listing, 'lastTradedPrice') ?? this.safeNumber(listing, 'closingPrice'),
        high: this.safeNumber(listing, 'highPrice'),
        low: this.safeNumber(listing, 'lowPrice'),
        timestamp: Date.now(),
      };
    });
  }

  private parseIntradaySnapshot(raw: Record<string, unknown>, valorBc: string): SixIntradaySnapshot {
    const listing = this.extractFirstListing(raw);
    return {
      valorBc,
      name: listing.shortName as string ?? listing.instrumentName as string ?? null,
      last: this.safeNumber(listing, 'lastTradedPrice') ?? this.safeNumber(listing, 'closingPrice'),
      bid: this.safeNumber(listing, 'bidPrice'),
      ask: this.safeNumber(listing, 'askPrice'),
      open: this.safeNumber(listing, 'openingPrice'),
      high: this.safeNumber(listing, 'highPrice'),
      low: this.safeNumber(listing, 'lowPrice'),
      volume: this.safeNumber(listing, 'accumulatedVolume'),
      currency: listing.currency as string ?? null,
      timestamp: Date.now(),
    };
  }

  private parseInstrumentSearch(raw: Record<string, unknown>): SixInstrument[] {
    const results = (raw.searchResults ?? raw.results ?? []) as Record<string, unknown>[];
    if (!Array.isArray(results)) return [];

    return results.map((r) => ({
      valor: String(r.valor ?? r.valorNumber ?? ''),
      name: String(r.name ?? r.instrumentName ?? ''),
      isin: (r.isin as string) ?? null,
      symbol: (r.symbol as string) ?? (r.ticker as string) ?? null,
      currency: (r.currency as string) ?? null,
      market: (r.marketName as string) ?? null,
      bc: (r.bc as string) ?? null,
    }));
  }

  private extractListings(raw: Record<string, unknown>): Record<string, unknown>[] {
    const data = raw.data as Record<string, unknown> | undefined;
    if (data && Array.isArray(data.listings)) return data.listings;
    if (Array.isArray(raw.listings)) return raw.listings as Record<string, unknown>[];
    if (Array.isArray(data)) return data as unknown as Record<string, unknown>[];
    if (Array.isArray(raw)) return raw as unknown as Record<string, unknown>[];
    return [];
  }

  private extractFirstListing(raw: Record<string, unknown>): Record<string, unknown> {
    const listings = this.extractListings(raw);
    return listings[0] ?? {};
  }

  private safeNumber(obj: Record<string, unknown>, key: string): number | null {
    const val = obj[key];
    if (val === null || val === undefined) return null;
    const n = Number(val);
    return Number.isFinite(n) ? n : null;
  }
}
