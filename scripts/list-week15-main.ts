import { prisma } from "../src/lib/db";

(async () => {
  const rows = await prisma.contest.findMany({
    where: {
      slate: {
        season: { sport: "NFL", year: 2025 },
        week: 15,
        slateType: "MAIN",
      },
    },
    orderBy: [{ id: "asc" }],
    select: {
      id: true,
      siteContestId: true,
      slate: { select: { id: true, slateKey: true } },
      winners: {
        select: {
          id: true,
          username: true,
          points: true,
          lineup: { select: { id: true, totalPoints: true, totalOwnershipBp: true } },
        },
      },
      analysis: { select: { id: true } },
      totalOwnershipBp: true,
      entries: true,
      topPrizeCents: true,
      entryFeeCents: true,
      contestName: true,
    },
  });

  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
