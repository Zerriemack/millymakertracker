/**
 * scripts/import-winners.ts
 * Stable importer for current schema:
 * - Winner unique: contestId_username
 * - Lineup relates by winnerId (NO contestId field on Lineup)
 * - Calculates SHOWDOWN totalOwnershipBp (CAPTAIN uses captainPct, others use flexPct)
 *
 * Run:
 * dotenv_config_path=.env.local node -r dotenv/config node_modules/.bin/tsx scripts/import-winners.ts --path data/import/nfl/2025/showdown/MNF/wk03_mnf.json
 */

import { PrismaClient, Sport, SlateType, RosterSpot, LineupType } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as path from "node:path";
import * as fs from "node:fs";
import "dotenv/config";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 30_000,
});

function detectSlateFromPath(filePath: string): { slateType: SlateType; tag: string; name: string } | null {
  const parts = filePath.split(path.sep).map((p) => p.toLowerCase());

  // look for your folder names
  if (parts.includes("mnf")) return { slateType: SlateType.MNF, tag: "mnf", name: "MNF" };
  if (parts.includes("tnf")) return { slateType: SlateType.TNF, tag: "tnf", name: "TNF" };
  if (parts.includes("snf")) return { slateType: SlateType.SNF, tag: "snf", name: "SNF" };

  if (parts.includes("black_friday")) return { slateType: SlateType.SHOWDOWN, tag: "black_friday", name: "Black Friday" };
  if (parts.includes("thanksgiving")) return { slateType: SlateType.SHOWDOWN, tag: "thanksgiving", name: "Thanksgiving" };
  if (parts.includes("saturday")) return { slateType: SlateType.SHOWDOWN, tag: "saturday", name: "Saturday" };
  if (parts.includes("playoffs")) return { slateType: SlateType.SHOWDOWN, tag: "playoffs", name: "Playoffs" };

  return null;
}


const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function upsertLineup(args: {
  slateType: SlateType;
  salaryUsed: number | null;
  totalPoints: number;
  totalOwnershipBp: number | null;
  winnerId: string;
}) {
  // Your current schema does NOT have Lineup.contestId, so key off winnerId.
  const existing = await prisma.lineup.findFirst({
    where: { winnerId: args.winnerId } as any,
  });

  const data: any = {
    winnerId: args.winnerId,
    lineupType: args.slateType === SlateType.MAIN ? LineupType.CLASSIC : LineupType.SHOWDOWN,
    salaryUsed: args.salaryUsed,
    totalPoints: args.totalPoints,
    totalOwnershipBp: args.totalOwnershipBp,
  };

  if (existing) {
    return prisma.lineup.update({
      where: { id: (existing as any).id },
      data,
    });
  }

  return prisma.lineup.create({ data });
}

type JsonInput = {
  sport: Sport | string;
  year: number;
  week: number;
  slateType: SlateType | string;
  slateDate: string;

  contest: {
    site: string;
    contestName: string;
    siteContestId?: string;
    entryFeeCents?: number | null;
    topPrizeCents?: number | null;
  };

  winner: {
    username: string;
    points: number;
    maxEntries?: number | null;
  };

  lineup: {
    salaryUsed?: number | null;
    totalPoints: number;
    items: Array<{
      rosterSpot: any;
      name: string;
      position: string;
      team: string;
      salary?: any;
      points?: any;

      ownership?: any;
      ownershipPct?: any;
      ownershipPercent?: any;

      captain?: any;
      captainPct?: any;
      captainPercent?: any;
      captainOwnership?: any;
      ownershipCaptain?: any;
      ownershipCaptainPct?: any;
      ownershipCaptainPercent?: any;

      flex?: any;
      flexPct?: any;
      flexPercent?: any;
      flexOwnership?: any;
      ownershipFlex?: any;
      ownershipFlexPct?: any;
      ownershipFlexPercent?: any;

      draft?: any;
      draftPct?: any;
      draftPercent?: any;
    }>;
  };
};

function parseArgs() {
  const argv = process.argv.slice(2);
  const idx = argv.indexOf("--path");
  const p = idx >= 0 ? argv[idx + 1] : null;
  if (!p) throw new Error("Missing --path");
  return { targetPath: p };
}

function normalizeSport(v: any): Sport {
  const s = String(v).toUpperCase();
  if (s === "NFL") return Sport.NFL;
  if (s === "CFB") return Sport.CFB;
  throw new Error(`Unknown sport: ${v}`);
}

function normalizeSlateType(v: any): SlateType {
  const s = String(v).toUpperCase();
  if (s === "MAIN") return SlateType.MAIN;
  if (s === "SHOWDOWN") return SlateType.SHOWDOWN;
  if (s === "TNF") return SlateType.TNF;
  if (s === "SNF") return SlateType.SNF;
  if (s === "MNF") return SlateType.MNF;
  throw new Error(`Unknown slateType: ${v}`);
}

function toRosterSpot(v: any): RosterSpot {
  const s = String(v ?? "").toUpperCase().trim();
  if (s === "CPT" || s === "CAPTAIN" || s === "CAP") return RosterSpot.CAPTAIN;
  if (s === "QB") return RosterSpot.QB;
  if (s === "RB") return RosterSpot.RB;
  if (s === "WR") return RosterSpot.WR;
  if (s === "TE") return RosterSpot.TE;
  if (s === "FLEX") return RosterSpot.FLEX;
  if (s === "DST" || s === "DEF" || s === "D") return RosterSpot.DST;
  throw new Error(`Unknown rosterSpot: ${v}`);
}

/* ---------- ownership parsing ---------- */

function numLoose(v: any): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  if (!s) return null;
  const cleaned = s.replace(/[%,$]/g, "").trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function pctFromMaybe(v: any): number | null {
  const n = numLoose(v);
  if (n === null) return null;
  if (n > 0 && n <= 1) return n * 100; // 0.352 => 35.2
  if (n >= 0 && n <= 1000) return n;
  return null;
}

function extractTwoPercents(v: any): { first: number | null; second: number | null } {
  const s = String(v ?? "");
  const matches = s.match(/(\d+(\.\d+)?)/g);
  if (!matches || matches.length === 0) return { first: null, second: null };
  const a = pctFromMaybe(matches[0]);
  const b = matches.length >= 2 ? pctFromMaybe(matches[1]) : null;
  return { first: a, second: b };
}

function captainPct(item: any): number | null {
  return (
    pctFromMaybe(item.ownershipCaptainPct) ??
    pctFromMaybe(item.ownershipCaptainPercent) ??
    pctFromMaybe(item.ownershipCaptain) ??
    pctFromMaybe(item.captainPct) ??
    pctFromMaybe(item.captainPercent) ??
    pctFromMaybe(item.captainOwnership) ??
    pctFromMaybe(item.captain) ??
    extractTwoPercents(item.draft ?? item.draftPct ?? item.draftPercent).first
  );
}

function flexPct(item: any): number | null {
  return (
    pctFromMaybe(item.ownershipFlexPct) ??
    pctFromMaybe(item.ownershipFlexPercent) ??
    pctFromMaybe(item.ownershipFlex) ??
    pctFromMaybe(item.flexPct) ??
    pctFromMaybe(item.flexPercent) ??
    pctFromMaybe(item.flexOwnership) ??
    pctFromMaybe(item.flex) ??
    extractTwoPercents(item.draft ?? item.draftPct ?? item.draftPercent).second
  );
}

function anyOwnershipPct(item: any): number | null {
  return pctFromMaybe(item.ownership) ?? pctFromMaybe(item.ownershipPct) ?? pctFromMaybe(item.ownershipPercent);
}

function calcShowdownTotalOwnershipBp(items: any[]): number | null {
  if (!items?.length) return null;
  let sum = 0;
  let any = false;

  for (const it of items) {
    const spot = toRosterSpot(it.rosterSpot);
    const pct = spot === RosterSpot.CAPTAIN ? (captainPct(it) ?? anyOwnershipPct(it)) : (flexPct(it) ?? anyOwnershipPct(it));
    if (pct !== null) {
      sum += pct;
      any = true;
    }
  }
  return any ? Math.round(sum * 100) : null;
}

function pctToBp(pct: number | null): number | null {
  if (pct === null) return null;
  return Math.round(pct * 100);
}

/* ---------- DB writes ---------- */

async function upsertSeason(year: number, sport: Sport) {
  return prisma.season.upsert({
    where: { year_sport: { year, sport } },
    create: { year, sport },
    update: {},
  });
}

async function upsertSlate(
  seasonId: string,
  week: number,
  slateType: SlateType,
  slateDate: Date
) {
  const tag =
    slateType === SlateType.MAIN ? "main" :
    slateType === SlateType.TNF ? "tnf" :
    slateType === SlateType.SNF ? "snf" :
    slateType === SlateType.MNF ? "mnf" :
    slateType === SlateType.SHOWDOWN ? "showdown" :
    String(slateType).toLowerCase();

  const slateKey = `${seasonId}:${week}:${slateType}`;

  const slateName = `NFL 2025 Week ${week} ${slateType}`;
  const slateGroup = "regular";

  const data: any = {
    seasonId,
    week,
    slateType,
    slateDate,
    lineupType: slateType === SlateType.MAIN ? LineupType.CLASSIC : LineupType.SHOWDOWN,
    slateKey,
    slateName,
    slateTag: tag,
    slateGroup,
  };

  const existing = await prisma.slate.findFirst({
    where: { seasonId, week, slateType } as any,
  });

  if (existing) {
    return prisma.slate.update({
      where: { id: (existing as any).id },
      data,
    });
  }

  return prisma.slate.create({ data });
}

async function upsertTeamByAbbr(teamAbbr: string, sport: Sport | null | undefined) {
  const sportVal: Sport = (sport as any) ?? Sport.NFL;
  const teamDelegate: any = (prisma as any).team;
  if (!teamDelegate) return null;

  // Some schemas use compound uniques. Try the common patterns first.
  const tryCompoundWheres = [
    { abbr_sport: { abbr: teamAbbr, sport: sportVal } },
    { sport_abbr: { sport: sportVal, abbr: teamAbbr } },
  ];

  for (const where of tryCompoundWheres) {
    try {
      return await teamDelegate.upsert({
        where,
        create: { abbr: teamAbbr, abbreviation: teamAbbr, sport: sportVal },
        update: {},
      });
    } catch {
      // ignore and try next
    }
  }

  // Try single-field uniques
  const tryWheres = [{ abbr: teamAbbr }, { code: teamAbbr }, { shortName: teamAbbr }];

  for (const where of tryWheres) {
    try {
      return await teamDelegate.upsert({
        where,
        create: { ...where, sport: sportVal, abbreviation: teamAbbr },
        update: {},
      });
    } catch {
      // ignore and try next
    }
  }

  // Fallback: findFirst + create
  try {
    const existing = await teamDelegate.findFirst({
      where: { sport: sportVal, OR: tryWheres },
    });
    if (existing) return existing;
  } catch {}

  return await teamDelegate.create({ data: { abbr: teamAbbr, abbreviation: teamAbbr, sport: sportVal } });
}

async function upsertPlayer(item: { name: string; team: string; position: string }, sport: Sport) {
  const playerDelegate: any = (prisma as any).player;
  if (!playerDelegate) throw new Error("Prisma model Player not found");

  const team = await upsertTeamByAbbr(item.team, sport);

  // Prefer teamId if it exists
  const whereAny: any = { name: item.name, position: item.position };
  if (team?.id) whereAny.teamId = team.id;

  try {
    const existing = await playerDelegate.findFirst({ where: whereAny });
    if (existing) return existing;
  } catch {
    // if teamId filter isn't valid in this schema, fall back below
  }

  // Fallback: relation filter
  try {
    const existing = await playerDelegate.findFirst({
      where: {
        name: item.name,
        position: item.position,
        team: { is: { id: team?.id } },
      },
    });
    if (existing) return existing;
  } catch {}

  const dataAny: any = { name: item.name, position: item.position };

  if (team?.id) dataAny.teamId = team.id;
  else if (team?.id) dataAny.team = { connect: { id: team.id } };

  return await playerDelegate.create({ data: dataAny });
}

async function replaceLineupItems(lineupId: string, items: JsonInput["lineup"]["items"]) {
  await prisma.lineupItem.deleteMany({ where: { lineupId } as any });

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const spot = toRosterSpot(it.rosterSpot);

    const cap = captainPct(it);
    const flx = flexPct(it);
    const any = anyOwnershipPct(it);
    const usedPct = spot === RosterSpot.CAPTAIN ? (cap ?? any) : (flx ?? any);

    const player = await upsertPlayer({ name: it.name, team: it.team, position: it.position });

    await prisma.lineupItem.create({
      data: {
        lineupId,
        playerId: (player as any).id,
        rosterSpot: spot,
        slotIndex: i,
        salary: numLoose(it.salary) ?? null,
        points: numLoose(it.points) ?? null,
        ownership: usedPct ?? null,
        ownershipBp: pctToBp(usedPct),
        ownershipCaptainBp: pctToBp(cap),
        ownershipFlexBp: pctToBp(flx),
      } as any,
    });
  }
}


async function upsertContest(args: {
  siteContestId: string;
  site: string;
  slateId: string;
  contestName: string | null;
  entryFeeCents: number | null;
  topPrizeCents: number | null;
  totalOwnershipBp: number | null;
}) {
  const existing = await prisma.contest.findFirst({
    where: { siteContestId: args.siteContestId } as any,
  });

  const data: any = {
    siteContestId: args.siteContestId,
    site: args.site,
    slateId: args.slateId,
    contestName: args.contestName,
    entryFeeCents: args.entryFeeCents,
    topPrizeCents: args.topPrizeCents,
    totalOwnershipBp: args.totalOwnershipBp,
  };

  if (existing) {
    return prisma.contest.update({
      where: { id: (existing as any).id },
      data,
    });
  }

  return prisma.contest.create({ data });
}


async function upsertWinner(args: {
  contestId: string;
  username: string;
  points: number;
  maxEntries: number | null;
}) {
  return prisma.winner.upsert({
    where: {
      contestId_username: { contestId: args.contestId, username: args.username },
    },
    create: {
      contestId: args.contestId,
      username: args.username,
      points: args.points,
      maxEntries: args.maxEntries,
    } as any,
    update: {
      points: args.points,
      maxEntries: args.maxEntries,
    } as any,
  });
}

async function importOneFile(filePath: string) {
  const raw = fs.readFileSync(filePath, "utf8").trim();
  if (!raw) throw new Error(`Empty JSON: ${filePath}`);

  const parsed = JSON.parse(raw) as JsonInput;

  const sport = normalizeSport(parsed.sport);
  const slateType = normalizeSlateType(parsed.slateType);
  const slateDate = new Date(parsed.slateDate);

  const siteContestId = parsed.contest.siteContestId?.trim();
  if (!siteContestId) throw new Error("contest.siteContestId is required");

  const totalOwnershipBp = calcShowdownTotalOwnershipBp(parsed.lineup.items);
  console.log("[OWNERSHIP]", siteContestId, "bp=", totalOwnershipBp);

  const season = await upsertSeason(parsed.year, sport);
  const slate = await upsertSlate(season.id, parsed.week, slateType, slateDate);

  const contest = await upsertContest({
    site: parsed.contest.site,
    siteContestId,
    slateId: slate.id,
    contestName: parsed.contest.contestName,
    entryFeeCents: parsed.contest.entryFeeCents ?? null,
    topPrizeCents: parsed.contest.topPrizeCents ?? null,
    totalOwnershipBp,
  });

  const winner = await upsertWinner({
    contestId: (contest as any).id,
    username: parsed.winner.username,
    points: parsed.winner.points,
    maxEntries: parsed.winner.maxEntries ?? null,
  });

  const lineup = await upsertLineup({
    winnerId: (winner as any).id,
    slateType,
    salaryUsed: parsed.lineup.salaryUsed ?? null,
    totalPoints: parsed.lineup.totalPoints,
    totalOwnershipBp,
  });

  await replaceLineupItems((lineup as any).id, parsed.lineup.items, sport);

  console.log(`Imported ${sport} ${parsed.year} WK${parsed.week} ${slateType} (${path.basename(filePath)})`);
}

async function run() {
  const { targetPath } = parseArgs();
  const abs = path.isAbsolute(targetPath) ? targetPath : path.join(process.cwd(), targetPath);
  await importOneFile(abs);
}

run()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
