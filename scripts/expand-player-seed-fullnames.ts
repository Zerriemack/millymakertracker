import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";

type SeedRow = { sport: string; name: string; position: string; teamAbbreviation: string };

function die(msg: string): never {
  console.error(msg);
  process.exit(1);
}

function norm(s: any) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ");
}

function parseCsv(text: string): Array<Record<string, string>> {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0);

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
        } else inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        out.push(cur);
        cur = "";
      } else cur += ch;
    }
    out.push(cur);
    return out;
  };

  const headers = parseLine(lines[0]).map((h) => h.trim());
  const rows: Array<Record<string, string>> = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    const obj: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) obj[headers[c]] = (cols[c] ?? "").trim();
    rows.push(obj);
  }
  return rows;
}

function firstInitialLast(name: string) {
  // supports "M. Stafford" or "M Stafford"
  const n = norm(name);
  const parts = n.split(" ").filter(Boolean);
  if (parts.length < 2) return null;
  const fi = parts[0][0] ?? "";
  const ln = parts[parts.length - 1];
  if (!fi || !ln) return null;
  return { fi, ln };
}

async function main() {
  const inPathRaw = String(process.argv[2] ?? "").trim();
  const outPathRaw = String(process.argv[3] ?? "").trim();
  if (!inPathRaw || !outPathRaw) {
    die("Usage: scripts/expand-player-seed-fullnames.ts <inSeed.json> <outSeed.json>");
  }

  const inPath = path.isAbsolute(inPathRaw) ? inPathRaw : path.join(process.cwd(), inPathRaw);
  const outPath = path.isAbsolute(outPathRaw) ? outPathRaw : path.join(process.cwd(), outPathRaw);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  const seed = JSON.parse(fs.readFileSync(inPath, "utf8")) as SeedRow[];
  if (!Array.isArray(seed)) die("Seed must be an array.");

  const url = "https://github.com/nflverse/nflverse-data/releases/download/players/players.csv";
  const tmp = path.join(os.tmpdir(), `players_${Date.now()}.csv`);
  execSync(`curl -fsSL "${url}" -o "${tmp}"`, { stdio: "ignore" });
  const csv = fs.readFileSync(tmp, "utf8");
  fs.unlinkSync(tmp);

  const players = parseCsv(csv);

  // Build index: POS|FI|LN -> possible full names
  const idx = new Map<string, Set<string>>();
  for (const r of players) {
    const pos = String(r.position ?? "").trim().toUpperCase();
    const display = String(r.display_name ?? "").trim();
    if (!pos || !display) continue;

    const keyParts = firstInitialLast(display);
    if (!keyParts) continue;

    const key = `${pos}|${keyParts.fi}|${keyParts.ln}`;
    if (!idx.has(key)) idx.set(key, new Set());
    idx.get(key)!.add(display);
  }

  let changed = 0;
  let unchanged = 0;

  const out = seed.map((row) => {
    const pos = String(row.position ?? "").trim().toUpperCase();
    const nm = String(row.name ?? "").trim();

    // skip DST and team words, only expand initials
    if (pos === "DST") {
      unchanged++;
      return row;
    }

    const parts = firstInitialLast(nm);
    if (!parts) {
      unchanged++;
      return row;
    }

    const key = `${pos}|${parts.fi}|${parts.ln}`;
    const set = idx.get(key);

    // only replace when unique
    if (set && set.size === 1) {
      const full = Array.from(set)[0];
      if (full && full !== nm) {
        changed++;
        return { ...row, name: full };
      }
    }

    unchanged++;
    return row;
  });

  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ ok: true, inRows: seed.length, changed, unchanged, outPath }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
