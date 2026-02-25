import "dotenv/config";
import { prisma } from "../src/lib/db";

async function main() {
  const rows = await prisma.slate.findMany({
    where: {
      season: { sport: "NFL", year: 2025 },
      week: { in: [13, 14, 16, 17, 18] },
    },
    select: {
      week: true,
      slateType: true,
      slateKey: true,
      contests: {
        select: {
          site: true,
          siteContestId: true,
          winners: { select: { id: true } },
        },
      },
    },
    orderBy: [{ week: "asc" }, { slateType: "asc" }],
  });

  if (rows.length === 0) {
    console.log("No slates found for NFL 2025 weeks 13/14/16/17/18");
  }

  for (const s of rows) {
    const contestCount = s.contests.length;
    const winnerCount = s.contests.reduce((sum, c) => sum + c.winners.length, 0);

    console.log(
      `Week ${s.week} ${s.slateType} slatesKey=${s.slateKey} contests=${contestCount} winners=${winnerCount}`
    );

    for (const c of s.contests) {
      console.log(`  - ${c.site} ${c.siteContestId} winners=${c.winners.length}`);
    }
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});