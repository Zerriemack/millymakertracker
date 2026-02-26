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

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Usage: tsx scripts/seed-players.ts <path-to-seed-json>");

  const full = path.resolve(file);
  const raw = fs.readFileSync(full, "utf8");
  const players = JSON.parse(raw) as SeedPlayer[];

  const sports = Array.from(new Set(players.map(p => p.sport)));

  for (const sport of sports) {
    const neededTeams = Array.from(
      new Set(players.filter(p => p.sport === sport).map(p => p.teamAbbreviation))
    );

    const teams = await prisma.team.findMany({
      where: { sport, abbreviation: { in: neededTeams } },
      select: { id: true, abbreviation: true }
    });

    const teamIdByAbbr = new Map(teams.map(t => [t.abbreviation, t.id]));
    const missingTeams = neededTeams.filter(a => !teamIdByAbbr.get(a));
    if (missingTeams.length) {
      throw new Error(
        `Missing Teams: ${missingTeams.map(t => `(${sport}, ${t})`).join(", ")}`
      );
    }

    const data = players
      .filter(p => p.sport === sport)
      .map(p => ({
        sport: p.sport,
        name: p.name,
        position: p.position,
        teamId: teamIdByAbbr.get(p.teamAbbreviation)!
      }));

    await prisma.player.createMany({ data, skipDuplicates: true });
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
