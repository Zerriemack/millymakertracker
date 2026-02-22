import type { APIRoute } from "astro";
import { prisma } from "../../../../lib/prisma";

const ALLOWED = new Set(["QB", "RB", "WR", "TE", "FLEX", "DST"]);

function n(v: any) {
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

export const GET: APIRoute = async ({ url }) => {
  const spotRaw = String(url.searchParams.get("spot") ?? "").trim().toUpperCase();
  if (!ALLOWED.has(spotRaw)) {
    return new Response(JSON.stringify({ ok: false, error: "Invalid spot. Use QB,RB,WR,TE,FLEX,DST" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const yearParam = url.searchParams.get("year");
  const year = yearParam ? n(yearParam) : null;

  const items = await prisma.lineupItem.findMany({
    where: {
      rosterSpot: spotRaw as any,
      player: { sport: "NFL" },
      lineup: {
        lineupType: "CLASSIC",
        winner: {
          contest: {
            slate: {
              season: {
                sport: "NFL",
                ...(typeof year === "number" ? { year } : {}),
              },
            },
          },
        },
      },
    } as any,
    select: {
      rosterSpot: true,
      salary: true,
      points: true,
      ownershipClassicBp: true,
      player: {
        select: {
          name: true,
          position: true,
          team: { select: { abbreviation: true } },
        },
      },
      lineup: {
        select: {
          winner: {
            select: {
              username: true,
              points: true,
              contest: {
                select: {
                  topPrizeCents: true,
                  slate: {
                    select: {
                      id: true,
                      week: true,
                      slateType: true,
                      slateDate: true,
                      season: { select: { year: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: [{ lineup: { winner: { contest: { slate: { slateDate: "desc" } } } } }],
  });

  const rows = items.map((it) => {
    const slate = it.lineup?.winner?.contest?.slate;
    const seasonYear = slate?.season?.year ?? null;

    const slateId = slate?.id ?? null;
    const link = slateId && typeof seasonYear === "number" ? `/nfl/${seasonYear}/slate/${slateId}` : "";

    const ownBp = typeof it.ownershipClassicBp === "number" ? it.ownershipClassicBp : null;
    const ownPct = ownBp === null ? null : ownBp / 100;

    return {
      year: seasonYear,
      week: slate?.week ?? null,
      slateType: slate?.slateType ?? null,
      slateDate: slate?.slateDate ?? null,
      topPrizeCents: it.lineup?.winner?.contest?.topPrizeCents ?? null,
      link,
      username: it.lineup?.winner?.username ?? null,
      winnerPoints: it.lineup?.winner?.points ?? null,
      rosterSpot: it.rosterSpot,
      player: it.player?.name ?? null,
      position: it.player?.position ?? null,
      team: it.player?.team?.abbreviation ?? null,
      salary: it.salary ?? null,
      points: it.points ?? null,
      ownPct,
    };
  });

  return new Response(JSON.stringify({ ok: true, spot: spotRaw, year, rows }), {
    headers: { "content-type": "application/json" },
  });
};