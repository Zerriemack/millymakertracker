import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const slateId = process.argv[2];
  if (!slateId) {
    console.error("Usage: tsx scripts/delete-slate.ts <slateId>");
    process.exit(1);
  }

  // Delete children first to avoid FK errors
  await prisma.lineupItem.deleteMany({
    where: { lineup: { contest: { slateId } } },
  });

  await prisma.lineup.deleteMany({
    where: { contest: { slateId } },
  });

  await prisma.winner.deleteMany({
    where: { contest: { slateId } },
  });

  await prisma.contest.deleteMany({
    where: { slateId },
  });

  const res = await prisma.slate.deleteMany({
    where: { id: slateId },
  });

  console.log("Deleted slates:", res.count, "id:", slateId);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
