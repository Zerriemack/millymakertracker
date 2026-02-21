// src/pages/api/analysis/nfl/classic.ts
import type { APIRoute } from "astro";
import { prisma } from "../../../../../lib/prisma";

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
    return { qbStack: "NO QB", qbTeam: null as string | null, qbName: null as string | null, qbPlus: null as number | null };
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
              items: {
                select: {
                  rosterSpot: true,
                  salary: true,
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

    const year = c.slate.season?.year ?? null;
    const link = year ? `/nfl/${year}/slate/${c.slate.id}` : "";

    return {
      slateId: c.slate.id,
      contestId: c.id,
      year,
      week: c.slate.week,
      slateType: c.slate.slateType,
      slateDate: c.slate.slateDate,
      slateKey: c.slate.slateKey,
      link,

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

      hasAnalysis: Boolean(c.analysis),
      analysisKeys: c.analysis && typeof c.analysis === "object" ? Object.keys(c.analysis as any) : [],
    };
  });

  const salaryLefts = rows.map((r) => r.salaryLeft).filter(isNum);
  const ownerships = rows.map((r) => r.totalOwnershipPct).filter(isNum);
  const winnerPts = rows.map((r) => r.points).filter(isNum);
  const uniqueTeamsVals = rows.map((r) => r.uniqueTeams).filter(isNum);
  const maxFromTeamVals = rows.map((r) => r.maxFromTeam).filter(isNum);

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
      uniqueTeams: {
        avg: avg(uniqueTeamsVals),
        median: median(uniqueTeamsVals),
        most: maxVal(uniqueTeamsVals),
        least: minVal(uniqueTeamsVals),
      },
      maxFromTeam: {
        avg: avg(maxFromTeamVals),
        median: median(maxFromTeamVals),
        most: maxVal(maxFromTeamVals),
        least: minVal(maxFromTeamVals),
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