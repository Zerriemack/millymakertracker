import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  // 1) find all lineup ids where totalOwnershipBp is NULL
  const nullLineups = await prisma.lineup.findMany({
    where: { totalOwnershipBp: null },
    select: { id: true },
  });

  const ids = nullLineups.map((x) => x.id);

  if (ids.length === 0) {
    console.log("No NULL lineups found.");
    return;
  }

  // 2) delete lineup items first (children)
  const delItems = await prisma.lineupItem.deleteMany({
    where: { lineupId: { in: ids } },
  });

  // 3) delete the lineups (parents)
  const delLineups = await prisma.lineup.deleteMany({
    where: { id: { in: ids } },
  });

  console.log("NULL lineups found:", ids.length);
  console.log("Deleted lineup items:", delItems.count);
  console.log("Deleted lineups:", delLineups.count);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
