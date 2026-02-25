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
import {
  PrismaClient,
  Sport,
  SlateType,
  LineupType,
  RosterSpot,
  CorrelationType,
} from "@prisma/client";
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

  passYds?: number | null;
  passTd?: number | null;
  passInt?: number | null;
  rushYds?: number | null;
  rushTd?: number | null;

  rushAtt?: number | null;
  rushYdsRb?: number | null;
  rushTdRb?: number | null;
  targetsRb?: number | null;
  recRb?: number | null;
  recYdsRb?: number | null;
  recTdRb?: number | null;

  targets?: number | null;
  rec?: number | null;
  recYds?: number | null;
  recTd?: number | null;

  // DST override (Option A): if provided, importer resolves Player and stores opponentStartingQbPlayerId
  qbFaced?: string | null;
  opponentStartingQbName?: string | null;

  pointsAllowedBucket?: number | null;
  defensiveTdCount?: number | null;
  sacks?: number | null;
  takeaways?: number | null;

  // optional context keys (ignored by DB, used only for schedule linking elsewhere)
  gameAwayTeam?: string | null;
  gameHomeTeam?: string | null;
  opponentTeam?: string | null;
};

type ImportContestAnalysisFlat = {
  stackSummary?: string | null;
  uniquenessNotes?: string | null;
  stackMeta?: any | null;
};

type ImportLineupAnalysis = {
  archetypeTags?: any | null;
  macroStory?: string | null;
  earlyCount?: number | null;
  lateCount?: number | null;
  primeCount?: number | null;
};

type ImportLineupItemAnalysis = {
  rosterSpot: string;
  slotIndex: number;
  roleTags?: any | null;
  microStory?: string | null;
};

type ImportPlayerRef = {
  dkPlayerId?: number | null;
  name?: string | null;
  position?: string | null;
  team?: string | null;
};

type ImportCorrelation = {
  type: string;
  qb: ImportPlayerRef;
  teammate?: ImportPlayerRef | null;
  opponent?: ImportPlayerRef | null;
};

type ImportAnalysis = ImportContestAnalysisFlat & {
  contestAnalysis?: ImportContestAnalysisFlat | null;

  lineupAnalysis?: ImportLineupAnalysis | null;
  lineupItemAnalysis?: ImportLineupItemAnalysis[] | null;

  correlations?: ImportCorrelation[] | null;
};

type ImportFile = {
  sport: string;
  year: number;
  week?: number | null;
  slateType?: string | null;
  slateDate: string;

  slateName?: string | null;
  slateTag?: string | null;
  slateGroup?: string | null;
  isMain?: boolean | null;

  contest: ImportContest;
  winner: ImportWinner;
  lineup: {
    salaryUsed?: number | null;
    totalPoints?: number | null;
    totalOwnershipBp?: number | null;
    items: ImportLineupItem[];
  };
  analysis?: ImportAnalysis | null;
};

/* ---------------------------- Slate detection --------------------------- */

function detectSlateTypeFromPath(filePath: string): SlateType | null {
  const normalized = filePath.replace(/\\/g, "/").toUpperCase();

  if (normalized.includes("/SUPER BOWL/") || normalized.includes("/SUPER_BOWL/"))
    return SlateType.SUPER_BOWL;

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
    return value;
  }

  if (typeof value === "string") {
    const s = value.trim();
    if (!s) return null;

    const cleaned = s.replace("%", "").trim();
    if (!cleaned) return null;

    const num = Number(cleaned);
    if (!Number.isFinite(num)) return null;

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
  | {
      mode: "NAME_POS_TEAM";
      sport: Sport;
      name: string;
      position: string;
      teamAbbreviation: string;
      suggestions?: string[];
    };

class MissingEntitiesError extends Error {
  missingTeams: MissingTeam[];
  missingPlayers: MissingPlayer[];

  constructor(missingTeams: MissingTeam[], missingPlayers: MissingPlayer[]) {
    super("Missing required Teams/Players. Seed them first.");
    this.missingTeams = missingTeams;
    this.missingPlayers = missingPlayers;
  }
}

/* ------------------------------- helpers ------------------------------- */

function cleanString(v: any): string | null {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

function getOpponentTeamAbbrFromItem(it: any): string | null {
  const dstTeam = String(it?.team ?? "").trim().toUpperCase();
  const opp = String(it?.opponentTeam ?? "").trim().toUpperCase();
  if (opp) return opp;

  const away = String(it?.gameAwayTeam ?? "").trim().toUpperCase();
  const home = String(it?.gameHomeTeam ?? "").trim().toUpperCase();
  if (dstTeam && away && home) {
    if (dstTeam === home) return away;
    if (dstTeam === away) return home;
  }

  return null;
}

function normalizeContestAnalysis(analysis: ImportAnalysis | null | undefined): ImportContestAnalysisFlat | null {
  if (!analysis) return null;

  const a = analysis.contestAnalysis ?? analysis;

  const stackSummary = cleanString((a as any).stackSummary);
  const uniquenessNotes = cleanString((a as any).uniquenessNotes);
  const stackMeta = (a as any).stackMeta ?? null;

  if (!stackSummary && !uniquenessNotes && !stackMeta) return null;

  return {
    stackSummary: stackSummary ?? null,
    uniquenessNotes: uniquenessNotes ?? null,
    stackMeta: stackMeta ?? null,
  };
}

function normalizeLineupAnalysis(analysis: ImportAnalysis | null | undefined): ImportLineupAnalysis | null {
  if (!analysis || !analysis.lineupAnalysis) return null;
  const la = analysis.lineupAnalysis;

  const archetypeTags = la.archetypeTags ?? null;
  const macroStory = cleanString(la.macroStory) ?? null;

  const earlyCount = typeof la.earlyCount === "number" ? la.earlyCount : null;
  const lateCount = typeof la.lateCount === "number" ? la.lateCount : null;
  const primeCount = typeof la.primeCount === "number" ? la.primeCount : null;

  if (!archetypeTags && !macroStory && earlyCount === null && lateCount === null && primeCount === null) return null;

  return { archetypeTags, macroStory, earlyCount, lateCount, primeCount };
}

function normalizeItemAnalyses(analysis: ImportAnalysis | null | undefined): ImportLineupItemAnalysis[] {
  if (!analysis || !Array.isArray(analysis.lineupItemAnalysis)) return [];
  return analysis.lineupItemAnalysis
    .map((x) => ({
      rosterSpot: String(x.rosterSpot ?? "").toUpperCase().trim(),
      slotIndex: Number(x.slotIndex),
      roleTags: x.roleTags ?? null,
      microStory: cleanString(x.microStory) ?? null,
    }))
    .filter((x) => x.rosterSpot && Number.isFinite(x.slotIndex));
}

function parseCorrelationType(v: any): CorrelationType | null {
  const s = String(v ?? "").toUpperCase().trim();
  if (s === "STACK") return CorrelationType.STACK;
  if (s === "BRINGBACK" || s === "BRING_BACK") return CorrelationType.BRINGBACK;
  return null;
}

function normName(v: any): string {
  return String(v ?? "")
    .trim()
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function splitName(v: any): { first: string; last: string } {
  const n = normName(v);
  if (!n) return { first: "", last: "" };
  const parts = n.split(" ").filter(Boolean);
  if (parts.length === 0) return { first: "", last: "" };
  if (parts.length === 1) return { first: parts[0], last: parts[0] };
  return { first: parts[0], last: parts[parts.length - 1] };
}

function namesCompatible(a: any, b: any): boolean {
  const na = normName(a);
  const nb = normName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;

  const aParts = splitName(na);
  const bParts = splitName(nb);
  if (!aParts.last || !bParts.last || aParts.last !== bParts.last) return false;
  if (!aParts.first || !bParts.first) return false;

  return aParts.first[0] === bParts.first[0];
}

function nameLooksLike(dbName: string, input: string): boolean {
  const a = normName(dbName);
  const b = normName(input);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;

  const aParts = a.split(" ");
  const bParts = b.split(" ");
  const aLast = aParts[aParts.length - 1] || "";
  const bLast = bParts[bParts.length - 1] || "";
  if (!aLast || !bLast) return false;
  if (aLast !== bLast) return false;

  const aFirst = aParts[0] || "";
  const bFirst = bParts[0] || "";
  if (!aFirst || !bFirst) return false;

  return aFirst[0] === bFirst[0];
}

function buildTeamPosKey(teamId: string, position: string): string {
  return `${teamId}|||${position}`;
}

function getLastName(v: any): string {
  return splitName(v).last;
}

function getSuggestionsForName(params: {
  name: string;
  position: string;
  teamId: string;
  playersByTeamPos: Map<string, { id: string; name: string }[]>;
}): string[] {
  const targetLast = getLastName(params.name);
  if (!targetLast) return [];
  const key = buildTeamPosKey(params.teamId, params.position);
  const candidates = params.playersByTeamPos.get(key) ?? [];
  const hits = candidates
    .filter((c) => getLastName(c.name) === targetLast)
    .map((c) => c.name);
  return Array.from(new Set(hits)).sort((a, b) => a.localeCompare(b));
}

function resolvePlayerIdByName(params: {
  name: string;
  position: string;
  teamId: string;
  allowInitials: boolean;
  playerIdByComposite: Map<string, string>;
  playersByTeamPos: Map<string, { id: string; name: string }[]>;
}): { id: string | null; suggestions: string[] } {
  const key = `${params.name}|||${params.position}|||${params.teamId}`;
  const exact = params.playerIdByComposite.get(key);
  if (exact) return { id: exact, suggestions: [] };

  const suggestions = getSuggestionsForName(params);
  if (!params.allowInitials) return { id: null, suggestions };

  const teamPosKey = buildTeamPosKey(params.teamId, params.position);
  const candidates = params.playersByTeamPos.get(teamPosKey) ?? [];
  const compatible = candidates.filter((c) => namesCompatible(c.name, params.name));

  if (compatible.length === 1) return { id: compatible[0].id, suggestions: [] };

  const exactNorm = compatible.find((c) => normName(c.name) === normName(params.name));
  if (exactNorm) return { id: exactNorm.id, suggestions: [] };

  return { id: null, suggestions };
}

async function resolvePlayerIdByRef(params: {
  sport: Sport;
  teamIdByAbbr: Map<string, string>;
  playersByDkId: Map<number, string>;
  playerIdByComposite: Map<string, string>;
  playersByTeamPos: Map<string, { id: string; name: string }[]>;
  allowInitials: boolean;
  ref: ImportPlayerRef;
}): Promise<string | null> {
  const dkPlayerId = typeof params.ref.dkPlayerId === "number" ? params.ref.dkPlayerId : null;
  if (dkPlayerId !== null) {
    const pid = params.playersByDkId.get(dkPlayerId);
    if (pid) return pid;
  }

  const teamAbbr = String(params.ref.team ?? "").toUpperCase().trim();
  const teamId = teamAbbr ? params.teamIdByAbbr.get(teamAbbr) ?? null : null;

  const name = cleanString(params.ref.name);
  const position = cleanString(params.ref.position);

  if (!teamId || !name || !position) return null;

  const resolved = resolvePlayerIdByName({
    name,
    position,
    teamId,
    allowInitials: params.allowInitials,
    playerIdByComposite: params.playerIdByComposite,
    playersByTeamPos: params.playersByTeamPos,
  });
  return resolved.id ?? null;
}

async function resolveOpponentStartingQbIdByName(params: {
  sport: Sport;
  opponentTeamId: string | null;
  qbNameRaw: string | null;
}): Promise<string | null> {
  const qbName = cleanString(params.qbNameRaw);
  if (!qbName) return null;
  if (!params.opponentTeamId) return null;

  const qbs = await prisma.player.findMany({
    where: { sport: params.sport, position: "QB", teamId: params.opponentTeamId },
    select: { id: true, name: true },
  });

  const hit = qbs.find((p) => nameLooksLike(p.name, qbName));
  return hit?.id ?? null;
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

  if (lineupType === LineupType.CLASSIC && week === null) {
    throw new Error("Classic imports require week for schedule linkage.");
  }

  const teamAbbrs = data.lineup.items.map((i) => String(i.team).toUpperCase().trim()).filter(Boolean);
  const slateKey = buildSlateKey({ sport, year, week, slateType, slateDate, teamAbbrs });

  const season = await prisma.season.upsert({
    where: { year_sport: { year, sport } },
    create: { year, sport },
    update: {},
  });

  const slateDbType: SlateType = slateType;

  const slateTag = cleanString((data as any).slateTag) ?? String(slateType).toLowerCase();
  const slateGroup = cleanString((data as any).slateGroup) ?? "_";

  const slateName =
    cleanString((data as any).slateName) ??
    cleanString(data.contest?.contestName) ??
    (slateType === SlateType.MAIN ? "Main" : `${String(slateType).replace(/_/g, " ")} Showdown`);

  const isMain =
    typeof (data as any).isMain === "boolean"
      ? Boolean((data as any).isMain)
      : slateDbType === SlateType.MAIN;

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
      slateGroup,
      isMain,
    },
    update: {
      week: week ?? undefined,
      slateType: slateDbType,
      slateDate,
      lineupType,
      slateName,
      slateTag,
      slateGroup,
      isMain,
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

  const contestAnalysis = normalizeContestAnalysis(data.analysis ?? null);
  if (contestAnalysis) {
    await prisma.contestAnalysis.upsert({
      where: { contestId: contest.id },
      create: {
        contestId: contest.id,
        stackSummary: contestAnalysis.stackSummary ?? null,
        uniquenessNotes: contestAnalysis.uniquenessNotes ?? null,
        stackMeta: contestAnalysis.stackMeta ?? null,
      },
      update: {
        stackSummary: contestAnalysis.stackSummary ?? null,
        uniquenessNotes: contestAnalysis.uniquenessNotes ?? null,
        stackMeta: contestAnalysis.stackMeta ?? null,
      },
    });
  }

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
      totalOwnershipBp: data.lineup.totalOwnershipBp ?? null,
    },
    update: {
      lineupType,
      salaryUsed: data.lineup.salaryUsed ?? null,
      totalPoints: data.lineup.totalPoints ?? data.winner.points ?? null,
      totalOwnershipBp: data.lineup.totalOwnershipBp ?? null,
    },
  });

  const lineupAnalysis = normalizeLineupAnalysis(data.analysis ?? null);
  if (lineupAnalysis) {
    await prisma.lineupAnalysis.upsert({
      where: { lineupId: lineup.id },
      create: {
        lineupId: lineup.id,
        archetypeTags: lineupAnalysis.archetypeTags ?? null,
        macroStory: lineupAnalysis.macroStory ?? null,
        earlyCount: lineupAnalysis.earlyCount ?? null,
        lateCount: lineupAnalysis.lateCount ?? null,
        primeCount: lineupAnalysis.primeCount ?? null,
      },
      update: {
        archetypeTags: lineupAnalysis.archetypeTags ?? null,
        macroStory: lineupAnalysis.macroStory ?? null,
        earlyCount: lineupAnalysis.earlyCount ?? null,
        lateCount: lineupAnalysis.lateCount ?? null,
        primeCount: lineupAnalysis.primeCount ?? null,
      },
    });
  }

  /* -------------------- Path A resolve Teams and Players -------------------- */

  const missingTeams: MissingTeam[] = [];
  const missingPlayers: MissingPlayer[] = [];
  const allowInitials = process.env.IMPORT_ALLOW_INITIALS === "1";

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
  const playersByTeamPos = new Map<string, { id: string; name: string }[]>();

  if (needComposite.length > 0) {
    const teamIds = Array.from(new Set(needComposite.map((c) => c.teamId)));
    const found = await prisma.player.findMany({
      where: { sport, teamId: { in: teamIds } },
      select: { id: true, name: true, position: true, teamId: true },
    });
    for (const p of found) {
      playerIdByComposite.set(`${p.name}|||${p.position}|||${p.teamId}`, p.id);
      const key = buildTeamPosKey(p.teamId, p.position);
      const list = playersByTeamPos.get(key) ?? [];
      list.push({ id: p.id, name: p.name });
      playersByTeamPos.set(key, list);
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

    const resolved = resolvePlayerIdByName({
      name: c.name,
      position: c.position,
      teamId: c.teamId,
      allowInitials,
      playerIdByComposite,
      playersByTeamPos,
    });

    if (resolved.id) {
      resolvedPlayerIdByIndex.set(c.idx, resolved.id);
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
        suggestions: resolved.suggestions,
      });
    }
  }

  if (missingPlayers.length > 0) {
    throw new MissingEntitiesError([], missingPlayers);
  }

  // -------------------- Resolve games from seeded schedule --------------------
  // Game model uses seasonId, not seasonYear.

  const games =
    week !== null
      ? await prisma.game.findMany({
          where: { sport, seasonId: season.id, week },
          select: {
            id: true,
            homeTeamId: true,
            awayTeamId: true,
            window: true,
            homeStartingQbPlayerId: true,
            awayStartingQbPlayerId: true,
          },
        })
      : [];

  const gameByTeamId = new Map<
    string,
    { gameId: string; opponentTeamId: string; opponentStartingQbPlayerId: string | null }
  >();

  for (const g of games) {
    gameByTeamId.set(g.homeTeamId, {
      gameId: g.id,
      opponentTeamId: g.awayTeamId,
      opponentStartingQbPlayerId: g.awayStartingQbPlayerId ?? null,
    });
    gameByTeamId.set(g.awayTeamId, {
      gameId: g.id,
      opponentTeamId: g.homeTeamId,
      opponentStartingQbPlayerId: g.homeStartingQbPlayerId ?? null,
    });
  }

  const teamIdByLineupIndex = new Map<number, string>();
  for (const c of candidates) teamIdByLineupIndex.set(c.idx, c.teamId);

  const slotCounters2: Record<string, number> = {};
  const lineupItemIdByKey = new Map<string, string>();

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const rosterSpot = String(it.rosterSpot).toUpperCase().trim() as RosterSpot;

    const slotIndex = slotCounters2[rosterSpot] ?? 0;
    slotCounters2[rosterSpot] = slotIndex + 1;

    const playerId = resolvedPlayerIdByIndex.get(i);
    if (!playerId) throw new Error(`Internal error: playerId not resolved for lineup.items[${i}]`);

    const { bp } = extractRelevantOwnership(it, rosterSpot, lineupType);

    const isClassic = lineupType === LineupType.CLASSIC;

    const ownershipCaptainBp = !isClassic && rosterSpot === RosterSpot.CAPTAIN ? bp : null;
    const ownershipFlexBp = !isClassic && rosterSpot === RosterSpot.FLEX ? bp : null;
    const ownershipClassicBp = isClassic ? bp : null;

    const legacyOwnership = null;
    const legacyOwnershipBp = null;

    const teamId = teamIdByLineupIndex.get(i) ?? null;
    const gameLink = teamId ? (gameByTeamId.get(teamId) ?? null) : null;

    const gameId = gameLink ? gameLink.gameId : null;

    // allow opponentTeamId to come from schedule link OR from the JSON (DST only)
    let opponentTeamId: string | null = gameLink ? gameLink.opponentTeamId : null;

    if (rosterSpot === RosterSpot.DST && !opponentTeamId) {
      const oppAbbr = getOpponentTeamAbbrFromItem(it);
      if (oppAbbr) opponentTeamId = teamIdByAbbr.get(oppAbbr) ?? null;
    }

    const qbNameOverride =
      cleanString((it as any).qbFaced) ??
      cleanString((it as any).opponentStartingQbName) ??
      null;

    const overrideOpponentQbId =
      rosterSpot === RosterSpot.DST
        ? await resolveOpponentStartingQbIdByName({ sport, opponentTeamId, qbNameRaw: qbNameOverride })
        : null;

    const opponentStartingQbPlayerId =
      rosterSpot === RosterSpot.DST
        ? (overrideOpponentQbId ?? (gameLink ? gameLink.opponentStartingQbPlayerId : null))
        : null;

    const saved = await prisma.lineupItem.upsert({
      where: { lineupId_rosterSpot_slotIndex: { lineupId: lineup.id, rosterSpot, slotIndex } },
      create: {
        lineupId: lineup.id,
        playerId,
        rosterSpot,
        slotIndex,

        gameId,
        opponentTeamId,
        opponentStartingQbPlayerId,

        salary: it.salary ?? null,
        points: it.points ?? null,

        ownership: legacyOwnership,
        ownershipBp: legacyOwnershipBp,

        ownershipCaptainBp,
        ownershipFlexBp,
        ownershipClassicBp,

        passYds: it.passYds ?? null,
        passTd: it.passTd ?? null,
        passInt: it.passInt ?? null,
        rushYds: it.rushYds ?? null,
        rushTd: it.rushTd ?? null,

        rushAtt: it.rushAtt ?? null,
        rushYdsRb: it.rushYdsRb ?? null,
        rushTdRb: it.rushTdRb ?? null,
        targetsRb: it.targetsRb ?? null,
        recRb: it.recRb ?? null,
        recYdsRb: it.recYdsRb ?? null,
        recTdRb: it.recTdRb ?? null,

        targets: it.targets ?? null,
        rec: it.rec ?? null,
        recYds: it.recYds ?? null,
        recTd: it.recTd ?? null,

        pointsAllowedBucket: it.pointsAllowedBucket ?? null,
        defensiveTdCount: it.defensiveTdCount ?? null,
        sacks: it.sacks ?? null,
        takeaways: it.takeaways ?? null,
      },
      update: {
        playerId,

        gameId,
        opponentTeamId,
        opponentStartingQbPlayerId,

        salary: it.salary ?? null,
        points: it.points ?? null,

        ownership: legacyOwnership,
        ownershipBp: legacyOwnershipBp,

        ownershipCaptainBp,
        ownershipFlexBp,
        ownershipClassicBp,

        passYds: it.passYds ?? null,
        passTd: it.passTd ?? null,
        passInt: it.passInt ?? null,
        rushYds: it.rushYds ?? null,
        rushTd: it.rushTd ?? null,

        rushAtt: it.rushAtt ?? null,
        rushYdsRb: it.rushYdsRb ?? null,
        rushTdRb: it.rushTdRb ?? null,
        targetsRb: it.targetsRb ?? null,
        recRb: it.recRb ?? null,
        recYdsRb: it.recYdsRb ?? null,
        recTdRb: it.recTdRb ?? null,

        targets: it.targets ?? null,
        rec: it.rec ?? null,
        recYds: it.recYds ?? null,
        recTd: it.recTd ?? null,

        pointsAllowedBucket: it.pointsAllowedBucket ?? null,
        defensiveTdCount: it.defensiveTdCount ?? null,
        sacks: it.sacks ?? null,
        takeaways: it.takeaways ?? null,
      },
      select: { id: true },
    });

    lineupItemIdByKey.set(`${rosterSpot}:${slotIndex}`, saved.id);
  }

  const itemAnalyses = normalizeItemAnalyses(data.analysis ?? null);
  if (itemAnalyses.length > 0) {
    for (const ia of itemAnalyses) {
      const rs = ia.rosterSpot as RosterSpot;
      if (!Object.values(RosterSpot).includes(rs)) continue;

      const key = `${rs}:${ia.slotIndex}`;
      const lineupItemId = lineupItemIdByKey.get(key);
      if (!lineupItemId) continue;

      await prisma.lineupItemAnalysis.upsert({
        where: { lineupItemId },
        create: {
          lineupItemId,
          roleTags: ia.roleTags ?? null,
          microStory: ia.microStory ?? null,
        },
        update: {
          roleTags: ia.roleTags ?? null,
          microStory: ia.microStory ?? null,
        },
      });
    }
  }

  const correlations = Array.isArray(data.analysis?.correlations) ? data.analysis?.correlations ?? [] : [];
  if (correlations.length > 0) {
    await prisma.lineupCorrelation.deleteMany({ where: { lineupId: lineup.id } });

    for (const c of correlations) {
      const type = parseCorrelationType(c.type);
      if (!type) continue;

      const qbId = await resolvePlayerIdByRef({
        sport,
        teamIdByAbbr,
        playersByDkId,
        playerIdByComposite,
        playersByTeamPos,
        allowInitials,
        ref: c.qb ?? {},
      });

      if (!qbId) continue;

      const mateId =
        c.teammate
          ? await resolvePlayerIdByRef({
              sport,
              teamIdByAbbr,
              playersByDkId,
              playerIdByComposite,
              playersByTeamPos,
              allowInitials,
              ref: c.teammate,
            })
          : null;

      const oppId =
        c.opponent
          ? await resolvePlayerIdByRef({
              sport,
              teamIdByAbbr,
              playersByDkId,
              playerIdByComposite,
              playersByTeamPos,
              allowInitials,
              ref: c.opponent,
            })
          : null;

      await prisma.lineupCorrelation.create({
        data: {
          lineupId: lineup.id,
          gameId: null,
          type,
          qbPlayerId: qbId,
          teammatePlayerId: mateId ?? null,
          opponentPlayerId: oppId ?? null,
        },
      });
    }
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
        analysisSaved: Boolean(contestAnalysis || lineupAnalysis || itemAnalyses.length || correlations.length),
        slateTag,
        slateGroup,
        gamesMatched: week !== null ? games.length : 0,
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
          if (p.mode === "DK_ID") {
            lines.push(`  - (${p.sport}, dkPlayerId=${p.dkPlayerId})`);
          } else {
            const base = `  - (${p.sport}, "${p.name}", ${p.position}, team=${p.teamAbbreviation})`;
            if (p.suggestions && p.suggestions.length > 0) {
              lines.push(`${base} -> suggestions: ${p.suggestions.join(", ")}`);
            } else {
              lines.push(base);
            }
          }
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
