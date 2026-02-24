import { prisma } from "../src/lib/prisma";

const ID = "cmln7oxft0000xfit23fq37ee";

async function deleteLineupsByWinnerIds(winnerIds: string[]) {
  if (!winnerIds.length) return;

  const lineups = await prisma.lineup.findMany({
    where: { winnerId: { in: winnerIds } },
    select: { id: true },
  });

  const lineupIds = lineups.map((x) => x.id);
  if (!lineupIds.length) return;

  await prisma.lineupItem.deleteMany({ where: { lineupId: { in: lineupIds } } });
  await prisma.lineup.deleteMany({ where: { id: { in: lineupIds } } });
}

async function deleteWinnerCascade(winnerId: string) {
  await deleteLineupsByWinnerIds([winnerId]);
  await prisma.winner.delete({ where: { id: winnerId } });
}

async function deleteContestCascade(contestId: string) {
  const winners = await prisma.winner.findMany({
    where: { contestId },
    select: { id: true },
  });

  const winnerIds = winners.map((w) => w.id);

  await deleteLineupsByWinnerIds(winnerIds);
  await prisma.contestAnalysis.deleteMany({ where: { contestId } });
  await prisma.winner.deleteMany({ where: { contestId } });
  await prisma.contest.delete({ where: { id: contestId } });
}

async function deleteSlateCascade(slateId: string) {
  const contests = await prisma.contest.findMany({
    where: { slateId },
    select: { id: true },
  });

  for (const c of contests) {
    await deleteContestCascade(c.id);
  }

  await prisma.slate.delete({ where: { id: slateId } });
}

async function main() {
  const hitLineupItem = await prisma.lineupItem.findUnique({ where: { id: ID } });
  if (hitLineupItem) {
    await prisma.lineupItem.delete({ where: { id: ID } });
    console.log(`Deleted LineupItem ${ID}`);
    return;
  }

  const hitLineup = await prisma.lineup.findUnique({ where: { id: ID } });
  if (hitLineup) {
    await prisma.lineupItem.deleteMany({ where: { lineupId: ID } });
    await prisma.lineup.delete({ where: { id: ID } });
    console.log(`Deleted Lineup ${ID}`);
    return;
  }

  const hitWinner = await prisma.winner.findUnique({ where: { id: ID } });
  if (hitWinner) {
    await deleteWinnerCascade(ID);
    console.log(`Deleted Winner ${ID}`);
    return;
  }

  const hitContest = await prisma.contest.findUnique({ where: { id: ID } });
  if (hitContest) {
    await deleteContestCascade(ID);
    console.log(`Deleted Contest ${ID}`);
    return;
  }

  const hitSlate = await prisma.slate.findUnique({ where: { id: ID } });
  if (hitSlate) {
    await deleteSlateCascade(ID);
    console.log(`Deleted Slate ${ID}`);
    return;
  }

  const hitAnalysis = await prisma.contestAnalysis.findUnique({ where: { id: ID } });
  if (hitAnalysis) {
    await prisma.contestAnalysis.delete({ where: { id: ID } });
    console.log(`Deleted ContestAnalysis ${ID}`);
    return;
  }

  console.log(`No record found with id ${ID} in LineupItem, Lineup, Winner, Contest, Slate, ContestAnalysis.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
