import fs from "node:fs";
import path from "node:path";

type SeedPlayer = {
  sport: "NFL";
  name: string;
  position: "QB";
  teamAbbreviation: string;
};

const DEFAULT_SEED_PATH = "data/seeds/nfl_players_seed.json";
const DEFAULT_PFF_DIR = "data/metrics/pff/passing_summary";

function getArg(flag: string): string | null {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return null;
  const val = process.argv[idx + 1];
  if (!val || val.startsWith("--")) return null;
  return val;
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
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

function normName(raw: string): string {
  let v = String(raw ?? "").trim();
  if (!v) return "";
  if (v.includes(",")) {
    const parts = v.split(",");
    const last = parts[0] ?? "";
    const first = parts.slice(1).join(" ").trim();
    v = `${first} ${last}`.trim();
  }
  v = v.replace(/\./g, "");
  v = v.replace(/\s+/g, " ").trim();
  return v;
}

function normTeam(raw: string): string {
  let v = String(raw ?? "").trim().toUpperCase();
  if (!v) return "";
  if (v === "BLT") return "BAL";
  if (v === "JAC") return "JAX";
  if (v === "ARZ") return "ARI";
  if (v === "SD") return "LAC";
  if (v === "HST") return "HOU";
  if (v === "OAK") return "LV";
  if (v === "CLV") return "CLE";
  if (v === "WSH") return "WAS";
  if (v === "LA") return "LAR";
  return v;
}

function escapeJsonString(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function fileLineSep(raw: string): string {
  return raw.includes("\r\n") ? "\r\n" : "\n";
}

function appendEntriesToJsonArray(raw: string, entries: SeedPlayer[]): string {
  if (!entries.length) return raw;
  const lineSep = fileLineSep(raw);
  const lastBracket = raw.lastIndexOf("]");
  if (lastBracket === -1) throw new Error("Seed file is not a JSON array.");

  const before = raw.slice(0, lastBracket);
  const after = raw.slice(lastBracket);

  let i = before.length - 1;
  while (i >= 0 && /\s/.test(before[i])) i--;
  const lastChar = i >= 0 ? before[i] : "";
  const isEmpty = lastChar === "[";

  const lines = entries.map(
    (e) =>
      `  { "sport": "NFL", "name": "${escapeJsonString(e.name)}", "position": "QB", "teamAbbreviation": "${escapeJsonString(
        e.teamAbbreviation
      )}" }`
  );

  const insert = (isEmpty ? "" : ",") + lineSep + lines.join("," + lineSep) + lineSep;
  return before + insert + after;
}

function readCsv(filePath: string) {
  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (!lines.length) return { header: [], rows: [] as string[][] };
  const header = parseCsvLine(lines[0]).map((h) => h.trim());
  const rows = lines.slice(1).map(parseCsvLine);
  return { header, rows };
}

function getHeaderIndex(header: string[], keys: string[]): number {
  for (const k of keys) {
    const idx = header.indexOf(k);
    if (idx !== -1) return idx;
  }
  return -1;
}

function main() {
  const seedPath = getArg("--seed") || DEFAULT_SEED_PATH;
  const pffDir = getArg("--pff-dir") || DEFAULT_PFF_DIR;
  const dryRun = hasFlag("--dry-run");
  const debug = hasFlag("--debug");

  const seedRaw = fs.readFileSync(seedPath, "utf8");
  const seedData = JSON.parse(seedRaw) as any[];
  if (!Array.isArray(seedData)) throw new Error("Seed file is not a JSON array.");

  const existingKeys = new Set<string>();
  for (const item of seedData) {
    const sport = String(item?.sport ?? "").trim() || "NFL";
    const name = normName(String(item?.name ?? ""));
    const pos = String(item?.position ?? "").trim().toUpperCase();
    const team = normTeam(String(item?.teamAbbreviation ?? ""));
    if (!sport || !name || !pos || !team) continue;
    existingKeys.add(`${sport}|${name}|${pos}|${team}`);
  }

  const files = fs
    .readdirSync(pffDir)
    .filter((f) => /^passing_summary_(\d{4})\.csv$/.test(f))
    .filter((f) => {
      const year = Number(f.match(/^passing_summary_(\d{4})\.csv$/)?.[1]);
      return Number.isFinite(year) && year >= 2016 && year <= 2025;
    })
    .sort();

  const appended: SeedPlayer[] = [];
  const addedKeys = new Set<string>();

  for (const file of files) {
    const filePath = path.join(pffDir, file);
    const { header, rows } = readCsv(filePath);

    const idxPlayer = getHeaderIndex(header, ["player"]);
    const idxPos = getHeaderIndex(header, ["position"]);
    const idxTeam = getHeaderIndex(header, ["team_name", "team", "team_abbreviation", "team_abbr", "teamAbbreviation"]);

    if (idxPlayer === -1 || idxPos === -1 || idxTeam === -1) {
      throw new Error(`Missing required headers in ${file}: player, position, team_name`);
    }

    if (debug) {
      const sample = rows[0] || [];
      const sampleName = sample[idxPlayer] ?? "";
      const sampleTeam = sample[idxTeam] ?? "";
      console.log(
        JSON.stringify(
          {
            file,
            headers: header,
            sample: { name: sampleName, team: sampleTeam },
          },
          null,
          2
        )
      );
    }

    for (const row of rows) {
      const pos = String(row[idxPos] ?? "").trim().toUpperCase();
      if (pos !== "QB") continue;

      const name = normName(String(row[idxPlayer] ?? ""));
      const team = normTeam(String(row[idxTeam] ?? ""));
      if (!name || !team) continue;

      const key = `NFL|${name}|QB|${team}`;
      if (existingKeys.has(key) || addedKeys.has(key)) continue;

      appended.push({
        sport: "NFL",
        name,
        position: "QB",
        teamAbbreviation: team,
      });
      addedKeys.add(key);
    }
  }

  const existingCount = seedData.length;
  const appendedCount = appended.length;
  const finalCount = existingCount + appendedCount;

  console.log(
    JSON.stringify(
      {
        existing: existingCount,
        appended: appendedCount,
        final: finalCount,
        csvsUsed: files,
        dryRun,
      },
      null,
      2
    )
  );

  if (dryRun || appended.length === 0) return;

  const nextRaw = appendEntriesToJsonArray(seedRaw, appended);
  fs.writeFileSync(seedPath, nextRaw);
}

main();
