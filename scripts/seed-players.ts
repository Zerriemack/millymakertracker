import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import fs from "fs";
import path from "path";
import { prisma } from "../src/lib/prisma";

type SeedPlayer = {
  sport: "NFL" | "CFB";
  name: string;
  position: string;
  teamAbbreviation: string;
};

const TEAM_ABBREVIATION_ALIASES: Record<string, string> = {
  OAK: "LV",
  SD: "LAC",
  STL: "LAR",
};

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Usage: tsx scripts/seed-players.ts <path-to-seed-json>");

  const full = path.resolve(file);
  const raw = fs.readFileSync(full, "utf8");
  const players = JSON.parse(raw) as SeedPlayer[];

  const sports = Array.from(new Set(players.map(p => p.sport)));

  for (const sport of sports) {
    const data = players
      .filter(p => p.sport === sport)
      .map(async (player) => {
        const rawAbbr = player.teamAbbreviation.trim().toUpperCase();
        const lookupAbbr = TEAM_ABBREVIATION_ALIASES[rawAbbr] ?? rawAbbr;

        const team = await prisma.team.findUnique({
          where: {
            sport_abbreviation: {
              sport: player.sport,
              abbreviation: lookupAbbr,
            },
          },
        });

        if (!team) {
          throw new Error(
            `Missing Teams: (${player.sport}, raw=${rawAbbr}, lookup=${lookupAbbr})`
          );
        }

        return {
          sport: player.sport,
          name: player.name,
          position: player.position,
          teamId: team.id,
        };
      });

    const resolvedData = await Promise.all(data);

    await prisma.player.createMany({ data: resolvedData, skipDuplicates: true });
  }

  console.log("Seed complete (skipDuplicates=true).");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
