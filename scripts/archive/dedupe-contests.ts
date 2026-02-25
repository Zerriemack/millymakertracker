import "dotenv/config";
import { prisma } from "../../src/lib/prisma";

async function run() {
  // Find all contests grouped by (site, slateId)
  const contests = await prisma.contest.findMany({
    select: {
      id: true,
      site: true,
      slateId: true,
      contestName: true,
      entryFeeCents: true,
      entries: true,
      topPrizeCents: true
    }
  });

  const keyToIds = new Map<string, string[]>();

  for (const c of contests) {
    const key = `${c.site}::${c.slateId}`;
    const arr = keyToIds.get(key) ?? [];
    arr.push(c.id);
    keyToIds.set(key, arr);
  }

  let merged = 0;
  let deleted = 0;

  for (const [key, ids] of keyToIds.entries()) {
    if (ids.length <= 1) continue;

    // Load full contest + winner counts to pick the best one to keep
    const full = await prisma.contest.findMany({
      where: { id: { in: ids } },
      include: { winners: { select: { id: true } } }
    });

    // Choose keep:
    // 1) has winners
    // 2) has entryFeeCents or entries or topPrizeCents filled
    // 3) otherwise first
    full.sort((a, b) => {
      const aw = a.winners.length > 0 ? 1 : 0;
      const bw = b.winners.length > 0 ? 1 : 0;
      if (aw !== bw) return bw - aw;

      const aMeta = (a.entryFeeCents ? 1 : 0) + (a.entries ? 1 : 0) + (a.topPrizeCents ? 1 : 0);
      const bMeta = (b.entryFeeCents ? 1 : 0) + (b.entries ? 1 : 0) + (b.topPrizeCents ? 1 : 0);
      if (aMeta !== bMeta) return bMeta - aMeta;

      return 0;
    });

    const keep = full[0];
    const remove = full.slice(1);

    // Move winners from duplicates onto keep contest
    for (const r of remove) {
      if (r.winners.length > 0) {
        await prisma.winner.updateMany({
          where: { contestId: r.id },
          data: { contestId: keep.id }
        });
        merged++;
      }
    }

    // Now safe to delete the duplicate contests (no winners pointing to them)
    for (const r of remove) {
      await prisma.contest.delete({ where: { id: r.id } });
      deleted++;
    }

    console.log(`Deduped ${key}: kept ${keep.id}, removed ${remove.map(x => x.id).join(", ")}`);
  }

  console.log(`Done. Winners moved: ${merged}. Contests deleted: ${deleted}.`);
  await prisma.$disconnect();
}

run().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
