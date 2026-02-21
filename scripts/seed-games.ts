// scripts/seed-games.ts
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/prisma";

type SeedRow = {
  sport: string; // "NFL"
  seasonYear: number; // 2016..2025
  week: number; // 1..22
  kickoffTimeUtc: string; // ISO string
  homeTeam: string; // "DAL"
  awayTeam: string; // "NYG"
  window: "EARLY" | "LATE" | "PRIME" | "OTHER";
};

function die(msg: string): never {
  console.error(msg);
  process.exit(1);
}

function requireSeedPath(argv: string[]) {
  const p = String(argv[2] ?? "").trim();
  if (!p) die("Usage: scripts/seed-games.ts <seedfile.json>");
  return p;
}

function readJson(p: string) {
  const abs = path.isAbsolute(p) ? p : path.join(process.cwd(), p);
  if (!fs.existsSync(abs)) die(`Seed file not found: ${abs}`);
  const raw = fs.readFileSync(abs, "utf8");
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) die("Seed JSON must be an array of rows.");
  return data as SeedRow[];
}

function normAbbr(v: any) {
  const a = String(v ?? "").trim().toUpperCase();

  // normalize legacy abbreviations to your Team.abbreviation values
  const alias: Record<string, string> = {
    SD: "LAC",
    OAK: "LV",
    STL: "LAR",
    // sometimes sources use "LA" for Rams in older seasons
    LA: "LAR",
  };

  return alias[a] ?? a;
}

async function main() {
  const seedPath = requireSeedPath(process.argv);
  const rows = readJson(seedPath);

  if (!rows.length) die("Seed file has 0 rows.");

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const idx = i + 1;

    if (!r || typeof r !== "object") die(`Row ${idx} is not an object.`);
    if (!r.sport) die(`Row ${idx} missing sport.`);
    if (!Number.isFinite(r.seasonYear)) die(`Row ${idx} missing seasonYear.`);
    if (!Number.isFinite(r.week)) die(`Row ${idx} missing week.`);
    if (!r.kickoffTimeUtc) die(`Row ${idx} missing kickoffTimeUtc.`);
    if (!r.homeTeam) die(`Row ${idx} missing homeTeam.`);
    if (!r.awayTeam) die(`Row ${idx} missing awayTeam.`);
    if (!r.window) die(`Row ${idx} missing window.`);

    const d = new Date(r.kickoffTimeUtc);
    if (Number.isNaN(d.getTime())) die(`Row ${idx} kickoffTimeUtc is invalid ISO: ${r.kickoffTimeUtc}`);

    const w = String(r.window).toUpperCase();
    if (!["EARLY", "LATE", "PRIME", "OTHER"].includes(w)) {
      die(`Row ${idx} window must be EARLY|LATE|PRIME|OTHER. Got: ${r.window}`);
    }
  }

  const sport = String(rows[0].sport).trim();
  const seasonYear = Number(rows[0].seasonYear);

  // Enforce single season per file
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (String(r.sport).trim() !== sport) die(`Row ${i + 1} sport mismatch. Expected ${sport}.`);
    if (Number(r.seasonYear) !== seasonYear) die(`Row ${i + 1} seasonYear mismatch. Expected ${seasonYear}.`);
  }

  const season = await prisma.season.upsert({
    where: { year_sport: { year: seasonYear, sport } },
    create: { year: seasonYear, sport },
    update: {},
    select: { id: true },
  });

  // Gather team abbreviations from seed
  const abbrs = new Set<string>();
  for (const r of rows) {
    abbrs.add(normAbbr(r.homeTeam));
    abbrs.add(normAbbr(r.awayTeam));
  }
  abbrs.delete("");

  const teams = await prisma.team.findMany({
    where: { sport, abbreviation: { in: Array.from(abbrs) } },
    select: { id: true, abbreviation: true },
  });

  const teamIdByAbbr = new Map<string, string>();
  for (const t of teams) teamIdByAbbr.set(normAbbr(t.abbreviation), t.id);

  const missing = Array.from(abbrs).filter((a) => !teamIdByAbbr.has(a));
  if (missing.length) {
    die(`Missing Team rows for abbreviations: ${missing.join(", ")}. Seed teams first or fix abbreviations.`);
  }

  const gamesData = rows.map((r) => {
    const homeAbbr = normAbbr(r.homeTeam);
    const awayAbbr = normAbbr(r.awayTeam);

    return {
      sport,
      seasonId: season.id,
      week: Number(r.week),
      kickoffTimeUtc: new Date(r.kickoffTimeUtc),
      window: String(r.window).toUpperCase() as SeedRow["window"],
      homeTeamId: teamIdByAbbr.get(homeAbbr)!,
      awayTeamId: teamIdByAbbr.get(awayAbbr)!,
    };
  });

  const result = await prisma.game.createMany({
    data: gamesData,
    skipDuplicates: true,
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        seedFile: seedPath,
        sport,
        seasonYear,
        inputRows: rows.length,
        created: result.count,
      },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });