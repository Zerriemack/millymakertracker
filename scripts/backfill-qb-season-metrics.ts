import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/prisma";

function getArgValue(flag: string): string | null {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return null;
  const val = process.argv[idx + 1];
  if (!val || val.startsWith("--")) return null;
  return val;
}

function requireArg(flag: string): string {
  const v = getArgValue(flag);
  if (!v) {
    throw new Error(
      `Missing required ${flag}. Example: scripts/backfill-qb-season-metrics.ts --sport NFL --year 2025 --input data/metrics/pff/passing_summary/passing_summary_2025.csv`
    );
  }
  return v;
}

type CsvRow = {
  playerName: string;
  position: string;
  gradesPass: number | null;
  gradesPassRaw: string | null;
};

function toFirstLast(raw: string): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  if (!s.includes(",")) return s;
  const [last, first] = s.split(",").map((x) => x.trim());
  if (!last || !first) return s;
  return `${first} ${last}`.trim();
}

function normName(v: any): string {
  const raw0 = toFirstLast(String(v ?? ""));
  const raw = raw0.trim().toLowerCase();
  if (!raw) return "";
  const withoutSuffix = raw.replace(/\s+(jr|sr|ii|iii|iv|v)\.?$/i, "");
  return withoutSuffix
    .replace(/[.'’]/g, "")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function getHeaderIndex(header: string[], keys: string[]): number {
  for (const k of keys) {
    const idx = header.indexOf(k);
    if (idx !== -1) return idx;
  }
  return -1;
}

function parseNumberLoose(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const cleaned = trimmed.replace(/,/g, "").replace(/%/g, "").trim();
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function inferYearFromInput(inputPath: string): number | null {
  const base = path.basename(inputPath);
  const match = base.match(/passing_summary_(\d{4})\.csv/i);
  if (!match) return null;
  const year = Number(match[1]);
  return Number.isFinite(year) ? year : null;
}

function readCsv(filePath: string): CsvRow[] {
  const abs = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
  if (!fs.existsSync(abs)) throw new Error(`Input file not found: ${abs}`);

  const raw = fs.readFileSync(abs, "utf8");
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];

  const header = parseCsvLine(lines[0]).map((h) => h.trim());

  const playerIdx = getHeaderIndex(header, ["player", "player_name", "name"]);
  const posIdx = getHeaderIndex(header, ["position", "pos"]);
  const gradeIdx = getHeaderIndex(header, [
    "grades_pass",
    "grades_pass_grade",
    "pff_pass_grade",
    "pffPassGrade",
    "pass_grade",
  ]);

  if (playerIdx === -1) throw new Error(`CSV missing player header (player/player_name/name)`);
  if (posIdx === -1) throw new Error(`CSV missing position header (position/pos)`);
  if (gradeIdx === -1) throw new Error(`CSV missing grade header (grades_pass / pff_pass_grade etc)`);

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);

    const playerName = String(cols[playerIdx] ?? "").trim();
    const position = String(cols[posIdx] ?? "").trim();

    const gradeRaw = String(cols[gradeIdx] ?? "").trim();
    const grade = parseNumberLoose(gradeRaw);

    rows.push({
      playerName,
      position,
      gradesPass: grade,
      gradesPassRaw: gradeRaw || null,
    });
  }

  return rows;
}

async function main() {
  const sportRaw = requireArg("--sport").toUpperCase().trim();
  const inputPath = requireArg("--input");
  const yearRaw = getArgValue("--year");
  const year = yearRaw != null ? Number(yearRaw) : inferYearFromInput(inputPath);

  if (!Number.isFinite(year)) {
    throw new Error(
      `Missing or invalid --year. Example: scripts/backfill-qb-season-metrics.ts --sport NFL --year 2025 --input data/metrics/pff/passing_summary/passing_summary_2025.csv`
    );
  }

  const rowsRead = readCsv(inputPath);

  const season = await prisma.season.findUnique({
    where: { year_sport: { year, sport: sportRaw as any } },
    select: { id: true },
  });
  if (!season) throw new Error(`Season not found for ${sportRaw} ${year}. Seed seasons first.`);

  const defaultTeam = await prisma.team.findFirst({
    where: { sport: sportRaw as any },
    select: { id: true, abbreviation: true },
    orderBy: { abbreviation: "asc" },
  });
  if (!defaultTeam) throw new Error(`No teams found for ${sportRaw}. Seed teams first.`);

  const players = await prisma.player.findMany({
    where: { sport: sportRaw as any },
    select: { id: true, name: true },
  });

  // key = normalized name, value = ALL playerIds that share that normalized name
  const playerIdsByNorm = new Map<string, string[]>();
  for (const p of players) {
    const k = normName(p.name);
    if (!k) continue;
    const list = playerIdsByNorm.get(k) ?? [];
    list.push(p.id);
    playerIdsByNorm.set(k, list);
  }

  let rowsUsedForYear = 0;
  let rowsFilteredOut = 0;

  let qbRowsWithGrade = 0;
  let missingGrade = 0;

  let unmatchedNames = 0;
  const unmatched: string[] = [];

  let qbSeasonUpdated = 0;
  let qbSeasonCreated = 0;

  for (const r of rowsRead) {
    if (r.position.trim().toUpperCase() !== "QB") {
      rowsFilteredOut++;
      continue;
    }
    rowsUsedForYear++;

    const rawName = r.playerName.trim();
    const key = normName(rawName);
    if (!key) {
      unmatchedNames++;
      unmatched.push(rawName || "(blank)");
      continue;
    }

    if (r.gradesPass == null) {
      missingGrade++;
      continue;
    }

    const ids = playerIdsByNorm.get(key) ?? [];
    if (!ids.length) {
      unmatchedNames++;
      unmatched.push(rawName);
      continue;
    }

    qbRowsWithGrade++;

    for (const playerId of ids) {
      const upd = await prisma.qbSeason.updateMany({
        where: { sport: sportRaw as any, seasonId: season.id, playerId },
        data: { pffPassGrade: r.gradesPass },
      });

      if (upd.count > 0) {
        qbSeasonUpdated += upd.count;
        continue;
      }

      await prisma.qbSeason.upsert({
        where: {
          sport_seasonId_playerId_teamId: {
            sport: sportRaw as any,
            seasonId: season.id,
            playerId,
            teamId: defaultTeam.id,
          },
        },
        update: { pffPassGrade: r.gradesPass },
        create: {
          sport: sportRaw as any,
          seasonId: season.id,
          playerId,
          teamId: defaultTeam.id,
          archetype: "UNKNOWN" as any,
          pffPassGrade: r.gradesPass,
        },
        select: { id: true },
      });

      qbSeasonCreated++;
    }
  }

  const qbSeasonTotal = await prisma.qbSeason.count({
    where: { sport: sportRaw as any, seasonId: season.id },
  });
  const qbSeasonWithGrade = await prisma.qbSeason.count({
    where: { sport: sportRaw as any, seasonId: season.id, pffPassGrade: { not: null } },
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        sport: sportRaw,
        year,
        seasonId: season.id,
        defaultTeam: defaultTeam.abbreviation,
        rowsRead: rowsRead.length,
        rowsUsedForYear,
        rowsFilteredOut,
        qbRowsWithGrade,
        missingGrade,
        unmatchedNames,
        unmatchedSample: unmatched.slice(0, 50),
        qbSeasonUpdated,
        qbSeasonCreated,
        qbSeasonTotal,
        qbSeasonWithGrade,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err?.stack ?? err?.message ?? err);
  process.exit(1);
});