import fs from "node:fs";
import path from "node:path";

// IMPORTANT: use the project's prisma singleton (do NOT new PrismaClient())
import { prisma } from "../src/lib/prisma";

type TeamSeasonSeed = {
  teamAbbreviation: string;
  seasonYear: number;
  homeIsIndoor: boolean;
};

function requireSeedPath() {
  const p = process.argv[2];
  if (!p) {
    throw new Error(
      [
        "Missing seed file path.",
        "Example:",
        "dotenv_config_path=.env.local node --import dotenv/config --import tsx scripts/seed-team-seasons.ts data/seeds/nfl_team_seasons_seed.json",
      ].join("\n")
    );
  }
  return p;
}

async function main() {
  const seedPath = requireSeedPath();
  const file = path.join(process.cwd(), seedPath);
  const rows = JSON.parse(fs.readFileSync(file, "utf8")) as TeamSeasonSeed[];

  const teams = await prisma.team.findMany({
    where: { sport: "NFL" },
    select: { id: true, abbreviation: true },
  });

  const idByAbbr = new Map(teams.map((t) => [t.abbreviation, t.id]));

  const data = rows.map((r) => {
    const teamId = idByAbbr.get(r.teamAbbreviation);
    if (!teamId) throw new Error(`Missing Team for abbreviation: ${r.teamAbbreviation}`);
    return {
      teamId,
      seasonYear: Number(r.seasonYear),
      homeIsIndoor: !!r.homeIsIndoor,
    };
  });

  const res = await prisma.teamSeason.createMany({
    data,
    skipDuplicates: true,
  });

  console.log({ ok: true, created: res.count, file: seedPath });
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});