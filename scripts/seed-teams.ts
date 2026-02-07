/* scripts/seed-teams.ts
 *
 * Seeds Team rows from a JSON array.
 * Upserts by @@unique([sport, abbreviation]).
 *
 * Usage:
 * dotenv_config_path=.env.local node -r dotenv/config node_modules/.bin/tsx scripts/seed-teams.ts --path data/seed/teams.json
 */

import fs from "fs";
import path from "path";
import { PrismaClient, Sport } from "@prisma/client";

const ACCEL_URL = process.env.PRISMA_ACCELERATE_URL || process.env.ACCELERATE_URL;
if (!ACCEL_URL) {
  throw new Error(
    "Missing PRISMA_ACCELERATE_URL (or ACCELERATE_URL). Add it to .env.local. Prisma Client in this repo requires Accelerate or an adapter."
  );
}

const prisma = new PrismaClient({ accelerateUrl: ACCEL_URL });
type TeamSeedRow = {
  sport: string;
  abbreviation: string;
  name: string;
};

function getArgValue(flag: string): string | null {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return null;
  const val = process.argv[idx + 1];
  if (!val || val.startsWith("--")) return null;
  return val;
}

function requirePathArg(): string {
  const p = getArgValue("--path");
  if (!p) {
    throw new Error(
      "Missing required argument --path\n" +
        "Example:\n" +
        "dotenv_config_path=.env.local node -r dotenv/config node_modules/.bin/tsx scripts/seed-teams.ts --path data/seed/teams.json"
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

function parseSport(s: string): Sport {
  const up = String(s).toUpperCase().trim();
  if (up !== "NFL" && up !== "CFB") throw new Error(`Invalid sport "${s}" (expected NFL or CFB)`);
  return up as Sport;
}

async function main() {
  const filePath = requirePathArg();
  const absPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);

  const rows = readJsonFile<TeamSeedRow[]>(absPath);
  if (!Array.isArray(rows) || rows.length === 0) throw new Error("Seed file must be a non-empty JSON array");

  let upserts = 0;

  for (const row of rows) {
    const sport = parseSport(row.sport);
    const abbreviation = String(row.abbreviation).toUpperCase().trim();
    const name = String(row.name).trim();

    if (!abbreviation) throw new Error("Team seed row missing abbreviation");
    if (!name) throw new Error(`Team seed row missing name for ${sport} ${abbreviation}`);

    await prisma.team.upsert({
      where: { sport_abbreviation: { sport, abbreviation } },
      create: { sport, abbreviation, name },
      update: { name },
    });

    upserts += 1;
  }

  console.log(JSON.stringify({ ok: true, upserts }, null, 2));
}

main()
  .catch((err: any) => {
    console.error(err?.stack ?? err?.message ?? err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
