import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/prisma";

type SeedRow = { sport: string; name: string; position: string; teamAbbreviation: string };

function die(msg: string): never {
  console.error(msg);
  process.exit(1);
}

function requireSeedPath(argv: string[]) {
  const p = String(argv[2] ?? "").trim();
  if (!p) die("Usage: scripts/seed-players-upsert.ts <seedfile.json>");
  return p;
}

function readJson(p: string) {
  const abs = path.isAbsolute(p) ? p : path.join(process.cwd(), p);
  if (!fs.existsSync(abs)) die(`Seed file not found: ${abs}`);
  const data = JSON.parse(fs.readFileSync(abs, "utf8"));
  if (!Array.isArray(data)) die("Seed JSON must be an array.");
  return data as SeedRow[];
}

function normAbbr(v: any) {
  const a = String(v ?? "").trim().toUpperCase();
  const alias: Record<string, string> = { SD: "LAC", OAK: "LV", STL: "LAR", LA: "LAR" };
  return alias[a] ?? a;
}

async function main() {
  const seedPath = requireSeedPath(process.argv);
  const rows = readJson(seedPath);

  const sport = "NFL";

  const abbrs = Array.from(new Set(rows.map((r) => normAbbr(r.teamAbbreviation)).filter(Boolean)));
  const teams = await prisma.team.findMany({
    where: { sport: "NFL", abbreviation: { in: abbrs } },
    select: { id: true, abbreviation: true },
  });

  const teamIdByAbbr = new Map<string, string>();
  for (const t of teams) teamIdByAbbr.set(normAbbr(t.abbreviation), t.id);

  const missingTeams = abbrs.filter((a) => !teamIdByAbbr.has(a));
  if (missingTeams.length) die(`Missing Team rows: ${missingTeams.join(", ")}`);

  let upserts = 0;

  for (const r of rows) {
    const teamId = teamIdByAbbr.get(normAbbr(r.teamAbbreviation))!;
    const name = String(r.name).trim();
    const position = String(r.position).trim().toUpperCase();

    // upsert by your existing unique: sport + name + position + teamId
    await prisma.player.upsert({
      where: { sport_name_position_teamId: { sport: "NFL", name, position, teamId } },
      create: { sport: "NFL", name, position, teamId },
      update: { name, position, teamId },
    });

    upserts++;
    if (upserts % 100 === 0) console.log(JSON.stringify({ upserts }));
  }

  console.log(JSON.stringify({ ok: true, seedFile: seedPath, upserts }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });
