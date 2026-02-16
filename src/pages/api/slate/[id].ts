import type { APIRoute } from "astro";
import { prisma } from "../../../lib/prisma";

function bpToPct(bp: number | null | undefined): number | null {
  if (typeof bp !== "number") return null;
  return bp / 100;
}

function lineupItemOwnershipPct(it: any): number | null {
  const spot = String(it.rosterSpot || "").toUpperCase();

  const bp =
    spot === "CAPTAIN"
      ? it.ownershipCaptainBp
      : spot === "FLEX"
        ? it.ownershipFlexBp
        : it.ownershipClassicBp;

  return bpToPct(bp);
}

function orderLineupItems(items: any[]): any[] {
  const rank = (spot: string) => {
    const s = String(spot || "").toUpperCase();
    if (s === "CAPTAIN") return 0;
    if (s === "FLEX") return 1;
    return 2;
  };

  return [...items].sort((a, b) => {
    const ra = rank(a.rosterSpot);
    const rb = rank(b.rosterSpot);
    if (ra !== rb) return ra - rb;
    return (a.slotIndex ?? 0) - (b.slotIndex ?? 0);
  });
}

export const GET: APIRoute = async ({ params }) => {
  try {
    const id = params.id;
    if (!id) {
      return new Response(JSON.stringify({ error: "Missing id" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const slate = await prisma.slate.findUnique({
      where: { id },
      include: {
        season: true,
        contests: {
          include: {
            analysis: true,
            winners: {
              include: {
                lineup: {
                  include: {
                    items: {
                      include: {
                        player: {
                          include: { team: true },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!slate) {
      return new Response(JSON.stringify({ error: "Slate not found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    }

    const contestRaw = slate.contests?.[0] ?? null;
    const winnerRaw = contestRaw?.winners?.[0] ?? null;
    const lineupRaw = winnerRaw?.lineup ?? null;

    const itemsRaw = lineupRaw?.items ?? [];
    const itemsOrdered = orderLineupItems(itemsRaw).map((it: any) => ({
      id: it.id,
      rosterSpot: it.rosterSpot,
      slotIndex: it.slotIndex,
      salary: it.salary,
      points: it.points,
      ownershipPercent: lineupItemOwnershipPct(it),
      player: {
        id: it.player?.id ?? null,
        name: it.player?.name ?? null,
        position: it.player?.position ?? null,
        team: {
          abbreviation: it.player?.team?.abbreviation ?? null,
          name: it.player?.team?.name ?? null,
        },
      },
      // convenience fields, used by your slate page table already
      name: it.player?.name ?? null,
      position: it.player?.position ?? null,
      team: it.player?.team?.abbreviation ?? null,
    }));

    const sportLower = String(slate.season.sport).toLowerCase();
    const imgUrlPng = `/slates/${sportLower}/${slate.season.year}/${slate.slateKey}.png`;
    const imgUrlJpg = `/slates/${sportLower}/${slate.season.year}/${slate.slateKey}.jpg`;

    const contest =
      contestRaw
        ? {
            id: contestRaw.id,
            site: contestRaw.site,
            contestName: contestRaw.contestName,
            siteContestId: contestRaw.siteContestId,
            entries: contestRaw.entries,
            topPrizeCents: contestRaw.topPrizeCents,
            totalOwnershipBp: contestRaw.totalOwnershipBp,
            analysis: contestRaw.analysis
              ? {
                  id: contestRaw.analysis.id,
                  stackSummary: contestRaw.analysis.stackSummary,
                  uniquenessNotes: contestRaw.analysis.uniquenessNotes,
                  stackMeta: contestRaw.analysis.stackMeta,
                  createdAt: contestRaw.analysis.createdAt,
                  updatedAt: contestRaw.analysis.updatedAt,
                }
              : null,
            winner: winnerRaw
              ? {
                  id: winnerRaw.id,
                  username: winnerRaw.username,
                  points: winnerRaw.points,
                  maxEntries: winnerRaw.maxEntries,
                  lineup: lineupRaw
                    ? {
                        id: lineupRaw.id,
                        lineupType: lineupRaw.lineupType,
                        salaryUsed: lineupRaw.salaryUsed,
                        totalPoints: lineupRaw.totalPoints,
                        totalOwnershipBp: lineupRaw.totalOwnershipBp,
                        items: itemsOrdered,
                      }
                    : null,
                }
              : null,
          }
        : null;

    return new Response(
      JSON.stringify(
        {
          slate: {
            id: slate.id,
            week: slate.week,
            slateType: slate.slateType,
            lineupType: slate.lineupType,
            slateDate: slate.slateDate,
            slateKey: slate.slateKey,
            slateName: slate.slateName,
            slateTag: slate.slateTag,
            season: slate.season,
            contest,
            images: { png: imgUrlPng, jpg: imgUrlJpg },
          },
        },
        null,
        2
      ),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[api/slate/[id]] error:", err);
    return new Response(
      JSON.stringify({
        error: "api/slate failed",
        name: err?.name ?? null,
        message: err?.message ?? String(err),
        stack: err?.stack ?? null,
      }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
};
