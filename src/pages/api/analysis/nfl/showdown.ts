// src/pages/api/analysis/nfl/showdown.ts
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

function ownershipPctFromItem(it: any) {
  const spot = String(it?.rosterSpot || "").toUpperCase();
  const bp =
    spot === "CAPTAIN"
      ? it?.ownershipCaptainBp
      : spot === "FLEX"
        ? it?.ownershipFlexBp
        : it?.ownershipBp;

  return isNum(bp) ? bp / 100 : null;
}

function normPos(v: any) {
  return String(v || "").trim().toUpperCase();
}

function isDSTPos(p: any) {
  const x = normPos(p);
  return x === "DST" || x === "D/ST" || x === "DEF" || x === "D";
}

function parseMatchupFromSlateKey(slateKey: any) {
  const key = String(slateKey || "").trim();
  if (!key) return { away: "", home: "" };
  const parts = key.split("_").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return { away: "", home: "" };
  const home = parts[parts.length - 1] || "";
  const away = parts[parts.length - 2] || "";
  return { away, home };
}

function forceAllowedSplit(a: number, b: number) {
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);

  const key = `${hi}-${lo}`;
  if (key === "3-3" || key === "4-2" || key === "5-1") return key;

  if (hi >= 6) return "5-1";
  if (hi === 5) return "5-1";
  if (hi === 4) return "4-2";
  return "3-3";
}

function teamSplitFromItemsStrict(items: any[], away: string, home: string) {
  const A = String(away || "").toUpperCase();
  const B = String(home || "").toUpperCase();

  let countA = 0;
  let countB = 0;
  let unknown = 0;

  for (const it of items || []) {
    const t = String(it?.player?.team?.abbreviation || "").toUpperCase();
    if (!t) {
      unknown += 1;
      continue;
    }
    if (A && t === A) countA += 1;
    else if (B && t === B) countB += 1;
    else unknown += 1;
  }

  let best: { split: string; a: number; b: number } | null = null;

  for (let giveToA = 0; giveToA <= unknown; giveToA++) {
    const a = countA + giveToA;
    const b = countB + (unknown - giveToA);
    const split = `${Math.max(a, b)}-${Math.min(a, b)}`;

    if (split === "3-3" || split === "4-2" || split === "5-1") {
      best = { split, a, b };
      break;
    }
  }

  if (best) return best.split;

  const aFinal = countA + Math.ceil(unknown / 2);
  const bFinal = countB + Math.floor(unknown / 2);
  return forceAllowedSplit(aFinal, bFinal);
}

function pct1(n: number | null) {
  if (!isNum(n)) return null;
  return Math.round(n * 10) / 10;
}

export const GET: APIRoute = async () => {
  const contests = await prisma.contest.findMany({
    where: {
      slate: {
        season: { sport: "NFL" },
        lineupType: "SHOWDOWN",
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
              items: {
                select: {
                  rosterSpot: true,
                  salary: true,
                  points: true,
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

    const year = c.slate.season?.year ?? null;

    const salaryUsed = lineup?.salaryUsed ?? null;
    const salaryLeft = isNum(salaryUsed) ? 50000 - salaryUsed : null;

    const totalOwnershipBp = c.totalOwnershipBp ?? null;
    const totalOwnershipPct = isNum(totalOwnershipBp) ? totalOwnershipBp / 100 : null;

    const captain = items.find((it) => String(it.rosterSpot).toUpperCase() === "CAPTAIN") ?? null;

    const captainPos = captain?.player?.position ?? null;
    const captainTeam = captain?.player?.team?.abbreviation ?? null;
    const captainName = captain?.player?.name ?? null;
    const captainSalary = captain?.salary ?? null;
    const captainOwnershipPct = captain ? ownershipPctFromItem(captain) : null;

    const matchup = parseMatchupFromSlateKey(c.slate.slateKey);
    const teamSplit = teamSplitFromItemsStrict(items, matchup.away, matchup.home);

    const hasK = items.some((it) => normPos(it?.player?.position) === "K");
    const hasDST = items.some((it) => isDSTPos(it?.player?.position));
    const hasKD = hasK || hasDST;

    let u20Count = 0;
    let u1kCount = 0;
    let ge50Count = 0;

    for (const it of items) {
      const own = ownershipPctFromItem(it);
      if (isNum(own) && own < 20) u20Count += 1;
      if (isNum(own) && own >= 50) ge50Count += 1;

      const sal = it?.salary;
      if (isNum(sal) && sal < 1000) u1kCount += 1;
    }

    return {
      slateId: c.slate.id,
      contestId: c.id,
      year,

      week: c.slate.week,
      slateType: c.slate.slateType,
      slateDate: c.slate.slateDate,
      slateKey: c.slate.slateKey,
      link: year ? `/nfl/${year}/slate/${c.slate.id}` : "",
      slateTag: c.slate.slateTag ?? null,
      slateGroup: c.slate.slateGroup ?? null,
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

      captainPos,
      captainTeam,
      captainName,
      captainSalary,
      captainOwnershipPct,

      teamSplit,

      hasKD,
      u20Count,
      u1kCount,
      ge50Count,

      hasAnalysis: Boolean(c.analysis),
      analysisKeys: c.analysis && typeof c.analysis === "object" ? Object.keys(c.analysis as any) : [],
    };
  });

  for (const r of rows) {
    if (r.year === 2024 && r.week === 22 && String(r.slateType || "") === "SUPER_BOWL") {
      console.log("[showdown api debug] 2024 week 22 SUPER_BOWL row:", r);
    }
  }

  const totalLineups = rows.length;

  const salaryLefts = rows.map((r) => r.salaryLeft).filter(isNum);
  const ownerships = rows.map((r) => r.totalOwnershipPct).filter(isNum);
  const winnerPts = rows.map((r) => r.points).filter(isNum);
  const captainOwns = rows.map((r) => r.captainOwnershipPct).filter(isNum);
  const captainSalaries = rows.map((r) => r.captainSalary).filter(isNum);

  const u20Counts = rows.map((r) => r.u20Count).filter(isNum);
  const u1kCounts = rows.map((r) => r.u1kCount).filter(isNum);
  const ge50Counts = rows.map((r) => r.ge50Count).filter(isNum);

  const hasKDCount = rows.filter((r) => r.hasKD).length;

  const bySlateType: Record<string, number> = {};
  for (const r of rows) {
    const k = String(r.slateType || "UNKNOWN");
    bySlateType[k] = (bySlateType[k] ?? 0) + 1;
  }

  const captainPosCounts: Record<string, number> = {};
  for (const r of rows) {
    const p = r.captainPos ? String(r.captainPos) : "UNKNOWN";
    captainPosCounts[p] = (captainPosCounts[p] ?? 0) + 1;
  }

  const teamSplitCounts: Record<string, number> = { "3-3": 0, "4-2": 0, "5-1": 0 };
  for (const r of rows) {
    const k = r.teamSplit === "4-2" || r.teamSplit === "5-1" ? r.teamSplit : "3-3";
    teamSplitCounts[k] = (teamSplitCounts[k] ?? 0) + 1;
  }

  const salaryLeftBuckets = bucketCount(salaryLefts, [0, 500, 1000, 2000, 3000, 4000, 5000]);
  const ownershipBuckets = bucketCount(ownerships, [120, 150, 180, 210, 240, 270, 300]);
  const captainOwnershipBuckets = bucketCount(captainOwns, [0, 5, 10, 15, 20, 30, 40]);
  const captainSalaryBuckets = bucketCount(captainSalaries, [0, 4000, 6000, 8000, 10000, 12000, 14000, 16000]);

  const lowOwnedCaptain = {
    under5: captainOwns.filter((x) => x < 5).length,
    under10: captainOwns.filter((x) => x < 10).length,
    under15: captainOwns.filter((x) => x < 15).length,
  };

  const salaryLeftRates = {
    atLeast500: salaryLefts.filter((x) => x >= 500).length,
    atLeast1000: salaryLefts.filter((x) => x >= 1000).length,
    atLeast2000: salaryLefts.filter((x) => x >= 2000).length,
    atLeast3000: salaryLefts.filter((x) => x >= 3000).length,
  };

  const analysisCoverage = {
    contestsWithAnalysis: rows.filter((r) => r.hasAnalysis).length,
    contestsWithoutAnalysis: rows.filter((r) => !r.hasAnalysis).length,
  };

  const constructionStats = {
    totalLineups,

    kd: {
      count: hasKDCount,
      pct: totalLineups ? pct1((hasKDCount / totalLineups) * 100) : null,
    },

    u20Players: {
      avg: avg(u20Counts),
      median: median(u20Counts),
      most: maxVal(u20Counts),
      least: minVal(u20Counts),
    },

    u1kPlayers: {
      avg: avg(u1kCounts),
      median: median(u1kCounts),
      most: maxVal(u1kCounts),
      least: minVal(u1kCounts),
    },

    ge50Players: {
      avg: avg(ge50Counts),
      median: median(ge50Counts),
      most: maxVal(ge50Counts),
      least: minVal(ge50Counts),
    },
  };

  const metrics = {
    counts: {
      rows: rows.length,
      bySlateType,
    },
    analysisCoverage,
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
      rates: salaryLeftRates,
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
    captain: {
      positionCounts: captainPosCounts,
      ownership: {
        avg: avg(captainOwns),
        median: median(captainOwns),
        most: maxVal(captainOwns),
        least: minVal(captainOwns),
        p25: pct(captainOwns, 25),
        p75: pct(captainOwns, 75),
        buckets: captainOwnershipBuckets,
        lowOwnedCounts: lowOwnedCaptain,
      },
      salary: {
        avg: avg(captainSalaries),
        median: median(captainSalaries),
        most: maxVal(captainSalaries),
        least: minVal(captainSalaries),
        p25: pct(captainSalaries, 25),
        p75: pct(captainSalaries, 75),
        buckets: captainSalaryBuckets,
      },
    },
    construction: {
      teamSplitCounts,
      stats: constructionStats,
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
