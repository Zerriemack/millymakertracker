import "dotenv/config";
import { prisma } from "../../src/lib/prisma";

async function main() {
  const ids = ["cml8w1p390001whitgzypivob", "cml8wdyb7000nb1itrx6xfvnc"];

  const rows = await prisma.contest.findMany({
    where: { id: { in: ids } },
    select: { id: true, contestName: true, site: true, siteContestId: true, slateId: true },
  });

  console.log(rows);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
