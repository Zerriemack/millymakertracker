import "dotenv/config";
import { prisma } from "../src/lib/db";

async function main() {
  const targets = await prisma.contest.findMany({
    where: {
      totalOwnershipBp: null,
      winners: { none: {} },
    },
    select: { id: true, siteContestId: true },
  });

  if (targets.length === 0) {
    console.log("No empty NULL-ownership contests found.");
    return;
  }

  const ids = targets.map((t) => t.id);

  const del = await prisma.contest.deleteMany({
    where: { id: { in: ids } },
  });

  console.log("Empty NULL contests found:", targets.length);
  console.log("Deleted contests:", del.count);
  console.log("Example deleted siteContestId:");
  for (const t of targets.slice(0, 10)) console.log("-", t.siteContestId);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });