import "dotenv/config";
import { prisma } from "../src/lib/prisma";

const contestId = process.env.CONTEST_ID;
if (!contestId) {
  console.error('Missing CONTEST_ID. Example: CONTEST_ID="cml..." <run command>');
  process.exit(1);
}

const confirm = String(process.env.CONFIRM || "").toUpperCase() === "YES";

async function main() {
  const c = await prisma.contest.findUnique({
    where: { id: contestId },
    select: {
      id: true,
      siteContestId: true,
      contestName: true,
      slateId: true,
      slate: {
        select: {
          slateKey: true,
          week: true,
          slateType: true,
          season: { select: { year: true, sport: true } },
        },
      },
      winners: { select: { id: true, username: true, lineup: { select: { id: true } } } },
      analysis: { select: { id: true } },
    },
  });

  if (!c) {
    console.error("Contest not found:", contestId);
    process.exit(1);
  }

  const preview = {
    contestId: c.id,
    siteContestId: c.siteContestId ?? null,
    contestName: c.contestName ?? null,
    slateId: c.slateId,
    slateKey: c.slate?.slateKey ?? null,
    seasonYear: c.slate?.season?.year ?? null,
    sport: c.slate?.season?.sport ?? null,
    week: c.slate?.week ?? null,
    slateType: c.slate?.slateType ?? null,
    winners: c.winners.map((w) => ({
      id: w.id,
      username: w.username,
      lineupId: w.lineup?.id ?? null,
    })),
    hasAnalysis: Boolean(c.analysis?.id),
  };

  if (!confirm) {
    console.log(JSON.stringify({ ok: true, mode: "PREVIEW_ONLY", preview }, null, 2));
    console.log('To delete, re-run with CONFIRM=YES.');
    return;
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

  console.log(JSON.stringify({ ok: true, mode: "DELETED", preview }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});