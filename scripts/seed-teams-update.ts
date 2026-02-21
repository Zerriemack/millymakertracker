import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/prisma";

type TeamSeed = {
  sport: "NFL" | "CFB";
  abbreviation: string;
  name: string;
  homeIsIndoor: boolean;
};

function requireSeedPath() {
  const p = process.argv[2];
  if (!p) throw new Error("Missing seed file path. Example: data/seeds/nfl_teams_seed.json");
  return p;
}

async function main() {
  const seedPath = requireSeedPath();
  const file = path.join(process.cwd(), seedPath);
  const teams = JSON.parse(fs.readFileSync(file, "utf8")) as TeamSeed[];

  let updated = 0;
  for (const t of teams) {
    await prisma.team.upsert({
      where: {
        sport_abbreviation: { sport: t.sport, abbreviation: t.abbreviation },
      },
      update: {
        name: t.name,
        homeIsIndoor: !!t.homeIsIndoor,
      },
      create: {
        sport: t.sport,
        abbreviation: t.abbreviation,
        name: t.name,
        homeIsIndoor: !!t.homeIsIndoor,
      },
    });
    updated += 1;
  }

  console.log({ ok: true, upserted: updated, file: seedPath });
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});