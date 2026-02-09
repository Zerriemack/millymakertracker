import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
export { renderers } from '../../renderers.mjs';

const { Pool } = pg;
const globalForPrisma = globalThis;
const pool = globalForPrisma.pool ?? new Pool({
  connectionString: process.env.DATABASE_URL
});
if (process.env.NODE_ENV !== "production") globalForPrisma.pool = pool;
const adapter = new PrismaPg(pool);
const prisma = globalForPrisma.prisma ?? new PrismaClient({
  adapter
});
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

async function GET() {
  const contests = await prisma.contest.count();
  return new Response(JSON.stringify({ ok: true, contests }), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  GET
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
