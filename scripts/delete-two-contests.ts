import "dotenv/config";
import { prisma } from "../src/lib/db";

const idsToDelete = [
  "cml8w1p390001whitgzypivob",
  "cml8wdyb7000nb1itrx6xfvnc",
];

async function main() {
  await prisma.$transaction(async (tx) => {
    // winners
    await tx.winner.deleteMany({ where: { contestId: { in: idsToDelete } } });

    // lineup items tied to lineups whose contestId is in idsToDelete
    await tx.lineupItem.deleteMany({
      where: { lineup: { contestId: { in: idsToDelete } } },
    });

    // lineups
    await tx.lineup.deleteMany({ where: { contestId: { in: idsToDelete } } });

    // contests
    await tx.contest.deleteMany({ where: { id: { in: idsToDelete } } });
  });

  console.log("Deleted contests:", idsToDelete);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});