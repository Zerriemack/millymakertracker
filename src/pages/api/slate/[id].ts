import type { APIRoute } from "astro";
import { prisma } from "../../../lib/prisma";

function respond(status: number, body: any) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function bpToPct(bp: number | null | undefined) {
  if (bp === null || bp === undefined) return null;
  return bp / 100;
}

function normalizeOwnershipPercent(li: any) {
  if (li.ownership !== null && li.ownership !== undefined) return li.ownership;

  const bp =
    li.ownershipCaptainBp ??
    li.ownershipFlexBp ??
    li.ownershipClassicBp ??
    li.ownershipBp ??
    null;

  return bpToPct(bp);
}

function normalizeLineupItem(li: any) {
  const p = li.player || null;

  return {
    id: li.id,
    rosterSpot: li.rosterSpot,
    slotIndex: li.slotIndex,
    salary: li.salary,
    points: li.points,

    ownershipPercent: normalizeOwnershipPercent(li),

    // derived fields for UI compatibility
    name: p?.name ?? null,
    position: p?.position ?? null,
    team: p?.team?.abbreviation ?? null,

    // keep the raw relation in case the UI wants it later
    player: p
      ? {
          id: p.id,
          name: p.name,
          position: p.position,
          team: p.team ? { abbreviation: p.team.abbreviation, name: p.team.name } : null,
        }
      : null,
  };
}

export const GET: APIRoute = async ({ params }) => {
  const id = String(params.id || "").trim();
  if (!id) return respond(400, { error: "Missing id" });

  try {
    const row = await prisma.slate.findUnique({
      where: { id },
      select: {
        id: true,
        week: true,
        slateType: true,
        lineupType: true,
        slateDate: true,
        slateKey: true,
        slateName: true,
        slateTag: true,

        season: {
          select: { id: true, year: true, sport: true },
        },

        contests: {
          take: 1,
          orderBy: { id: "asc" },
          select: {
            id: true,
            site: true,
            contestName: true,
            siteContestId: true,
            entries: true,
            topPrizeCents: true,
            totalOwnershipBp: true,
            analysis: true,

            winners: {
              take: 1,
              orderBy: { id: "asc" },
              select: {
                id: true,
                username: true,
                points: true,
                maxEntries: true,

                lineup: {
                  select: {
                    id: true,
                    lineupType: true,
                    salaryUsed: true,
                    totalPoints: true,
                    totalOwnershipBp: true,

                    items: {
                      select: {
                        id: true,
                        rosterSpot: true,
                        slotIndex: true,
                        salary: true,
                        points: true,

                        ownership: true,
                        ownershipBp: true,
                        ownershipCaptainBp: true,
                        ownershipFlexBp: true,
                        ownershipClassicBp: true,

                        player: {
                          select: {
                            id: true,
                            name: true,
                            position: true,
                            team: { select: { abbreviation: true, name: true } },
                          },
                        },
                      },
                      orderBy: [{ rosterSpot: "asc" }, { slotIndex: "asc" }],
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!row) return respond(404, { error: "Slate not found", id });

    const contestRow = row.contests?.[0] ?? null;
    const winnerRow = contestRow?.winners?.[0] ?? null;

    const winner =
      winnerRow && winnerRow.lineup
        ? {
            ...winnerRow,
            lineup: {
              ...winnerRow.lineup,
              items: (winnerRow.lineup.items || []).map(normalizeLineupItem),
            },
          }
        : winnerRow;

    const contest = contestRow
      ? { ...contestRow, winner, winners: undefined }
      : null;

    const slate = {
      ...row,
      contest,
      contests: undefined,
    };

    return respond(200, { slate });
  } catch (err: any) {
    return respond(500, {
      error: "Failed to load slate",
      message: String(err?.message || err),
    });
  }
};
