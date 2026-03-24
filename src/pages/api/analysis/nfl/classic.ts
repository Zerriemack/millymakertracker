// src/pages/api/analysis/nfl/classic.ts
import type { APIRoute } from "astro";
import { prisma } from "../../../../lib/prisma";

function isNum(v: any): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function sum(nums: number[]) {
  return nums.reduce((a, b) => a + b, 0);
}

function avg(nums: number[]) {
  return nums.length ? sum(nums) / nums.length : null;
}

function median(nums: number[]) {
  if (!nums.length) return null;
  const a = [...nums].sort((x, y) => x - y);
  const mid = Math.floor(a.length / 2);
  return a.length % 2 === 1 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}

function pct(nums: number[], p: number) {
  if (!nums.length) return null;
  const a = [...nums].sort((x, y) => x - y);
  const idx = Math.max(0, Math.min(a.length - 1, Math.round((p / 100) * (a.length - 1))));
  return a[idx];
}

function minVal(nums: number[]) {
  if (!nums.length) return null;
  let m = nums[0];
  for (let i = 1; i < nums.length; i++) if (nums[i] < m) m = nums[i];
  return m;
}

function maxVal(nums: number[]) {
  if (!nums.length) return null;
  let m = nums[0];
  for (let i = 1; i < nums.length; i++) if (nums[i] > m) m = nums[i];
  return m;
}

function bucketCount(nums: number[], edges: number[]) {
  const counts: Record<string, number> = {};
  for (let i = 0; i < edges.length - 1; i++) {
    const lo = edges[i];
    const hi = edges[i + 1] - 1;
    counts[`${lo}-${hi}`] = 0;
  }
  counts[`${edges[edges.length - 1]}+`] = 0;

  for (const n of nums) {
    let placed = false;
    for (let i = 0; i < edges.length - 1; i++) {
      const lo = edges[i];
      const hi = edges[i + 1] - 1;
      if (n >= lo && n <= hi) {
        counts[`${lo}-${hi}`] += 1;
        placed = true;
        break;
      }
    }
    if (!placed) counts[`${edges[edges.length - 1]}+`] += 1;
  }

  return counts;
}

function qbStackLabelFromItems(items: any[]) {
  const qbs = (items || []).filter((it) => String(it?.player?.position || "").toUpperCase() === "QB");
  const qb = qbs[0] ?? null;

  const qbTeam = String(qb?.player?.team?.abbreviation || "").toUpperCase();
  if (!qb || !qbTeam) {
    return {
      qbStack: "NO QB",
      qbTeam: null as string | null,
      qbName: null as string | null,
      qbPlus: null as number | null,
    };
  }

  const qbName = qb?.player?.name ?? null;

  const passCatchers = (items || []).filter((it) => {
    const pos = String(it?.player?.position || "").toUpperCase();
    const team = String(it?.player?.team?.abbreviation || "").toUpperCase();
    if (team !== qbTeam) return false;
    return pos === "WR" || pos === "TE";
  });

  const plus = passCatchers.length;
  const qbStack = plus === 0 ? `${qbTeam} QB NAKED` : `${qbTeam} QB+${plus}`;

  return { qbStack, qbTeam, qbName, qbPlus: plus };
}

function teamStatsFromItems(items: any[]) {
  const counts: Record<string, number> = {};
  for (const it of items || []) {
    const t = String(it?.player?.team?.abbreviation || "").toUpperCase();
    if (!t) continue;
    counts[t] = (counts[t] ?? 0) + 1;
  }

  const teams = Object.keys(counts);
  let maxFromTeam: number | null = null;
  for (const k of teams) {
    const v = counts[k];
    if (maxFromTeam == null || v > maxFromTeam) maxFromTeam = v;
  }

  return { uniqueTeams: teams.length, maxFromTeam };
}

function gameStatsFromItems(items: any[]) {
  const gameCounts = new Map<string, number>();
  const windowCounts = { EARLY: 0, LATE: 0, PRIME: 0, OTHER: 0 };

  let itemsWithGame = 0;

  for (const it of items || []) {
    const gid = String(it?.gameId || "").trim();
    if (!gid) continue;

    itemsWithGame += 1;
    gameCounts.set(gid, (gameCounts.get(gid) || 0) + 1);

    const w = String(it?.game?.window || "").trim().toUpperCase();
    if (w === "EARLY") windowCounts.EARLY += 1;
    else if (w === "LATE") windowCounts.LATE += 1;
    else if (w === "PRIME") windowCounts.PRIME += 1;
    else windowCounts.OTHER += 1;
  }

  const uniqueGames = gameCounts.size ? gameCounts.size : null;

  let maxFromGame: number | null = null;
  for (const v of gameCounts.values()) {
    if (maxFromGame == null || v > maxFromGame) maxFromGame = v;
  }

  const earlyCount = itemsWithGame ? windowCounts.EARLY : null;
  const lateCount = itemsWithGame ? windowCounts.LATE : null;
  const primeCount = itemsWithGame ? windowCounts.PRIME : null;

  return { uniqueGames, maxFromGame, earlyCount, lateCount, primeCount };
}

function stackBringbackFromItems(items: any[]) {
  const qb = (items || []).find((it) => String(it?.player?.position || "").toUpperCase() === "QB") ?? null;
  if (!qb) {
    return { stackCount: null as number | null, bringbackCount: null as number | null, hasBringback: "" };
  }

  const qbTeam = String(qb?.player?.team?.abbreviation || "").toUpperCase();
  const qbGameId = String(qb?.gameId || "").trim();

  if (!qbTeam) {
    return { stackCount: null as number | null, bringbackCount: null as number | null, hasBringback: "" };
  }

  const stackCount = (items || []).filter((it) => {
    const pos = String(it?.player?.position || "").toUpperCase();
    const team = String(it?.player?.team?.abbreviation || "").toUpperCase();
    if (team !== qbTeam) return false;
    if (pos !== "WR" && pos !== "TE") return false;
    return true;
  }).length;

  if (!qbGameId) {
    return { stackCount, bringbackCount: null as number | null, hasBringback: "" };
  }

  const bringbackCount = (items || []).filter((it) => {
    const gid = String(it?.gameId || "").trim();
    if (gid !== qbGameId) return false;

    const team = String(it?.player?.team?.abbreviation || "").toUpperCase();
    if (!team) return false;
    if (team === qbTeam) return false;

    const pos = String(it?.player?.position || "").toUpperCase();
    if (pos === "DST") return false;

    return true;
  }).length;

  const hasBringback = bringbackCount > 0 ? "YES" : "NO";

  return { stackCount, bringbackCount, hasBringback };
}

function ownershipBucketsFromItems(items: any[]) {
  let own0_10 = 0;
  let own11_19 = 0;
  let own20p = 0;
  let counted = 0;

  for (const it of items || []) {
    const bp =
      isNum(it?.ownershipClassicBp) ? it.ownershipClassicBp :
      isNum(it?.ownershipBp) ? it.ownershipBp :
      null;

    if (!isNum(bp)) continue;

    const pct = bp / 100;
    counted += 1;

    if (pct <= 10) own0_10 += 1;
    else if (pct <= 19) own11_19 += 1;
    else own20p += 1;
  }

  const ownBucketTotal = own0_10 + own11_19 + own20p;

  return { own0_10, own11_19, own20p, ownBucketTotal, counted };
}

function indoorOutdoorCountsFromItems(items: any[]) {
  let indoor = 0;
  let outdoor = 0;
  let counted = 0;

  for (const it of items || []) {
    const isIndoor = it?.game?.stadium?.isIndoor;
    if (typeof isIndoor !== "boolean") continue;
    counted += 1;
    if (isIndoor) indoor += 1;
    else outdoor += 1;
  }

  return { indoor, outdoor, counted };
}

function primaryStadiumFromItems(items: any[]) {
  const counts = new Map<
    string,
    { count: number; stadium: { id: string; name: string; isIndoor: boolean; city: string; state: string } }
  >();

  for (const it of items || []) {
    const stadium = it?.game?.stadium;
    if (!stadium?.id) continue;
    const entry = counts.get(stadium.id);
    if (entry) {
      entry.count += 1;
    } else {
      counts.set(stadium.id, { count: 1, stadium });
    }
  }

  let top: { count: number; stadium: { id: string; name: string; isIndoor: boolean; city: string; state: string } } | null = null;
  for (const entry of counts.values()) {
    if (!top || entry.count > top.count) top = entry;
  }

  return top?.stadium ?? null;
}

export const GET: APIRoute = async () => {
  const contests = await prisma.contest.findMany({
    where: {
      slate: {
        season: { sport: "NFL" },
        lineupType: "CLASSIC",
      },
    },
    select: {
      id: true,
      totalOwnershipBp: true,
      topPrizeCents: true,
      slate: {
        select: {
          id: true,
          week: true,
          slateType: true,
          slateDate: true,
          slateKey: true,
          slateTag: true,
          slateGroup: true,
          season: { select: { year: true } },
        },
      },
      analysis: true,
      winners: {
        take: 1,
        orderBy: { id: "asc" },
        select: {
          points: true,
          username: true,
          lineup: {
            select: {
              salaryUsed: true,
              analysis: { select: { earlyCount: true, lateCount: true, primeCount: true } },
              items: {
                select: {
                  rosterSpot: true,
                  salary: true,
                  gameId: true,
                  opponentTeamId: true,
                  game: {
                    select: {
                      window: true,
                      stadium: { select: { id: true, name: true, isIndoor: true, city: true, state: true } },
                    },
                  },
                  ownershipBp: true,
                  ownershipCaptainBp: true,
                  ownershipFlexBp: true,
                  ownershipClassicBp: true,
                  player: {
                    select: {
                      name: true,
                      position: true,
                      team: { select: { abbreviation: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: [{ slate: { season: { year: "desc" } } }, { slate: { week: "asc" } }, { id: "asc" }],
  });

  const rows = contests.map((c) => {
    const w = c.winners?.[0] ?? null;
    const lineup = w?.lineup ?? null;
    const items = Array.isArray(lineup?.items) ? lineup!.items : [];

    const salaryUsed = lineup?.salaryUsed ?? null;
    const salaryLeft = isNum(salaryUsed) ? 50000 - salaryUsed : null;

    const totalOwnershipBp = c.totalOwnershipBp ?? null;
    const totalOwnershipPct = isNum(totalOwnershipBp) ? totalOwnershipBp / 100 : null;

    const qbStackInfo = qbStackLabelFromItems(items);
    const teamStats = teamStatsFromItems(items);
    const gameStats = gameStatsFromItems(items);
    const corrStats = stackBringbackFromItems(items);
    const ownBuckets = ownershipBucketsFromItems(items);
    const io = indoorOutdoorCountsFromItems(items);
    const primaryStadium = primaryStadiumFromItems(items);

    const year = c.slate.season?.year ?? null;
    const link = year ? `/nfl/${year}/slate/${c.slate.id}` : "";

    const earlyCount =
      typeof lineup?.analysis?.earlyCount === "number" ? lineup.analysis.earlyCount : gameStats.earlyCount;
    const lateCount =
      typeof lineup?.analysis?.lateCount === "number" ? lineup.analysis.lateCount : gameStats.lateCount;
    const primeCount =
      typeof lineup?.analysis?.primeCount === "number" ? lineup.analysis.primeCount : gameStats.primeCount;

    return {
      slateId: c.slate.id,
      contestId: c.id,
      year,
      week: c.slate.week,
      slateType: c.slate.slateType,

      // keep the raw date if you want it for filters/sorting later
      slateDateIso: c.slate.slateDate,

      // DO NOT display date in the table; show Indoor/Outdoor counts instead
      slateDate: `Indoor ${io.indoor}, Outdoor ${io.outdoor}`,
      venueSummary: `Indoor ${io.indoor}, Outdoor ${io.outdoor}`,

      slateKey: c.slate.slateKey,
      link,

      tag: c.slate.slateTag ?? null,
      group: c.slate.slateGroup ?? null,

      salaryUsed,
      salaryLeft,

      topPrizeCents: c.topPrizeCents ?? null,
      totalOwnershipBp,
      totalOwnershipPct,

      points: w?.points ?? null,
      winnerPoints: w?.points ?? null,
      winnerUsername: w?.username ?? null,

      qbStack: qbStackInfo.qbStack,
      qbTeam: qbStackInfo.qbTeam,
      qbName: qbStackInfo.qbName,
      qbPlus: qbStackInfo.qbPlus,

      uniqueTeams: teamStats.uniqueTeams,
      maxFromTeam: teamStats.maxFromTeam,

      uniqueGames: gameStats.uniqueGames,
      maxFromGame: gameStats.maxFromGame,

      stackCount: corrStats.stackCount,
      bringbackCount: corrStats.bringbackCount,
      hasBringback: corrStats.hasBringback,
      bringBack: corrStats.hasBringback,

      earlyCount,
      lateCount,
      primeCount,

      own0_10: ownBuckets.own0_10,
      own11_19: ownBuckets.own11_19,
      own20p: ownBuckets.own20p,
      ownBucketTotal: ownBuckets.ownBucketTotal,
      ownBucketCounted: ownBuckets.counted,

      indoorPlayers: io.indoor,
      outdoorPlayers: io.outdoor,
      indoorOutdoorCounted: io.counted,

      venue: primaryStadium?.name ?? "",
      stadiumName: primaryStadium?.name ?? null,
      stadiumCity: primaryStadium?.city ?? null,
      stadiumState: primaryStadium?.state ?? null,
      stadiumIsIndoor: typeof primaryStadium?.isIndoor === "boolean" ? primaryStadium.isIndoor : null,

      hasAnalysis: Boolean(c.analysis),
      analysisKeys: c.analysis && typeof c.analysis === "object" ? Object.keys(c.analysis as any) : [],
    };
  });

  const salaryLefts = rows.map((r) => r.salaryLeft).filter(isNum);
  const ownerships = rows.map((r) => r.totalOwnershipPct).filter(isNum);
  const winnerPts = rows.map((r) => r.points).filter(isNum);

  const maxFromTeamVals = rows.map((r) => r.maxFromTeam).filter(isNum);
  const maxFromGameVals = rows.map((r) => r.maxFromGame).filter(isNum);
  const stackCountVals = rows.map((r) => r.stackCount).filter(isNum);
  const bringbackCountVals = rows.map((r) => r.bringbackCount).filter(isNum);
  const earlyVals = rows.map((r) => r.earlyCount).filter(isNum);
  const lateVals = rows.map((r) => r.lateCount).filter(isNum);
  const primeVals = rows.map((r) => r.primeCount).filter(isNum);

  const own0Vals = rows.map((r) => r.own0_10).filter(isNum);
  const own11Vals = rows.map((r) => r.own11_19).filter(isNum);
  const own20Vals = rows.map((r) => r.own20p).filter(isNum);
  const ownTotVals = rows.map((r) => r.ownBucketTotal).filter(isNum);
  const ownCountedVals = rows.map((r) => r.ownBucketCounted).filter(isNum);

  const bySlateType: Record<string, number> = {};
  for (const r of rows) {
    const k = String(r.slateType || "UNKNOWN");
    bySlateType[k] = (bySlateType[k] ?? 0) + 1;
  }

  const qbStackCounts: Record<string, number> = {};
  for (const r of rows) {
    const k = String(r.qbStack || "UNKNOWN");
    qbStackCounts[k] = (qbStackCounts[k] ?? 0) + 1;
  }

  const bringbackYesNo: Record<string, number> = {};
  for (const r of rows) {
    const k = String(r.hasBringback || "UNKNOWN");
    bringbackYesNo[k] = (bringbackYesNo[k] ?? 0) + 1;
  }

  const salaryLeftBuckets = bucketCount(salaryLefts, [0, 500, 1000, 2000, 3000, 4000, 5000]);
  const ownershipBuckets = bucketCount(ownerships, [120, 150, 180, 210, 240, 270, 300]);

  const metrics = {
    counts: {
      rows: rows.length,
      bySlateType,
    },
    analysisCoverage: {
      contestsWithAnalysis: rows.filter((r) => r.hasAnalysis).length,
      contestsWithoutAnalysis: rows.filter((r) => !r.hasAnalysis).length,
    },
    salaryLeft: {
      avg: avg(salaryLefts),
      median: median(salaryLefts),
      most: maxVal(salaryLefts),
      least: minVal(salaryLefts),
      p10: pct(salaryLefts, 10),
      p25: pct(salaryLefts, 25),
      p75: pct(salaryLefts, 75),
      p90: pct(salaryLefts, 90),
      buckets: salaryLeftBuckets,
    },
    ownership: {
      avg: avg(ownerships),
      median: median(ownerships),
      most: maxVal(ownerships),
      least: minVal(ownerships),
      p10: pct(ownerships, 10),
      p25: pct(ownerships, 25),
      p75: pct(ownerships, 75),
      p90: pct(ownerships, 90),
      buckets: ownershipBuckets,
    },
    winnerPoints: {
      avg: avg(winnerPts),
      median: median(winnerPts),
      most: maxVal(winnerPts),
      least: minVal(winnerPts),
      p10: pct(winnerPts, 10),
      p25: pct(winnerPts, 25),
      p75: pct(winnerPts, 75),
      p90: pct(winnerPts, 90),
    },
    construction: {
      qbStackCounts,
      bringbackYesNo,

      maxFromTeam: {
        avg: avg(maxFromTeamVals),
        median: median(maxFromTeamVals),
        most: maxVal(maxFromTeamVals),
        least: minVal(maxFromTeamVals),
      },
      maxFromGame: {
        avg: avg(maxFromGameVals),
        median: median(maxFromGameVals),
        most: maxVal(maxFromGameVals),
        least: minVal(maxFromGameVals),
      },
      stackCount: {
        avg: avg(stackCountVals),
        median: median(stackCountVals),
        most: maxVal(stackCountVals),
        least: minVal(stackCountVals),
      },
      bringbackCount: {
        avg: avg(bringbackCountVals),
        median: median(bringbackCountVals),
        most: maxVal(bringbackCountVals),
        least: minVal(bringbackCountVals),
      },
      windows: {
        early: { avg: avg(earlyVals), median: median(earlyVals), most: maxVal(earlyVals), least: minVal(earlyVals) },
        late: { avg: avg(lateVals), median: median(lateVals), most: maxVal(lateVals), least: minVal(lateVals) },
        prime: { avg: avg(primeVals), median: median(primeVals), most: maxVal(primeVals), least: minVal(primeVals) },
      },
      ownershipBucketsPlayers: {
        own0_10: { avg: avg(own0Vals), median: median(own0Vals), most: maxVal(own0Vals), least: minVal(own0Vals) },
        own11_19: { avg: avg(own11Vals), median: median(own11Vals), most: maxVal(own11Vals), least: minVal(own11Vals) },
        own20p: { avg: avg(own20Vals), median: median(own20Vals), most: maxVal(own20Vals), least: minVal(own20Vals) },
        total: { avg: avg(ownTotVals), median: median(ownTotVals), most: maxVal(ownTotVals), least: minVal(ownTotVals) },
        counted: { avg: avg(ownCountedVals), median: median(ownCountedVals), most: maxVal(ownCountedVals), least: minVal(ownCountedVals) },
      },
    },
  };

  return new Response(JSON.stringify({ metrics, rows }), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
};
