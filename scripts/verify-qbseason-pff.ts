import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function fetchSeasonId(year: number) {
  return prisma.season.findFirst({
    where: { year, sport: "NFL" },
    select: { id: true, year: true },
  });
}

async function fetchPlayerId(name: string) {
  return prisma.player.findFirst({
    where: { name, sport: "NFL", position: "QB" },
    select: { id: true, name: true },
  });
}

async function fetchTeamId(abbreviation: string) {
  return prisma.team.findFirst({
    where: { abbreviation, sport: "NFL" },
    select: { id: true, abbreviation: true },
  });
}

async function printQbSeason(label: string, seasonId: string, playerId: string, teamId: string) {
  const row = await prisma.qbSeason.findUnique({
    where: {
      sport_seasonId_playerId_teamId: {
        sport: "NFL",
        seasonId,
        playerId,
        teamId,
      },
    },
    select: {
      seasonId: true,
      playerId: true,
      teamId: true,
      pffPassGrade: true,
      archetype: true,
    },
  });

  console.log(`\n${label}`);
  console.log({ seasonId, playerId, teamId });
  console.log(row ?? "No QbSeason row found.");
}

async function main() {
  const season = await fetchSeasonId(2025);
  if (!season) {
    console.log("Missing 2025 NFL season.");
    return;
  }

  const flacco = await fetchPlayerId("Joe Flacco");
  const brissett = await fetchPlayerId("Jacoby Brissett");
  const cin = await fetchTeamId("CIN");
  const ari = await fetchTeamId("ARI");

  if (flacco && cin) {
    await printQbSeason("Joe Flacco (2025, CIN)", season.id, flacco.id, cin.id);
  } else {
    console.log("Missing Joe Flacco or CIN team record.");
  }

  if (brissett && ari) {
    await printQbSeason("Jacoby Brissett (2025, ARI)", season.id, brissett.id, ari.id);
  } else {
    console.log("Missing Jacoby Brissett or ARI team record.");
  }
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
