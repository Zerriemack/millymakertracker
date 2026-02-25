import "dotenv/config";
import { prisma } from "../src/lib/prisma";

const contestId = process.env.CONTEST_ID;
if (!contestId) {
  console.error('Missing CONTEST_ID. Example: CONTEST_ID="xxxx" <run command>');
  process.exit(1);
}

(async () => {
  const c = await prisma.contest.findUnique({
    where: { id: contestId },
    select: {
      id: true,
      siteContestId: true,
      slateId: true,
      winners: { select: { id: true, lineup: { select: { id: true } } } },
      analysis: { select: { id: true } },
    },
  });

  if (!c) {
    console.error("Contest not found:", contestId);
    process.exit(1);
  }

  await prisma.$transaction(async (tx) => {
    for (const w of c.winners) {
      const lineupId = w.lineup?.id ?? null;
      if (lineupId) {
        await tx.lineupItem.deleteMany({ where: { lineupId } });
        await tx.lineup.delete({ where: { id: lineupId } });
      }
    }

    await tx.winner.deleteMany({ where: { contestId: c.id } });

    if (c.analysis?.id) {
      await tx.contestAnalysis.delete({ where: { id: c.analysis.id } });
    }

    await tx.contest.delete({ where: { id: c.id } });

    const remaining = await tx.contest.count({ where: { slateId: c.slateId } });
    if (remaining === 0) {
      await tx.slate.delete({ where: { id: c.slateId } });
    }
  });

  console.log(
    JSON.stringify(
      { ok: true, deletedContestId: c.id, siteContestId: c.siteContestId ?? null },
      null,
      2
    )
  );
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});