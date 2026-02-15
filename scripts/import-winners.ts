/* scripts/import-winners.ts
 *
 * Path A: Importer NEVER creates Team or Player.
 * It connects existing records only.
 * If missing Team/Player, it throws a single clear error listing exactly what is missing.
 *
 * Prisma setup:
 * This repo uses Prisma "engine type client" and requires an adapter.
 * We use @prisma/adapter-pg + pg Pool.
 *
 * Ownership rules (must stay exact):
 * - SHOWDOWN: If rosterSpot is CAPTAIN, store captain ownership only
 * - SHOWDOWN: If rosterSpot is FLEX, store flex ownership only
 * - CLASSIC: store classic ownership only
 * - Do NOT store both.
 */

import fs from "fs";
import path from "path";
import { PrismaClient, Sport, SlateType, LineupType, RosterSpot } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

/* ------------------------- Prisma client (adapter) ------------------------- */

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is missing. Ensure dotenv_config_path=.env.local and .env.local contains DATABASE_URL."
  );
}

const pool = new Pool({ connectionString: DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

/* ----------------------------- CLI parsing ----------------------------- */

function getArgValue(flag: string): string | null {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return null;
  const val = process.argv[idx + 1];
  if (!val || val.startsWith("--")) return null;
  return val;
}

function requirePathArg(): string {
  const p = getArgValue("--path");
  if (!p) {
    throw new Error(
      "Missing required argument --path\n" +
        "Example:\n" +
        "dotenv_config_path=.env.local node -r dotenv/config node_modules/.bin/tsx scripts/import-winners.ts --path data/import/nfl/2025/showdown/MNF/wk05_mnf.json"
    );
  }
  return p;
}

function readJsonFile<T>(filePath: string): T {
  const raw = fs.readFileSync(filePath, "utf8");
  try {
    return JSON.parse(raw) as T;
  } catch (e: any) {
    throw new Error(`Failed to parse JSON: ${filePath}\n${e?.message ?? e}`);
  }
}

/* ----------------------------- Input types ----------------------------- */

type ImportContest = {
  site: string;
  contestName: string;
  siteContestId?: string | null;
  entryFeeCents?: number | null;
  entries?: number | null;
  topPrizeCents?: number | null;
  totalOwnershipBp?: number | null;
};

type ImportWinner = {
  username: string;
  points: number;
  maxEntries?: number | null;
};

type ImportLineupItem = {
  rosterSpot: string;
  name: string;
  position: string;
  team: string;
  dkPlayerId?: number | null;
  salary?: number | null;
  points?: number | null;

  ownership?: number | string | null;

  captainPct?: number | string | null;
  captainPercent?: number | string | null;
  captainOwnershipPct?: number | string | null;
  ownershipCaptainPct?: number | string | null;
  captain_ownership_pct?: number | string | null;
  captainOwnershipPercent?: number | string | null;

  ownershipPct?: number | string | null;
  ownershipPercent?: number | string | null;
  flexPct?: number | string | null;
  flexPercent?: number | string | null;
  flexOwnershipPct?: number | string | null;
  ownershipFlexPct?: number | string | null;
  flex_ownership_pct?: number | string | null;
};

type ImportFile = {
  sport: string;
  year: number;
  week?: number | null;
  slateType?: string | null;
  slateDate: string;
  contest: ImportContest;
  winner: ImportWinner;
  lineup: {
    salaryUsed?: number | null;
    totalPoints?: number | null;
    items: ImportLineupItem[];
  };
};

/* ---------------------------- Slate detection --------------------------- */

function detectSlateTypeFromPath(filePath: string): SlateType | null {
  const normalized = filePath.replace(/\\/g, "/").toUpperCase();

  if (normalized.includes("/SUPER BOWL/") || normalized.includes("/SUPER_BOWL/")) return SlateType.SUPER_BOWL;

  if (normalized.includes("/MNF/")) return SlateType.MNF;
  if (normalized.includes("/TNF/")) return SlateType.TNF;
  if (normalized.includes("/SNF/")) return SlateType.SNF;

  if (normalized.includes("/SHOWDOWN/")) return SlateType.SHOWDOWN;
  if (normalized.includes("/MAIN/")) return SlateType.MAIN;

  return null;
}

function parseSlateType(input: string | null | undefined): SlateType | null {
  if (!input) return null;
  const up = String(input).toUpperCase().trim();
  const allowed = new Set(Object.values(SlateType));
  if (allowed.has(up as SlateType)) return up as SlateType;
  return null;
}

function slateTypeToLineupType(slateType: SlateType): LineupType {
  return slateType === SlateType.MAIN ? LineupType.CLASSIC : LineupType.SHOWDOWN;
}

function buildSlateKey(params: {
  sport: Sport;
  year: number;
  week?: number | null;
  slateType: SlateType;
  slateDate: Date;
  teamAbbrs: string[];
}): string {
  const datePart = params.slateDate.toISOString().slice(0, 10);
  const wk = params.week ?? null;

  const teams = Array.from(new Set(params.teamAbbrs.map((t) => t.toUpperCase().trim())))
    .filter(Boolean)
    .sort()
    .join("_");

  const wkPart = wk === null ? "WKNA" : `WK${String(wk).padStart(2, "0")}`;
  return `${params.sport}_${params.year}_${wkPart}_${params.slateType}_${datePart}_${teams}`;
}

/* --------------------------- Ownership handling -------------------------- */

const CAPTAIN_KEYS = [
  "captainPct",
  "captainPercent",
  "captainOwnershipPct",
  "ownershipCaptainPct",
  "captain_ownership_pct",
  "captainOwnershipPercent",
] as const;

const FLEX_KEYS = [
  "ownershipPct",
  "ownershipPercent",
  "flexPct",
  "flexPercent",
  "flexOwnershipPct",
  "ownershipFlexPct",
  "flex_ownership_pct",
] as const;

const GENERIC_KEYS = ["ownership"] as const;

function parsePctValue(value: unknown): number | null {
  if (value === null || value === undefined) return null;

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    if (value > 0 && value <= 1) return value * 100;
    return value;
  }

  if (typeof value === "string") {
    const cleaned = value.trim().replace("%", "");
    if (!cleaned) return null;
    const num = Number(cleaned);
    if (!Number.isFinite(num)) return null;
    if (num > 0 && num <= 1) return num * 100;
    return num;
  }

  return null;
}

function pickFirstPct(obj: Record<string, any>, keys: readonly string[]): number | null {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null) {
      const pct = parsePctValue(obj[k]);
      if (pct !== null) return pct;
    }
  }
  return null;
}

function pctToBp(pct: number): number {
  return Math.round(pct * 100);
}

// CLASSIC: read from FLEX_KEYS/GENERIC_KEYS (ownershipPercent is usually here)
// SHOWDOWN: CAPTAIN from CAPTAIN_KEYS (fallback to ownershipPercent), FLEX from FLEX_KEYS
function extractRelevantOwnership(
  item: ImportLineupItem,
  rosterSpot: RosterSpot,
  lineupType: LineupType
): { pct: number | null; bp: number | null } {
  const anyObj = item as any;

  if (lineupType === LineupType.CLASSIC) {
    const pct = pickFirstPct(anyObj, FLEX_KEYS) ?? pickFirstPct(anyObj, GENERIC_KEYS);
    return { pct, bp: pct === null ? null : pctToBp(pct) };
  }

  if (rosterSpot === RosterSpot.CAPTAIN) {
    const pct =
      pickFirstPct(anyObj, CAPTAIN_KEYS) ??
      pickFirstPct(anyObj, ["ownershipPercent", "ownershipPct"] as const) ??
      pickFirstPct(anyObj, GENERIC_KEYS);

    return { pct, bp: pct === null ? null : pctToBp(pct) };
  }

  if (rosterSpot === RosterSpot.FLEX) {
    const pct = pickFirstPct(anyObj, FLEX_KEYS) ?? pickFirstPct(anyObj, GENERIC_KEYS);
    return { pct, bp: pct === null ? null : pctToBp(pct) };
  }

  const pct = pickFirstPct(anyObj, GENERIC_KEYS);
  return { pct, bp: pct === null ? null : pctToBp(pct) };
}

/* ----------------------- Missing entities error type --------------------- */

type MissingTeam = { sport: Sport; abbreviation: string };
type MissingPlayer =
  | { mode: "DK_ID"; sport: Sport; dkPlayerId: number }
  | { mode: "NAME_POS_TEAM"; sport: Sport; name: string; position: string; teamAbbreviation: string };

class MissingEntitiesError extends Error {
  missingTeams: MissingTeam[];
  missingPlayers: MissingPlayer[];

  constructor(missingTeams: MissingTeam[], missingPlayers: MissingPlayer[]) {
    super("Missing required Teams/Players. Seed them first.");
    this.missingTeams = missingTeams;
    this.missingPlayers = missingPlayers;
  }
}

/* --------------------------------- Main --------------------------------- */

async function main() {
  const filePath = requirePathArg();
  const absPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);

  const data = readJsonFile<ImportFile>(absPath);

  const sportStr = String(data.sport).toUpperCase().trim();
  if (sportStr !== "NFL" && sportStr !== "CFB") {
    throw new Error(`Invalid sport in JSON: "${data.sport}" (expected "NFL" or "CFB")`);
  }
  const sport = sportStr as Sport;

  const year = data.year;
  const week = data.week ?? null;

  const slateDate = new Date(data.slateDate);
  if (Number.isNaN(slateDate.getTime())) {
    throw new Error(`Invalid slateDate: "${data.slateDate}"`);
  }

  const slateTypeFromPath = detectSlateTypeFromPath(filePath);
  const slateTypeFromJson = parseSlateType(data.slateType ?? null);

  const slateType: SlateType = slateTypeFromPath ?? slateTypeFromJson ?? SlateType.SHOWDOWN;
  const lineupType = slateTypeToLineupType(slateType);

  const teamAbbrs = data.lineup.items.map((i) => String(i.team).toUpperCase().trim()).filter(Boolean);
  const slateKey = buildSlateKey({ sport, year, week, slateType, slateDate, teamAbbrs });

  const season = await prisma.season.upsert({
    where: { year_sport: { year, sport } },
    create: { year, sport },
    update: {},
  });

  const slateDbType: SlateType = slateType;
  const slateTag = String(slateType).toLowerCase();

  const slateName =
    data.contest?.contestName?.trim() ||
    (slateType === SlateType.MAIN ? "Main" : `${String(slateType).replace(/_/g, " ")} Showdown`);

  const slate = await prisma.slate.upsert({
    where: { slateKey },
    create: {
      seasonId: season.id,
      week: week ?? undefined,
      slateType: slateDbType,
      slateDate,
      lineupType,
      slateKey,
      slateName,
      slateTag,
      slateGroup: "_",
      isMain: slateDbType === SlateType.MAIN,
    },
    update: {
      week: week ?? undefined,
      slateType: slateDbType,
      slateDate,
      lineupType,
      slateName,
      slateTag,
      slateGroup: "_",
      isMain: slateDbType === SlateType.MAIN,
    },
  });

  if (!data.contest || !data.contest.site || !data.contest.contestName) {
    throw new Error("JSON missing contest.site or contest.contestName");
  }

  const contest = await prisma.contest.upsert({
    where: {
      site_siteContestId: {
        site: data.contest.site,
        siteContestId: data.contest.siteContestId ?? null,
      },
    },
    create: {
      slateId: slate.id,
      site: data.contest.site,
      siteContestId: data.contest.siteContestId ?? null,
      contestName: data.contest.contestName,
      entryFeeCents: data.contest.entryFeeCents ?? null,
      entries: data.contest.entries ?? null,
      topPrizeCents: data.contest.topPrizeCents ?? null,
      totalOwnershipBp: data.contest.totalOwnershipBp ?? null,
    },
    update: {
      slateId: slate.id,
      contestName: data.contest.contestName,
      entryFeeCents: data.contest.entryFeeCents ?? null,
      entries: data.contest.entries ?? null,
      topPrizeCents: data.contest.topPrizeCents ?? null,
      totalOwnershipBp: data.contest.totalOwnershipBp ?? null,
    },
  });

  if (!data.winner || !data.winner.username || typeof data.winner.points !== "number") {
    throw new Error("JSON missing winner.username or winner.points");
  }

  const winner = await prisma.winner.upsert({
    where: { contestId_username: { contestId: contest.id, username: data.winner.username } },
    create: {
      contestId: contest.id,
      username: data.winner.username,
      points: data.winner.points,
      maxEntries: data.winner.maxEntries ?? null,
    },
    update: {
      points: data.winner.points,
      maxEntries: data.winner.maxEntries ?? null,
    },
  });

  const lineup = await prisma.lineup.upsert({
    where: { winnerId: winner.id },
    create: {
      winnerId: winner.id,
      lineupType,
      salaryUsed: data.lineup.salaryUsed ?? null,
      totalPoints: data.lineup.totalPoints ?? data.winner.points ?? null,
    },
    update: {
      lineupType,
      salaryUsed: data.lineup.salaryUsed ?? null,
      totalPoints: data.lineup.totalPoints ?? data.winner.points ?? null,
    },
  });

  /* -------------------- Path A resolve Teams and Players -------------------- */

  const missingTeams: MissingTeam[] = [];
  const missingPlayers: MissingPlayer[] = [];

  const neededTeamAbbrs = Array.from(
    new Set(data.lineup.items.map((i) => String(i.team).toUpperCase().trim()).filter(Boolean))
  );

  const existingTeams = await prisma.team.findMany({
    where: { sport, abbreviation: { in: neededTeamAbbrs } },
    select: { id: true, abbreviation: true },
  });

  const teamIdByAbbr = new Map<string, string>();
  for (const t of existingTeams) teamIdByAbbr.set(t.abbreviation.toUpperCase(), t.id);

  for (const abbr of neededTeamAbbrs) {
    if (!teamIdByAbbr.has(abbr)) missingTeams.push({ sport, abbreviation: abbr });
  }

  if (missingTeams.length > 0) {
    throw new MissingEntitiesError(missingTeams, []);
  }

  const items = data.lineup.items;

  const slotCounters: Record<string, number> = {};

  type Candidate = {
    idx: number;
    rosterSpot: RosterSpot;
    slotIndex: number;
    teamAbbr: string;
    teamId: string;
    dkPlayerId: number | null;
    name: string;
    position: string;
  };

  const candidates: Candidate[] = [];

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const rs = String(it.rosterSpot).toUpperCase().trim() as RosterSpot;

    if (!Object.values(RosterSpot).includes(rs)) {
      throw new Error(`Invalid rosterSpot "${it.rosterSpot}" at lineup.items[${i}]`);
    }

    const slotIndex = slotCounters[rs] ?? 0;
    slotCounters[rs] = slotIndex + 1;

    const teamAbbr = String(it.team).toUpperCase().trim();
    const teamId = teamIdByAbbr.get(teamAbbr);
    if (!teamId) {
      missingTeams.push({ sport, abbreviation: teamAbbr });
      continue;
    }

    candidates.push({
      idx: i,
      rosterSpot: rs,
      slotIndex,
      teamAbbr,
      teamId,
      dkPlayerId: it.dkPlayerId ?? null,
      name: it.name,
      position: it.position,
    });
  }

  const dkIds = Array.from(
    new Set(candidates.map((c) => c.dkPlayerId).filter((v): v is number => typeof v === "number"))
  );
  const playersByDkId = new Map<number, string>();

  if (dkIds.length > 0) {
    const found = await prisma.player.findMany({
      where: { sport, dkPlayerId: { in: dkIds } },
      select: { id: true, dkPlayerId: true },
    });
    for (const p of found) {
      if (p.dkPlayerId !== null) playersByDkId.set(p.dkPlayerId, p.id);
    }
  }

  const needComposite = candidates.filter((c) => c.dkPlayerId === null || !playersByDkId.has(c.dkPlayerId));
  const playerIdByComposite = new Map<string, string>();

  if (needComposite.length > 0) {
    const teamIds = Array.from(new Set(needComposite.map((c) => c.teamId)));
    const found = await prisma.player.findMany({
      where: { sport, teamId: { in: teamIds } },
      select: { id: true, name: true, position: true, teamId: true },
    });
    for (const p of found) {
      playerIdByComposite.set(`${p.name}|||${p.position}|||${p.teamId}`, p.id);
    }
  }

  const resolvedPlayerIdByIndex = new Map<number, string>();

  for (const c of candidates) {
    if (c.dkPlayerId !== null) {
      const pid = playersByDkId.get(c.dkPlayerId);
      if (pid) {
        resolvedPlayerIdByIndex.set(c.idx, pid);
        continue;
      }
    }

    const key = `${c.name}|||${c.position}|||${c.teamId}`;
    const pid2 = playerIdByComposite.get(key);
    if (pid2) {
      resolvedPlayerIdByIndex.set(c.idx, pid2);
      continue;
    }

    if (c.dkPlayerId !== null) {
      missingPlayers.push({ mode: "DK_ID", sport, dkPlayerId: c.dkPlayerId });
    } else {
      missingPlayers.push({
        mode: "NAME_POS_TEAM",
        sport,
        name: c.name,
        position: c.position,
        teamAbbreviation: c.teamAbbr,
      });
    }
  }

  if (missingPlayers.length > 0) {
    throw new MissingEntitiesError([], missingPlayers);
  }

  const slotCounters2: Record<string, number> = {};

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const rosterSpot = String(it.rosterSpot).toUpperCase().trim() as RosterSpot;

    const slotIndex = slotCounters2[rosterSpot] ?? 0;
    slotCounters2[rosterSpot] = slotIndex + 1;

    const playerId = resolvedPlayerIdByIndex.get(i);
    if (!playerId) throw new Error(`Internal error: playerId not resolved for lineup.items[${i}]`);

   const { bp } = extractRelevantOwnership(it, rosterSpot);

const isClassic = lineupType === LineupType.CLASSIC;

// Showdown stores spot specific
const ownershipCaptainBp = !isClassic && rosterSpot === RosterSpot.CAPTAIN ? bp : null;
const ownershipFlexBp = !isClassic && rosterSpot === RosterSpot.FLEX ? bp : null;

// Classic stores everything into ownershipClassicBp
const ownershipClassicBp = isClassic ? bp : null;

// Legacy columns stay unused
const legacyOwnership = null;
const legacyOwnershipBp = null;

await prisma.lineupItem.upsert({
  where: { lineupId_rosterSpot_slotIndex: { lineupId: lineup.id, rosterSpot, slotIndex } },
  create: {
    lineupId: lineup.id,
    playerId,
    rosterSpot,
    slotIndex,
    salary: it.salary ?? null,
    points: it.points ?? null,
    ownership: legacyOwnership,
    ownershipBp: legacyOwnershipBp,
    ownershipCaptainBp,
    ownershipFlexBp,
    ownershipClassicBp,
  },
  update: {
    playerId,
    salary: it.salary ?? null,
    points: it.points ?? null,
    ownership: legacyOwnership,
    ownershipBp: legacyOwnershipBp,
    ownershipCaptainBp,
    ownershipFlexBp,
    ownershipClassicBp,
  },
});
  }

  const totalOwnershipBpFromJson = data.contest.totalOwnershipBp ?? null;
  await prisma.lineup.update({ where: { id: lineup.id }, data: { totalOwnershipBp: totalOwnershipBpFromJson } });
  await prisma.contest.update({ where: { id: contest.id }, data: { totalOwnershipBp: totalOwnershipBpFromJson } });

  console.log(
    JSON.stringify(
      {
        ok: true,
        file: filePath,
        slateKey,
        slateType,
        lineupType,
        seasonId: season.id,
        slateId: slate.id,
        contestId: contest.id,
        winnerId: winner.id,
        lineupId: lineup.id,
        lineupItemCount: items.length,
        totalOwnershipBp: totalOwnershipBpFromJson,
      },
      null,
      2
    )
  );
}

main()
  .catch((err: any) => {
    if (err instanceof MissingEntitiesError) {
      const lines: string[] = [];
      lines.push("Importer failed because required Teams/Players are missing.");
      lines.push("");

      if (err.missingTeams.length > 0) {
        lines.push("Missing Teams (seed these first):");
        const uniq = new Map<string, MissingTeam>();
        for (const t of err.missingTeams) uniq.set(`${t.sport}:${t.abbreviation}`, t);
        for (const t of Array.from(uniq.values()).sort((a, b) =>
          `${a.sport}:${a.abbreviation}`.localeCompare(`${b.sport}:${b.abbreviation}`)
        )) {
          lines.push(`  - (${t.sport}, ${t.abbreviation})`);
        }
        lines.push("");
      }

      if (err.missingPlayers.length > 0) {
        lines.push("Missing Players (seed these first):");
        const uniq = new Map<string, MissingPlayer>();
        for (const p of err.missingPlayers) {
          if (p.mode === "DK_ID") uniq.set(`${p.sport}:dk:${p.dkPlayerId}`, p);
          else uniq.set(`${p.sport}:n:${p.name}:p:${p.position}:t:${p.teamAbbreviation}`, p);
        }
        for (const p of Array.from(uniq.values()).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))) {
          if (p.mode === "DK_ID") lines.push(`  - (${p.sport}, dkPlayerId=${p.dkPlayerId})`);
          else lines.push(`  - (${p.sport}, "${p.name}", ${p.position}, team=${p.teamAbbreviation})`);
        }
        lines.push("");
      }

      console.error(lines.join("\n"));
      process.exit(1);
    }

    console.error(err?.stack ?? err?.message ?? err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
