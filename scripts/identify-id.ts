import "dotenv/config";
import { prisma } from "../src/lib/prisma";

const id = process.env.ID;
if (!id) {
  console.error('Missing ID. Example: ID="cml..." <run command>');
  process.exit(1);
}

async function main() {
  const [contest, slate, winner, lineup] = await Promise.all([
    prisma.contest.findUnique({
      where: { id },
      select: { id: true, siteContestId: true, contestName: true, slateId: true },
    }),
    prisma.slate.findUnique({
      where: { id },
      select: { id: true, slateKey: true, week: true, slateType: true, seasonId: true },
    }),
    prisma.winner.findUnique({
      where: { id },
      select: { id: true, username: true, contestId: true },
    }),
    prisma.lineup.findUnique({
      where: { id },
      select: { id: true, winnerId: true, totalPoints: true, salaryUsed: true },
    }),
  ]);

  const kind =
    contest ? "CONTEST" :
    slate ? "SLATE" :
    winner ? "WINNER" :
    lineup ? "LINEUP" :
    "NOT_FOUND";

  console.log(JSON.stringify({ kind, contest, slate, winner, lineup }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});