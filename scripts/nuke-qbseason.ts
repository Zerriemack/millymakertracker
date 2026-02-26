import { prisma } from "../src/lib/prisma";

async function main() {
  const res = await prisma.qbSeason.deleteMany({});
  console.log({ qbSeasonDeleted: res.count });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
