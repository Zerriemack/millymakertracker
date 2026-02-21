import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";

function die(msg: string): never {
  console.error(msg);
  process.exit(1);
}

function parseCsv(text: string): Array<Record<string, string>> {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0);

  if (!lines.length) return [];

  const parseLine = (line: string) => {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        const next = line[i + 1];
        if (inQuotes && next === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        out.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out;
  };

  const headers = parseLine(lines[0]).map((h) => h.trim());
  const rows: Array<Record<string, string>> = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    if (!cols.length) continue;
    const obj: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) obj[headers[c]] = (cols[c] ?? "").trim();
    rows.push(obj);
  }

  return rows;
}

function normName(s: any) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ");
}

function pick(r: Record<string, string>, keys: string[]) {
  for (const k of keys) {
    const v = r[k];
    if (v && String(v).trim()) return String(v).trim();
  }
  return "";
}

async function main() {
  const outPathRaw = String(process.argv[2] ?? "").trim();
  if (!outPathRaw) die("Usage: scripts/build-player-gsis-map.ts <outPath.json>");

  const outPath = path.isAbsolute(outPathRaw) ? outPathRaw : path.join(process.cwd(), outPathRaw);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  const url = "https://github.com/nflverse/nflverse-data/releases/download/players/players.csv";

  const tmp = path.join(os.tmpdir(), `players_${Date.now()}.csv`);
  execSync(`curl -fsSL "${url}" -o "${tmp}"`, { stdio: "ignore" });

  const csv = fs.readFileSync(tmp, "utf8");
  fs.unlinkSync(tmp);

  const rows = parseCsv(csv);
  if (!rows.length) die("players.csv returned 0 rows.");

  const out: Array<{ sport: "NFL"; nameNorm: string; position: string; gsisId: string }> = [];

  for (const r of rows) {
    const gsisId = pick(r, ["gsis_id", "gsisId"]);
    const name = pick(r, ["display_name", "full_name", "name", "player_name"]);
    const pos = pick(r, ["position"]).toUpperCase();

    if (!gsisId || !name || !pos) continue;

    out.push({
      sport: "NFL",
      nameNorm: normName(name),
      position: pos,
      gsisId,
    });
  }

  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ ok: true, rows: out.length, outPath }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
