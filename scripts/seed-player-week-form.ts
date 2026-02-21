import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/prisma";

type Row = {
  sport: string;
  seasonYear: number;
  week: number;
  playerGsisId: string;
  metrics: Record<string, any>;
};

function die(msg: string): never {
  console.error(msg);
  process.exit(1);
}

function requireSeedPath(argv: string[]) {
  const p = String(argv[2] ?? "").trim();
  if (!p) die("Usage: scripts/seed-player-week-form.ts <seedfile.json>");
  return p;
}

function readJson(p: string) {
  const abs = path.isAbsolute(p) ? p : path.join(process.cwd(), p);
  if (!fs.existsSync(abs)) die(`Seed file not found: ${abs}`);
  const data = JSON.parse(fs.readFileSync(abs, "utf8"));
  if (!Array.isArray(data)) die("Seed JSON must be an array.");
  return data as Row[];
}

async function main() {
  const seedPath = requireSeedPath(process.argv);
  const rows = readJson(seedPath);

  if (!rows.length) {
    console.log(JSON.stringify({ ok: true, seedFile: seedPath, skipped: "empty" }, null, 2));
    return;
  }

  const sport = String(rows[0].sport).trim();
  const seasonYear = Number(rows[0].seasonYear);

  const season = await prisma.season.upsert({
    where: { year_sport: { year: seasonYear, sport: sport as any } },
    create: { year: seasonYear, sport: sport as any },
    update: {},
    select: { id: true },
  });

  // Resolve players by gsisId
  const gsisIds = Array.from(new Set(rows.map((r) => String(r.playerGsisId).trim()).filter(Boolean)));

  const players = await prisma.player.findMany({
    where: { sport: sport as any, gsisId: { in: gsisIds } },
    select: { id: true, gsisId: true },
  });

  const playerIdByGsis = new Map<string, string>();
  for (const p of players) if (p.gsisId) playerIdByGsis.set(String(p.gsisId), p.id);

  // Optional: wipe the season’s weekForms so reruns are clean and deterministic
  const deleted = await prisma.playerWeekForm.deleteMany({ where: { seasonId: season.id } });

  const chunkSize = 1000;
  let inserted = 0;
  let skippedMissingPlayer = 0;

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);

    const data = [];
    for (const r of chunk) {
      const gsis = String(r.playerGsisId).trim();
      const playerId = playerIdByGsis.get(gsis);
      if (!playerId) {
        skippedMissingPlayer++;
        continue;
      }

      data.push({
        seasonId: season.id,
        week: Number(r.week),
        playerId,
        metrics: r.metrics ?? {},
      });
    }

    if (!data.length) continue;

    const res = await prisma.playerWeekForm.createMany({
      data,
      skipDuplicates: true,
    });

    inserted += res.count;
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        seedFile: seedPath,
        sport,
        seasonYear,
        deleted: deleted.count,
        inserted,
        skippedMissingPlayer,
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
