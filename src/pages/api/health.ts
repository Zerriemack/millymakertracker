import { prisma } from "../../lib/prisma";

function safeDbInfo() {
  try {
    const raw = process.env.DATABASE_URL || "";
    const u = new URL(raw);
    return {
      host: u.hostname,
      port: u.port || null,
      db: (u.pathname || "").replace("/", "") || null,
      hasSslmodeParam: u.searchParams.has("sslmode"),
    };
  } catch {
    return { host: null, port: null, db: null, hasSslmodeParam: null };
  }
}

export async function GET({ url }: { url: URL }) {
  const debug = url.searchParams.get("debug") === "1";

  try {
    const contests = await prisma.contest.count();

    return new Response(
      JSON.stringify({
        ok: true,
        contests,
        db: debug ? safeDbInfo() : undefined,
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: {
          name: e?.name ?? null,
          message: e?.message ?? String(e),
        },
        db: debug ? safeDbInfo() : undefined,
        env: debug
          ? {
              hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
              hasDirectUrl: Boolean(process.env.DIRECT_URL),
              nodeEnv: process.env.NODE_ENV ?? null,
            }
          : undefined,
      }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
}
