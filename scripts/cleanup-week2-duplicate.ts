import "dotenv/config";
import { prisma } from "../src/lib/db";

async function main() {
  // Find duplicate contests by (site, siteContestId)
  const contests = await prisma.contest.findMany({
    select: { id: true, site: true, siteContestId: true, contestName: true, slateId: true }
  });

  const groups = new Map<string, typeof contests>();

  for (const c of contests) {
    const key = `${c.site}__${c.siteContestId}`;
    const arr = groups.get(key) ?? [];
    arr.push(c);
    groups.set(key, arr);
  }

  const dupGroups = [...groups.entries()].filter(([, arr]) => arr.length > 1);

  if (dupGroups.length === 0) {
    console.log("No duplicate contests found");
    return;
  }

  console.log(`Found ${dupGroups.length} duplicate group(s)\n`);

  for (const [key, arr] of dupGroups) {
    console.log(`Group: ${key}`);
    arr.forEach((c) => console.log(`  ${c.id} | ${c.contestName}`));

    // Keep the first one, delete the rest
    const [keep, ...toDelete] = arr;

    console.log(`Keeping: ${keep.id}`);
    console.log(`Deleting: ${toDelete.map((x) => x.id).join(", ")}\n`);

    for (const c of toDelete) {
      const winners = await prisma.winner.findMany({
        where: { contestId: c.id },
        include: { lineup: true }
      });

      for (const w of winners) {
        if (w.lineup) {
          await prisma.lineupItem.deleteMany({ where: { lineupId: w.lineup.id } });
          await prisma.lineup.delete({ where: { id: w.lineup.id } });
        }
        await prisma.winner.delete({ where: { id: w.id } });
      }

      await prisma.contest.delete({ where: { id: c.id } });
    }
  }

  console.log("Cleanup complete");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
