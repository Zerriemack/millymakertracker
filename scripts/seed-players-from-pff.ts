// scripts/seed-players-from-pff.ts
import fs from "node:fs";
import path from "node:path";

type SeedPlayer = {
  sport: "NFL";
  name: string;
  position: string;
  teamAbbreviation: string;
};

const DEFAULT_CSV_DIR = path.join(process.cwd(), "data/metrics/pff/passing_summary");
const DEFAULT_OUT = path.join(process.cwd(), "data/seeds/nfl_players_seed.json");

function readText(p: string) {
  return fs.readFileSync(p, "utf8");
}
function writeText(p: string, s: string) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, s, "utf8");
}

function normalizeSpaces(v: string) {
  return String(v || "").trim().replace(/\s+/g, " ");
}

/**
 * Converts "LAST, FIRST" -> "FIRST LAST"
 * Removes periods
 */
function normalizePlayerName(raw: string) {
  let s = normalizeSpaces(raw).replace(/\./g, "");
  if (!s) return "";
  if (s.includes(",")) {
    const parts = s.split(",").map((p) => normalizeSpaces(p));
    if (parts.length >= 2) s = normalizeSpaces(`${parts[1]} ${parts[0]}`);
  }
  return normalizeSpaces(s);
}

function normalizeTeamAbbr(raw: string) {
  const t = normalizeSpaces(raw).toUpperCase();
  if (!t) return "";

  const map: Record<string, string> = {
    LA: "LAR",
    JAX: "JAC",
    WSH: "WAS",
  };

  return map[t] ?? t;
}

/**
 * Small CSV parser (handles quotes, commas in quotes, CRLF).
 */
function parseCSV(csv: string): { header: string[]; rows: Record<string, string>[] } {
  const s = csv.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];

    if (inQuotes) {
      if (ch === '"') {
        const next = s[i + 1];
        if (next === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === ",") {
      row.push(field);
      field = "";
      continue;
    }

    if (ch === "\n") {
      row.push(field);
      field = "";
      if (!(row.length === 1 && row[0] === "")) rows.push(row);
      row = [];
      continue;
    }

    field += ch;
  }

  if (field.length || row.length) {
    row.push(field);
    if (!(row.length === 1 && row[0] === "")) rows.push(row);
  }

  if (rows.length === 0) return { header: [], rows: [] };

  const header = rows[0].map((h) => h.trim());
  const outRows: Record<string, string>[] = [];

  for (let r = 1; r < rows.length; r++) {
    const rec: Record<string, string> = {};
    for (let c = 0; c < header.length; c++) {
      rec[header[c]] = (rows[r][c] ?? "").trim();
    }
    const anyVal = Object.values(rec).some((v) => v !== "");
    if (anyVal) outRows.push(rec);
  }

  return { header, rows: outRows };
}

function listCsvFiles(dir: string) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith(".csv"))
    .map((f) => path.join(dir, f))
    .sort();
}

function loadExistingSeed(outPath: string): SeedPlayer[] {
  if (!fs.existsSync(outPath)) return [];
  const txt = readText(outPath).trim();
  if (!txt) return [];

  const parsed = JSON.parse(txt);
  if (!Array.isArray(parsed)) return [];

  // Preserve existing order, preserve existing content, only normalize whitespace.
  return parsed
    .map((p: any) => ({
      sport: "NFL" as const,
      name: normalizeSpaces(p?.name ?? ""),
      position: normalizeSpaces(p?.position ?? ""),
      teamAbbreviation: normalizeSpaces(p?.teamAbbreviation ?? ""),
    }))
    .filter((p: SeedPlayer) => p.name && p.position && p.teamAbbreviation);
}

function keyOf(p: SeedPlayer) {
  return `${p.sport}|${p.name.toLowerCase()}|${p.position.toUpperCase()}|${p.teamAbbreviation.toUpperCase()}`;
}

function tryPickField(rec: Record<string, string>, candidates: string[]) {
  const lower = Object.fromEntries(Object.entries(rec).map(([k, v]) => [k.toLowerCase(), v]));
  for (const c of candidates) {
    const v = lower[c.toLowerCase()];
    if (v && normalizeSpaces(v)) return v;
  }
  return "";
}

/**
 * IMPORTANT: We construct the object with keys in the exact order you showed:
 * sport, name, position, teamAbbreviation
 */
function buildFromPassingSummary(csvPath: string): SeedPlayer[] {
  const { rows } = parseCSV(readText(csvPath));
  const out: SeedPlayer[] = [];

  for (const rec of rows) {
    const nameRaw = tryPickField(rec, [
      "player",
      "player_name",
      "passer",
      "passer_player_name",
      "qb",
      "qb_name",
      "name",
    ]);

    const teamRaw = tryPickField(rec, [
      "team",
      "team_abbr",
      "teamabbr",
      "posteam",
      "offense",
      "offense_team",
      "tm",
    ]);

    const name = normalizePlayerName(nameRaw);
    const teamAbbreviation = normalizeTeamAbbr(teamRaw);

    if (!name || !teamAbbreviation) continue;

    // Key order matters (matches your seed file)
    out.push({
      sport: "NFL",
      name,
      position: "QB",
      teamAbbreviation,
    });
  }

  return out;
}

function main() {
  const args = process.argv.slice(2);
  const csvDirArg = args.find((a) => a.startsWith("--csvDir="))?.split("=")[1];
  const outArg = args.find((a) => a.startsWith("--out="))?.split("=")[1];
  const dryRun = args.includes("--dry-run");

  const csvDir = csvDirArg ? path.resolve(process.cwd(), csvDirArg) : DEFAULT_CSV_DIR;
  const outPath = outArg ? path.resolve(process.cwd(), outArg) : DEFAULT_OUT;

  const csvFiles = listCsvFiles(csvDir);
  if (csvFiles.length === 0) {
    console.error(`No CSV files found in: ${csvDir}`);
    process.exit(1);
  }

  const existing = loadExistingSeed(outPath);

  // Keep existing order exactly, only append new unique entries
  const seen = new Set(existing.map(keyOf));
  const appended: SeedPlayer[] = [];

  for (const f of csvFiles) {
    const fromCsv = buildFromPassingSummary(f);
    for (const p of fromCsv) {
      const k = keyOf(p);
      if (!seen.has(k)) {
        seen.add(k);
        appended.push(p);
      }
    }
  }

  const finalArr = existing.concat(appended);

  const json = JSON.stringify(finalArr, null, 2) + "\n";

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          csvDir,
          outPath,
          csvFiles: csvFiles.map((p) => path.relative(process.cwd(), p)),
          existing: existing.length,
          appended: appended.length,
          final: finalArr.length,
        },
        null,
        2
      )
    );
    process.exit(0);
  }

  writeText(outPath, json);

  console.log(
    JSON.stringify(
      {
        wrote: path.relative(process.cwd(), outPath),
        csvFiles: csvFiles.map((p) => path.relative(process.cwd(), p)),
        existing: existing.length,
        appended: appended.length,
        final: finalArr.length,
      },
      null,
      2
    )
  );
}

main();