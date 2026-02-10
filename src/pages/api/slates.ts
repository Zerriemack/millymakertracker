import type { APIRoute } from "astro";
import { prisma } from "../../lib/prisma";

function asInt(v: string | null) {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export const GET: APIRoute = async ({ url }) => {
  const sport = (url.searchParams.get("sport") ?? "NFL").toUpperCase();
  const year = asInt(url.searchParams.get("year")) ?? 2025;

  const lineupType = url.searchParams.get("lineupType"); // CLASSIC | SHOWDOWN
  const slateType = url.searchParams.get("slateType"); // MAIN | SHOWDOWN | TNF | SNF | MNF | SUPER_BOWL | OTHER
  const week = asInt(url.searchParams.get("week"));

  const q = (url.searchParams.get("q") ?? "").trim();
  const take = Math.min(asInt(url.searchParams.get("take")) ?? 50, 200);

  const season = await prisma.season.findUnique({
    where: { year_sport: { year, sport: sport as any } },
    select: { id: true, year: true, sport: true },
  });

  if (!season) {
    return new Response(JSON.stringify({ season: null, slates: [] }), {
      headers: { "content-type": "application/json" },
      status: 200,
    });
  }

  const slates = await prisma.slate.findMany({
    where: {
      seasonId: season.id,
      ...(lineupType ? { lineupType: lineupType as any } : {}),
      ...(slateType ? { slateType: slateType as any } : {}),
      ...(week !== null ? { week } : {}),
      ...(q
        ? {
            OR: [
              { slateKey: { contains: q, mode: "insensitive" } },
              { slateName: { contains: q, mode: "insensitive" } },
              { slateTag: { contains: q, mode: "insensitive" } },
              { slateGroup: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ slateDate: "desc" }, { week: "desc" }],
    take,
    select: {
      id: true,
      week: true,
      slateType: true,
      slateDate: true,
      lineupType: true,
      slateKey: true,
      slateName: true,
      slateTag: true,
      slateGroup: true,
    },
  });

  return new Response(JSON.stringify({ season, slates }), {
    headers: { "content-type": "application/json" },
  });
};
