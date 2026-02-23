import type { APIRoute } from "astro";
import { prisma } from "../../../../lib/prisma";

function isNum(v: any): v is number {
  return typeof v === "number" && Number.isFinite(v);
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

export const GET: APIRoute = async ({ url }) => {
  const spotRaw = String(url.searchParams.get("spot") || "").trim().toLowerCase();
  const spot = spotRaw === "captain" ? "CAPTAIN" : spotRaw === "flex" ? "FLEX" : null;

  if (!spot) {
    return new Response(JSON.stringify({ error: "Invalid spot. Use spot=captain or spot=flex" }), {
      status: 400,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  }

  const contests = await prisma.contest.findMany({
    where: {
      slate: {
        season: { sport: "NFL" },
        lineupType: "SHOWDOWN",
      },
    },
    select: {
      id: true,
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
      winners: {
        take: 1,
        orderBy: { id: "asc" },
        select: {
          lineup: {
            select: {
              items: {
                select: {
                  rosterSpot: true,
                  salary: true,
                  points: true,
                  ownershipBp: true,
                  ownershipCaptainBp: true,
                  ownershipFlexBp: true,
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

  const rows: any[] = [];

  for (const c of contests) {
    const year = c.slate.season?.year ?? null;
    const matchup = parseMatchupFromSlateKey(c.slate.slateKey);

    const w = c.winners?.[0] ?? null;
    const lineup = w?.lineup ?? null;
    const itemsAll = Array.isArray(lineup?.items) ? lineup!.items : [];

    const split = teamSplitFromItemsStrict(itemsAll, matchup.away, matchup.home);

    for (const it of itemsAll) {
      const rs = String(it?.rosterSpot || "").toUpperCase();
      if (rs !== spot) continue;

      rows.push({
        slateId: c.slate.id,
        contestId: c.id,
        year,
        week: c.slate.week,
        slateType: c.slate.slateType,
        slateDate: c.slate.slateDate,
        slateKey: c.slate.slateKey,
        link: year ? `/nfl/${year}/slate/${c.slate.id}` : "",
        teamSplit: split,

        rosterSpot: rs,
        playerName: it?.player?.name ?? null,
        playerPos: it?.player?.position ?? null,
        playerTeam: it?.player?.team?.abbreviation ?? null,
        salary: it?.salary ?? null,
        ownershipPct: ownershipPctFromItem(it),
        points: it?.points ?? null,
      });
    }
  }

  const salaryVals = rows.map((r) => r.salary).filter(isNum);
  const ownVals = rows.map((r) => r.ownershipPct).filter(isNum);
  const ptsVals = rows.map((r) => r.points).filter(isNum);

  const posCounts: Record<string, number> = {};
  for (const r of rows) {
    const k = r.playerPos ? String(r.playerPos) : "UNKNOWN";
    posCounts[k] = (posCounts[k] ?? 0) + 1;
  }

  const splitCounts: Record<string, number> = { "3-3": 0, "4-2": 0, "5-1": 0 };
  for (const r of rows) {
    const k = r.teamSplit === "4-2" || r.teamSplit === "5-1" ? r.teamSplit : "3-3";
    splitCounts[k] = (splitCounts[k] ?? 0) + 1;
  }

  const metrics = {
    spot,
    counts: {
      rows: rows.length,
      positionCounts: posCounts,
      teamSplitCounts: splitCounts,
    },
    salary: {
      avg: avg(salaryVals),
      median: median(salaryVals),
      most: maxVal(salaryVals),
      least: minVal(salaryVals),
    },
    ownership: {
      avg: avg(ownVals),
      median: median(ownVals),
      most: maxVal(ownVals),
      least: minVal(ownVals),
    },
    points: {
      avg: avg(ptsVals),
      median: median(ptsVals),
      most: maxVal(ptsVals),
      least: minVal(ptsVals),
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