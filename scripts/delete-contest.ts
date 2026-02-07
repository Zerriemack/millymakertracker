import "dotenv/config";
import { prisma } from "../src/lib/db";

const contestId = "PASTE_DUPLICATE_ID_HERE";

async function main() {
  await prisma.$transaction(async (tx) => {
    await tx.winner.deleteMany({ where: { contestId } });
    await tx.lineupItem.deleteMany({ where: { lineup: { contestId } } });
    await tx.lineup.deleteMany({ where: { contestId } });
    await tx.contest.delete({ where: { id: contestId } });
  });

  console.log("Deleted duplicate contest:", contestId);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});