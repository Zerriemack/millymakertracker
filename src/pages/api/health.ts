import { prisma } from "../../lib/prisma";

export async function GET({ url }: { url: URL }) {
  const debug = url.searchParams.get("debug") === "1";

  try {
    const contests = await prisma.contest.count();

    return new Response(JSON.stringify({
      ok: true,
      contests,
      env: debug ? {
        hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
        hasDirectUrl: Boolean(process.env.DIRECT_URL),
        nodeEnv: process.env.NODE_ENV ?? null
      } : undefined
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({
      ok: false,
      error: {
        name: e?.name ?? null,
        message: e?.message ?? String(e),
        stack: debug ? (e?.stack ?? null) : null
      },
      env: debug ? {
        hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
        hasDirectUrl: Boolean(process.env.DIRECT_URL),
        nodeEnv: process.env.NODE_ENV ?? null
      } : undefined
    }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
