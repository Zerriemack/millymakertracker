import "dotenv/config";
import { prisma } from "../src/lib/db";

function pct(n: number, d: number) {
  return d === 0 ? "0.0%" : `${((n / d) * 100).toFixed(1)}%`;
}

async function main() {
  const [
    seasons,
    slates,
    contests,
    winners,
    lineups,
    lineupItems,
    teams,
    players,
  ] = await Promise.all([
    prisma.season.count(),
    prisma.slate.count(),
    prisma.contest.count(),
    prisma.winner.count(),
    prisma.lineup.count(),
    prisma.lineupItem.count(),
    prisma.team.count(),
    prisma.player.count(),
  ]);

  console.log("\n=== DB COUNTS ===");
  console.log({ seasons, slates, contests, winners, lineups, lineupItems, teams, players });

  // Contests missing winners
  const contestsMissingWinner = await prisma.contest.count({
    where: { winners: { none: {} } },
  });

  // Winners missing lineups
  const winnersMissingLineup = await prisma.winner.count({
    where: { lineup: null },
  });

  console.log("\n=== COMPLETENESS ===");
  console.log(`Contests missing winner: ${contestsMissingWinner}`);
  console.log(`Winners missing lineup: ${winnersMissingLineup}`);

  // Showdown roster shape checks (if you added lineupType to Lineup)
  // If Lineup does not have lineupType yet, skip this section or tell me and I’ll adjust.
  const showdownLineups = await prisma.lineup.findMany({
    where: { lineupType: "SHOWDOWN" },
    select: { id: true },
    take: 5000,
  });

  let badCaptain = 0;
  let badFlex = 0;

  for (const lu of showdownLineups) {
    const captainCount = await prisma.lineupItem.count({
      where: { lineupId: lu.id, rosterSpot: "CAPTAIN" },
    });
    const flexCount = await prisma.lineupItem.count({
      where: { lineupId: lu.id, rosterSpot: "FLEX" },
    });

    if (captainCount !== 1) badCaptain++;
    if (flexCount !== 5) badFlex++;
  }

  console.log("\n=== SHOWDOWN VALIDATION (sample up to 5000) ===");
  console.log(`Showdown lineups checked: ${showdownLineups.length}`);
  console.log(`Bad captain count: ${badCaptain} (${pct(badCaptain, showdownLineups.length)})`);
  console.log(`Bad flex count: ${badFlex} (${pct(badFlex, showdownLineups.length)})`);

  console.log("\nDone.\n");
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
