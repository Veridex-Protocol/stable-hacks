import { config as loadEnv } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

loadEnv({ path: '.env.local', quiet: true });
loadEnv({ path: '.env', quiet: true });
loadEnv({ quiet: true });

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

function getPool(): Pool {
  if (globalThis.__pgPool) {
    return globalThis.__pgPool;
  }

  const connectionString = process.env.DATABASE_URL ?? process.env.FRONTIER_DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL or FRONTIER_DATABASE_URL environment variable is not set');
  }

  const lower = connectionString.toLowerCase();
  const useSsl = !(
    lower.includes('localhost') ||
    lower.includes('127.0.0.1') ||
    lower.includes('postgresql://localhost') ||
    lower.includes('postgres://localhost')
  );

  const pool = new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 10_000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  });

  pool.on('error', (err) => {
    console.error('[pg Pool] Idle client error:', err.message);
  });

  if (process.env.NODE_ENV !== 'production') {
    globalThis.__pgPool = pool;
  }

  return pool;
}

function createPrismaClient(): PrismaClient {
  const pool = getPool();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- @types/pg version mismatch between root and @prisma/adapter-pg
  const adapter = new PrismaPg(pool as any);

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}

const prismaClient = globalThis.__prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prismaClient;
}

export const db = prismaClient;
export const prisma = prismaClient;
