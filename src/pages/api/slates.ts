import type { APIRoute } from "astro";
import { prisma } from "../../lib/prisma";

function toInt(v: string | null): number | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function up(v: string | null): string {
  return String(v ?? "").trim().toUpperCase();
}

export const GET: APIRoute = async ({ url }) => {
  try {
    const sportRaw = up(url.searchParams.get("sport") || "NFL");
    const sport = sportRaw === "CFB" ? "CFB" : "NFL";

    const year = toInt(url.searchParams.get("year"));
    const week = toInt(url.searchParams.get("week"));

    const slateTypeRaw = up(url.searchParams.get("slateType") || "");
    const slateType = slateTypeRaw === "MAIN" || slateTypeRaw === "SHOWDOWN" ? slateTypeRaw : "";

    const lineupTypeRaw = up(url.searchParams.get("lineupType") || "");
    const lineupType = lineupTypeRaw === "CLASSIC" || lineupTypeRaw === "SHOWDOWN" ? lineupTypeRaw : "";

    const q = String(url.searchParams.get("q") || "").trim();
    const limit = Math.min(toInt(url.searchParams.get("limit")) || 2000, 5000);

    const where: any = {
      season: {
        sport,
        ...(year ? { year } : {}),
      },
      ...(week ? { week } : {}),
      ...(slateType ? { slateType } : {}),
      ...(lineupType ? { lineupType } : {}),
    };

    if (q) {
      where.OR = [
        { slateKey: { contains: q, mode: "insensitive" } },
        { slateTag: { contains: q, mode: "insensitive" } },
        { slateName: { contains: q, mode: "insensitive" } },
        {
          contests: {
            some: { contestName: { contains: q, mode: "insensitive" } },
          },
        },
      ];
    }

    const slates = await prisma.slate.findMany({
      where,
      take: limit,
      orderBy: [{ week: "desc" }, { id: "desc" }],
      select: {
        id: true,
        week: true,
        slateType: true,
        lineupType: true,
        slateTag: true,
        slateKey: true,
        slateName: true,
        season: { select: { sport: true, year: true } },
        contests: {
          take: 1,
          orderBy: { id: "asc" },
          select: {
            contestName: true,
            topPrizeCents: true,
            winners: {
              take: 1,
              orderBy: { id: "asc" },
              select: { username: true, points: true },
            },
          },
        },
      },
    });

    return new Response(JSON.stringify({ count: slates.length, slates }, null, 2), {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  } catch (err: any) {
    console.error("[api/slates] error:", err);
    return new Response(
      JSON.stringify(
        {
          error: "api/slates failed",
          name: err?.name ?? null,
          message: err?.message ?? String(err),
          stack: err?.stack ?? null,
        },
        null,
        2
      ),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
};
