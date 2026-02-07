import "dotenv/config";
import { prisma } from "../src/lib/db";

async function main() {
  const contests = await prisma.contest.findMany({
    where: {
      totalOwnershipBp: null,
      siteContestId: { contains: "__mil_maker" },
    },
    select: { id: true, siteContestId: true },
  });

  console.log("Targets found:", contests.length);
  if (contests.length === 0) return;

  const contestIds = contests.map((c) => c.id);

  const winners = await prisma.winner.findMany({
    where: { contestId: { in: contestIds } },
    select: { id: true },
  });
  const winnerIds = winners.map((w) => w.id);

  const lineups = await prisma.lineup.findMany({
    where: { winnerId: { in: winnerIds } },
    select: { id: true },
  });
  const lineupIds = lineups.map((l) => l.id);

  const delItems = await prisma.lineupItem.deleteMany({
    where: { lineupId: { in: lineupIds } },
  });

  const delLineups = await prisma.lineup.deleteMany({
    where: { id: { in: lineupIds } },
  });

  const delWinners = await prisma.winner.deleteMany({
    where: { id: { in: winnerIds } },
  });

  const delContests = await prisma.contest.deleteMany({
    where: { id: { in: contestIds } },
  });

  console.log("Deleted lineup items:", delItems.count);
  console.log("Deleted lineups:", delLineups.count);
  console.log("Deleted winners:", delWinners.count);
  console.log("Deleted contests:", delContests.count);

  console.log("Example deleted siteContestId:");
  for (const c of contests.slice(0, 15)) console.log("-", c.siteContestId);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
