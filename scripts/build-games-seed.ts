// scripts/build-games-seed.ts
import fs from "node:fs";
import path from "node:path";
import https from "node:https";

type Window = "EARLY" | "LATE" | "PRIME" | "OTHER";

function die(msg: string): never {
  console.error(msg);
  process.exit(1);
}

function fetchText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (!res.statusCode || res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          return;
        }
        res.setEncoding("utf8");
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(data));
      })
      .on("error", reject);
  });
}

// minimal CSV parser (handles quoted fields + commas)
function parseCsv(text: string): Array<Record<string, string>> {
  const lines = text.split(/\r?\n/).filter(Boolean);
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

// Convert a local time in some IANA tz to a UTC Date, without external libs.
// We iterate until the formatted local time matches the desired local time.
function zonedTimeToUtc(dateYmd: string, timeHm: string, timeZone: string): Date {
  const [Y, M, D] = dateYmd.split("-").map((x) => Number(x));
  const [hh, mm] = timeHm.split(":").map((x) => Number(x));

  if (!Number.isFinite(Y) || !Number.isFinite(M) || !Number.isFinite(D)) die(`Bad date: ${dateYmd}`);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) die(`Bad time: ${timeHm}`);

  // start with a UTC guess
  let guess = new Date(Date.UTC(Y, M - 1, D, hh, mm, 0));

  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const target = `${String(M).padStart(2, "0")}/${String(D).padStart(2, "0")}/${String(Y)} ${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;

  for (let i = 0; i < 8; i++) {
    const parts = fmt.formatToParts(guess);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    const local = `${get("month")}/${get("day")}/${get("year")} ${get("hour")}:${get("minute")}`;

    if (local === target) return guess;

    // compute delta minutes between what we got vs what we want
    const gotDate = new Date(`${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:00Z`);
    const wantDate = new Date(`${Y}-${String(M).padStart(2, "0")}-${String(D).padStart(2, "0")}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00Z`);
    const deltaMin = Math.round((wantDate.getTime() - gotDate.getTime()) / 60000);

    guess = new Date(guess.getTime() + deltaMin * 60000);
  }

  die(`Could not resolve zoned time -> UTC for ${dateYmd} ${timeHm} in ${timeZone}`);
}

function getChicagoHourMinute(utcDate: Date) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = fmt.formatToParts(utcDate);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "NaN");
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "NaN");
  return { h, m };
}

function windowForGame(weekday: string, utcKick: Date): Window {
  const day = weekday.trim().toLowerCase();
  const { h } = getChicagoHourMinute(utcKick);

  // PRIME: Thu + Mon, plus Sunday night (typically 19:00+ CT)
  if (day === "thursday" || day === "monday") return "PRIME";
  if (day === "sunday" && h >= 19) return "PRIME";

  // EARLY/LATE for Sunday day windows
  if (day === "sunday" && h === 12) return "EARLY";
  if (day === "sunday" && h === 15) return "LATE";

  return "OTHER";
}

async function main() {
  const seasonYear = Number(process.argv[2]);
  const outPathRaw = String(process.argv[3] ?? "").trim();

  if (!Number.isFinite(seasonYear)) die("Usage: scripts/build-games-seed.ts <seasonYear> <outputSeedPath>");
  if (!outPathRaw) die("Usage: scripts/build-games-seed.ts <seasonYear> <outputSeedPath>");

  const outPath = path.isAbsolute(outPathRaw) ? outPathRaw : path.join(process.cwd(), outPathRaw);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  // Source referenced in nfldata DATASETS.md
  const url = "https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv";

  const csvText = await fetchText(url);
  const rows = parseCsv(csvText);

  const filtered = rows.filter((r) => {
    const s = Number(r.season);
    const gt = String(r.game_type ?? "").trim();
    return s === seasonYear && gt === "REG";
  });

  if (!filtered.length) die(`No rows found for season ${seasonYear} REG. (Source may be down or format changed.)`);

  const seed = filtered.map((r) => {
    const week = Number(r.week);
    const gameday = String(r.gameday).trim(); // YYYY-MM-DD
    const weekday = String(r.weekday).trim(); // Sunday, Monday, Thursday...
    const gametime = String(r.gametime).trim(); // HH:MM (ET)

    if (!gameday || !gametime) die(`Missing gameday/gametime for game_id=${r.game_id}`);

    const utcKick = zonedTimeToUtc(gameday, gametime, "America/New_York");
    const window = windowForGame(weekday, utcKick);

    return {
      sport: "NFL",
      seasonYear,
      week,
      kickoffTimeUtc: utcKick.toISOString(),
      homeTeam: String(r.home_team).trim(),
      awayTeam: String(r.away_team).trim(),
      window,
    };
  });

  // sort by week then kickoff
  seed.sort((a, b) => (a.week - b.week) || (a.kickoffTimeUtc < b.kickoffTimeUtc ? -1 : 1));

  fs.writeFileSync(outPath, JSON.stringify(seed, null, 2));
  console.log(JSON.stringify({ ok: true, seasonYear, games: seed.length, outPath }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});