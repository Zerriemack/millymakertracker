import "dotenv/config";
import { prisma } from "../src/lib/prisma";

const a = process.env.CONTEST_ID_A ?? "";
const b = process.env.CONTEST_ID_B ?? "";
const idsToDelete = [a.trim(), b.trim()].filter(Boolean);

if (idsToDelete.length !== 2) {
  console.error(`Missing CONTEST_ID_A and CONTEST_ID_B.
Example:
  CONTEST_ID_A="cml8w1p390001whitgzypivob" CONTEST_ID_B="cml8wdyb7000nb1itrx6xfvnc" dotenv_config_path=.env.local node --import dotenv/config --import tsx scripts/delete-two-contests.ts
`);
  process.exit(1);
}

async function main() {
  const contests = await prisma.contest.findMany({
    where: { id: { in: idsToDelete } },
    select: {
      id: true,
      siteContestId: true,
      contestName: true,
      slateId: true,
      winners: { select: { id: true, lineup: { select: { id: true } } } },
      analysis: { select: { id: true } },
    },
  });

  const foundIds = new Set(contests.map((c) => c.id));
  const missing = idsToDelete.filter((id) => !foundIds.has(id));
  if (missing.length) {
    console.error("Contest(s) not found:", missing);
    process.exit(1);
  }

  await prisma.$transaction(async (tx) => {
    for (const c of contests) {
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
    }
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        deleted: contests.map((c) => ({
          id: c.id,
          siteContestId: c.siteContestId ?? null,
          contestName: c.contestName ?? null,
        })),
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});