import "dotenv/config";
import { prisma } from "../src/lib/prisma";

type DeleteResult = {
  deletedContestId: string;
  deletedSiteContestId: string | null;
  deletedContestName?: string | null;
  deletedWinners: number;
  remainingContestIdsInSlate: number;
  deletedSlateId?: string | null;
};

async function deleteOneContest(contestId: string): Promise<DeleteResult> {
  const c = await prisma.contest.findUnique({
    where: { id: contestId },
    select: {
      id: true,
      siteContestId: true,
      contestName: true,
      slateId: true,
      winners: { select: { id: true, lineup: { select: { id: true } } } },
      analysis: { select: { id: true } },
    },
  });

  if (!c) {
    throw new Error(`Contest not found: ${contestId}`);
  }

  const deletedWinners = c.winners.length;

  return await prisma.$transaction(async (tx) => {
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
    let deletedSlateId: string | null = null;

    if (remaining === 0) {
      await tx.slate.delete({ where: { id: c.slateId } });
      deletedSlateId = c.slateId;
    }

    return {
      deletedContestId: c.id,
      deletedSiteContestId: c.siteContestId ?? null,
      deletedContestName: c.contestName ?? null,
      deletedWinners,
      remainingContestIdsInSlate: remaining,
      deletedSlateId,
    };
  });
}

function parseIdsFromEnv(): string[] {
  const raw =
    process.env.CONTEST_ID ??
    process.env.CONTEST_IDS ??
    "";

  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return Array.from(new Set(ids));
}

async function main() {
  const ids = parseIdsFromEnv();

  if (!ids.length) {
    console.error(`Missing CONTEST_ID or CONTEST_IDS.
Examples:
  CONTEST_ID="cmm..." dotenv_config_path=.env.local node --import dotenv/config --import tsx scripts/delete-contests.ts
  CONTEST_IDS="cmm1...,cmm2..." dotenv_config_path=.env.local node --import dotenv/config --import tsx scripts/delete-contests.ts
`);
    process.exit(1);
  }

  const results: DeleteResult[] = [];
  for (const id of ids) {
    const r = await deleteOneContest(id);
    results.push(r);
  }

  console.log(JSON.stringify({ ok: true, deleted: results }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});