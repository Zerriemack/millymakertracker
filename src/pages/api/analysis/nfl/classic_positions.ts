// src/pages/api/analysis/nfl/classic_positions.ts
import type { APIRoute } from "astro";
import { prisma } from "../../../../lib/prisma";

const ALLOWED = new Set(["QB", "RB", "WR", "TE", "FLEX", "DST"]);

function n(v: any) {
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

function up(v: any) {
  return String(v ?? "").trim().toUpperCase();
}

function s(v: any) {
  return String(v ?? "").trim();
}

function posCountLabel(positions: string[]) {
  const m = new Map<string, number>();
  for (const p of positions.map((x) => up(x)).filter(Boolean)) {
    m.set(p, (m.get(p) || 0) + 1);
  }
  const parts = Array.from(m.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([p, c]) => (c === 1 ? p : `${p}x${c}`));
  return parts.length ? parts.join(", ") : "NA";
}

function dkStatLine(it: any) {
  const pos = up(it?.player?.position);
  const spot = up(it?.rosterSpot);

  if (spot === "DST") {
    const sacks = n(it?.sacks);
    const takeaways = n(it?.takeaways);
    const pa = n(it?.pointsAllowedBucket);
    const dtd = n(it?.defensiveTdCount);

    const parts: string[] = [];
    if (sacks != null) parts.push(`${sacks} SACK`);
    if (takeaways != null) parts.push(`${takeaways} TAKE`);
    if (dtd != null) parts.push(`${dtd} DTD`);
    if (pa != null) parts.push(`${pa} PA`);

    return parts.length ? parts.join(", ") : "NA";
  }

  if (pos === "QB") {
    const passYds = n(it?.passYds);
    const passTd = n(it?.passTd);
    const passInt = n(it?.passInt);
    const rushYds = n(it?.rushYds);
    const rushTd = n(it?.rushTd);

    const parts: string[] = [];
    if (passTd != null) parts.push(`${passTd} PaTD`);
    if (rushTd != null) parts.push(`${rushTd} RuTD`);
    if (passYds != null) parts.push(`${passYds} PaYds`);
    if (rushYds != null) parts.push(`${rushYds} RuYds`);
    if (passInt != null) parts.push(`${passInt} INT`);

    return parts.length ? parts.join(", ") : "NA";
  }

  if (pos === "RB") {
    const rushYds = n(it?.rushYdsRb);
    const rushAtt = n(it?.rushAtt);
    const rushTd = n(it?.rushTdRb);

    const targets = n(it?.targetsRb);
    const rec = n(it?.recRb);
    const recYds = n(it?.recYdsRb);
    const recTd = n(it?.recTdRb);

    const parts: string[] = [];
    if (recTd != null) parts.push(`${recTd} RecTD`);
    if (recYds != null) parts.push(`${recYds} RecYds`);
    if (rushYds != null) parts.push(`${rushYds} RuYds`);
    if (rec != null) parts.push(`${rec} REC`);
    if (rushAtt != null) parts.push(`${rushAtt} RuAtt`);
    if (targets != null) parts.push(`${targets} TGT`);
    if (rushTd != null) parts.push(`${rushTd} RuTD`);

    return parts.length ? parts.join(", ") : "NA";
  }

  if (pos === "WR" || pos === "TE") {
    const rec = n(it?.rec);
    const recYds = n(it?.recYds);
    const recTd = n(it?.recTd);
    const targets = n(it?.targets);

    const parts: string[] = [];
    if (recTd != null) parts.push(`${recTd} RecTD`);
    if (recYds != null) parts.push(`${recYds} RecYds`);
    if (rec != null) parts.push(`${rec} REC`);
    if (targets != null) parts.push(`${targets} TGT`);

    return parts.length ? parts.join(", ") : "NA";
  }

  return "NA";
}

export const GET: APIRoute = async ({ url }) => {
  const spotRaw = up(url.searchParams.get("spot"));
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
      id: true,
      rosterSpot: true,
      salary: true,
      points: true,
      ownershipClassicBp: true,

      gameId: true,

      passYds: true,
      passTd: true,
      passInt: true,
      rushYds: true,
      rushTd: true,

      rushAtt: true,
      rushYdsRb: true,
      rushTdRb: true,
      targetsRb: true,
      recRb: true,
      recYdsRb: true,
      recTdRb: true,

      targets: true,
      rec: true,
      recYds: true,
      recTd: true,

      pointsAllowedBucket: true,
      defensiveTdCount: true,
      sacks: true,
      takeaways: true,

      qbFacedText: true,
      qbFacedPlayerId: true,

      opponentTeamId: true,
      opponentTeam: { select: { abbreviation: true } },

      opponentStartingQbPlayerId: true,
      opponentStartingQb: { select: { name: true } },

      game: {
        select: {
          window: true,
          homeTeam: { select: { abbreviation: true, homeIsIndoor: true } },
          awayTeam: { select: { abbreviation: true } },
          homeStartingQb: { select: { name: true } },
          awayStartingQb: { select: { name: true } },
        },
      },

      player: {
        select: {
          name: true,
          position: true,
          team: { select: { abbreviation: true } },
        },
      },

      lineup: {
        select: {
          id: true,
          items: {
            select: {
              rosterSpot: true,
              gameId: true,
              player: {
                select: {
                  name: true,
                  position: true,
                  team: { select: { abbreviation: true } },
                },
              },
            },
          },
          winner: {
            select: {
              contest: {
                select: {
                  slate: {
                    select: {
                      id: true,
                      week: true,
                      slateDate: true,
                      season: { select: { id: true, year: true } },
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

  type QbSeasonLite = {
    seasonId: string;
    playerId: string;
    archetype: any;
    pffPassGrade: number | null;
  };

  const dstRefs = items
    .map((it) => {
      const seasonId = it.lineup?.winner?.contest?.slate?.season?.id ?? null;
      const playerId = it.qbFacedPlayerId ?? null;
      const teamId = it.opponentTeamId ?? null;
      const spot = up(it.rosterSpot);
      return { id: it.id, spot, seasonId, playerId, teamId };
    })
    .filter((x) => x.spot === "DST" && x.seasonId && x.playerId);

  const seasonIds = Array.from(new Set(dstRefs.map((x) => x.seasonId))) as string[];
  const playerIds = Array.from(new Set(dstRefs.map((x) => x.playerId))) as string[];

  const qbSeasonRows =
    seasonIds.length && playerIds.length
      ? await prisma.qbSeason.findMany({
          where: {
            sport: "NFL",
            seasonId: { in: seasonIds },
            playerId: { in: playerIds },
          },
          select: {
            seasonId: true,
            playerId: true,
            archetype: true,
            pffPassGrade: true,
          },
        })
      : [];

  const qbSeasonByPlayerSeason = new Map<string, QbSeasonLite>();
  for (const row of qbSeasonRows) {
    const k = `${row.seasonId}:${row.playerId}`;
    const prev = qbSeasonByPlayerSeason.get(k);
    if (!prev) {
      qbSeasonByPlayerSeason.set(k, row as QbSeasonLite);
    } else if (prev.pffPassGrade == null && row.pffPassGrade != null) {
      qbSeasonByPlayerSeason.set(k, row as QbSeasonLite);
    }
  }

  function resolveQbSeason(seasonId: string | null, playerId: string | null): QbSeasonLite | null {
    if (!seasonId || !playerId) return null;
    return qbSeasonByPlayerSeason.get(`${seasonId}:${playerId}`) ?? null;
  }

  const qbSeasonByItemId = new Map<string, QbSeasonLite | null>();
  for (const ref of dstRefs) {
    qbSeasonByItemId.set(ref.id, resolveQbSeason(ref.seasonId, ref.playerId));
  }

  const rows = items.map((it) => {
    const slate = it.lineup?.winner?.contest?.slate;
    const seasonYear = slate?.season?.year ?? null;

    const slateId = slate?.id ?? null;
    const link = slateId && typeof seasonYear === "number" ? `/nfl/${seasonYear}/slate/${slateId}` : "";

    const ownBp = typeof it.ownershipClassicBp === "number" ? it.ownershipClassicBp : null;
    const ownPct = ownBp === null ? null : ownBp / 100;

    const team = up(it.player?.team?.abbreviation);
    const pos = up(it.player?.position);
    const spot = up(it.rosterSpot);

    const game = it.game;
    const homeTeam = up(game?.homeTeam?.abbreviation);
    const awayTeam = up(game?.awayTeam?.abbreviation);

    const hasGame = Boolean(it.gameId && homeTeam && awayTeam);
    const matchup = hasGame ? `${awayTeam} @ ${homeTeam}` : "NA";

    const indoorOutdoor =
      hasGame && typeof game?.homeTeam?.homeIsIndoor === "boolean"
        ? game.homeTeam.homeIsIndoor
          ? "INDOOR"
          : "OUTDOOR"
        : "NA";

    const isHome = hasGame ? team === homeTeam : null;
    const homeAway = isHome == null ? "NA" : isHome ? "HOME" : "AWAY";

    const qbItem = (it.lineup?.items || []).find((x) => up(x?.player?.position) === "QB") ?? null;
    const qbTeam = up(qbItem?.player?.team?.abbreviation);
    const qbGameId = s(qbItem?.gameId);

    const stackPartnerPositions = (it.lineup?.items || [])
      .filter((x) => {
        const xTeam = up(x?.player?.team?.abbreviation);
        const xPos = up(x?.player?.position);
        if (!qbTeam || xTeam !== qbTeam) return false;
        return xPos === "WR" || xPos === "TE";
      })
      .map((x) => up(x?.player?.position));

    const bringbackPositions = (it.lineup?.items || [])
      .filter((x) => {
        const gid = s(x?.gameId);
        if (!qbGameId || gid !== qbGameId) return false;

        const xTeam = up(x?.player?.team?.abbreviation);
        if (!xTeam || xTeam === qbTeam) return false;

        const xPos = up(x?.player?.position);
        if (xPos === "DST") return false;

        return true;
      })
      .map((x) => up(x?.player?.position));

    const stackPartners = posCountLabel(stackPartnerPositions);
    const bringBack = bringbackPositions.length ? posCountLabel(bringbackPositions) : "NO";

    let role = "NONE";
    if (spot !== "DST" && qbTeam) {
      const sameTeamAsQb = team === qbTeam;
      const sameGameAsQb = qbGameId && s(it.gameId) === qbGameId;
      const isPassCatcher = pos === "WR" || pos === "TE";
      if (sameTeamAsQb && isPassCatcher) role = "STACK";
      if (sameGameAsQb && qbTeam && team && team !== qbTeam && pos !== "DST") role = "BRING BACK";
    }

    const samePosSameTeamCount =
      spot === "QB" || spot === "DST"
        ? null
        : (it.lineup?.items || []).filter((x) => up(x?.player?.position) === pos && up(x?.player?.team?.abbreviation) === team).length;

    const samePosSameGameCount =
      spot === "QB" || spot === "DST"
        ? null
        : (it.lineup?.items || []).filter((x) => s(x?.gameId) && s(x?.gameId) === s(it.gameId) && up(x?.player?.position) === pos).length;

    const statLine = dkStatLine(it);

    const dstQbFaced = spot === "DST" ? (s(it.qbFacedText) || null) : null;
    const qbSeason = spot === "DST" ? (qbSeasonByItemId.get(it.id) ?? null) : null;
    const pffPassGrade = typeof qbSeason?.pffPassGrade === "number" ? qbSeason.pffPassGrade : null;

    let oppTeam = "NA";
    if (hasGame && homeTeam && awayTeam) {
      if (team === homeTeam) oppTeam = awayTeam;
      else if (team === awayTeam) oppTeam = homeTeam;
    } else if (it.opponentTeam?.abbreviation) {
      oppTeam = up(it.opponentTeam.abbreviation);
    }

    return {
      year: seasonYear,
      week: slate?.week ?? null,
      slateDate: slate?.slateDate ?? null,
      link,

      team: it.player?.team?.abbreviation ?? null,

      flexPos: spot === "FLEX" ? pos : null,
      slotLabel: spot === "FLEX" ? pos : (it.player?.name ?? null),

      position: it.player?.position ?? null,

      salary: it.salary ?? null,
      points: it.points ?? null,
      ownPct,

      matchup,
      indoorOutdoor,
      homeAway,

      role,
      stackPartners,
      bringBack,

      samePosSameTeamCount,
      samePosSameGameCount,

      opponentTeam: oppTeam,
      qbFacedText: dstQbFaced,
      qbArchetype: spot === "DST" ? (qbSeason?.archetype ?? null) : null,
      qbEpaScore: spot === "DST" ? pffPassGrade : null,

      statLine,
    };
  });

  return new Response(JSON.stringify({ ok: true, spot: spotRaw, year, rows }), {
    headers: { "content-type": "application/json" },
  });
};
