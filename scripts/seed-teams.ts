/* scripts/seed-teams.ts
 *
 * Seeds Teams from a JSON file.
 * Uses the same Prisma adapter setup as import-winners.ts (NO Accelerate).
 *
 * Usage:
 * dotenv_config_path=.env.local node -r dotenv/config node_modules/.bin/tsx scripts/seed-teams.ts data/seeds/nfl_teams_seed.json
 */

import fs from "fs";
import path from "path";
import { Sport } from "@prisma/client";
import { prisma } from "../src/lib/prisma";

/* ------------------------------ CLI parsing ------------------------------ */

function getArgValue(flag: string): string | null {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return null;
  const val = process.argv[idx + 1];
  if (!val || val.startsWith("--")) return null;
  return val;
}

function requireSeedPath(): string {
  // Allow either positional arg OR --path
  const byFlag = getArgValue("--path");
  const positional = process.argv[2];
  const p = byFlag ?? positional;

  if (!p) {
    throw new Error(
      "Missing seed file path.\n" +
        "Example:\n" +
        "dotenv_config_path=.env.local node -r dotenv/config node_modules/.bin/tsx scripts/seed-teams.ts data/seeds/nfl_teams_seed.json"
    );
  }
  return p;
}

function readJsonFile<T>(filePath: string): T {
  const raw = fs.readFileSync(filePath, "utf8");
  try {
    return JSON.parse(raw) as T;
  } catch (e: any) {
    throw new Error(`Failed to parse JSON: ${filePath}\n${e?.message ?? e}`);
  }
}

/* ------------------------------- Types ----------------------------------- */

type TeamSeed = {
  sport: "NFL" | "CFB";
  abbreviation: string;
  name: string;
};

async function main() {
  const filePath = requireSeedPath();
  const absPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);

  const teams = readJsonFile<TeamSeed[]>(absPath);

  let created = 0;
  let updated = 0;

  for (const t of teams) {
    const sport = String(t.sport).toUpperCase().trim();
    if (sport !== "NFL" && sport !== "CFB") {
      throw new Error(`Invalid sport "${t.sport}" in team seed. Expected NFL or CFB.`);
    }

    const abbreviation = String(t.abbreviation).toUpperCase().trim();
    const name = String(t.name).trim();

    if (!abbreviation) throw new Error("Team seed missing abbreviation.");
    if (!name) throw new Error(`Team seed missing name for ${abbreviation}.`);

    const result = await prisma.team.upsert({
      where: { sport_abbreviation: { sport: sport as Sport, abbreviation } },
      create: { sport: sport as Sport, abbreviation, name },
      update: { name },
      select: { id: true },
    });

    // We can’t directly know created vs updated from upsert without extra queries,
    // so keep it simple and count as "upserted"
    if (result?.id) updated++;
  }

  console.log(JSON.stringify({ ok: true, file: filePath, upserted: updated, created, updated }, null, 2));
}

main()
  .catch((err: any) => {
    console.error(err?.stack ?? err?.message ?? err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
