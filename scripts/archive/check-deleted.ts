import "dotenv/config";
import { prisma } from "../src/lib/db";

const ids = ["cml8w1p390001whitgzypivob", "cml8wdyb7000nb1itrx6xfvnc"];

async function main() {
  const rows = await prisma.contest.findMany({
    where: { id: { in: ids } },
    select: { id: true, siteContestId: true },
  });

  console.log("Remaining contests:", rows);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});