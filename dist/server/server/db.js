import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
const globalForPrisma = globalThis;
function getPool() {
    if (globalForPrisma.pgPool) {
        return globalForPrisma.pgPool;
    }
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 10,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 10_000,
    });
    if (process.env.NODE_ENV !== 'production') {
        globalForPrisma.pgPool = pool;
    }
    return pool;
}
function createPrismaClient() {
    const adapter = new PrismaPg(getPool());
    return new PrismaClient({
        adapter,
        log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
}
export const prisma = globalForPrisma.prisma || createPrismaClient();
if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
}
