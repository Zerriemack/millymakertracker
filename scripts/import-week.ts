/* eslint-disable */
import fs from "node:fs";
import path from "node:path";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

config({ path: ".env.local" });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is missing. Check .env.local in the project root.");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

type Input = {
  season: { year: number; sport: "NFL" | "CFB" };
  slate: {
    week: number;
    slateType: "MAIN" | "SHOWDOWN" | "TNF" | "SNF" | "MNF";
    slateDate: string;
  };
  contest: {
    site: string;
    contestName: string;
    entryFeeCents?: number | null;
    entries?: number | null;
    topPrizeCents?: number | null;
  };
  winner: { username: string; points: number; maxEntries?: number | null };
  lineup: {
    salaryUsed?: number | null;
    totalPoints?: number | null;
    items: Array<{
      rosterSpot: "QB" | "RB" | "WR" | "TE" | "FLEX" | "DST" | "CAPTAIN";
      playerName: string;
      position: string;
      team: string;
      salary?: number | null;
      points?: number | null;
      ownership?: number | null;
    }>;
  };
};

const fileRel = process.argv[2];
if (!fileRel) {
  console.error("Usage: npx tsx scripts/import-week.ts data/nfl/2025/week-01-main.json");
  process.exit(1);
}

const filePath = path.resolve(process.cwd(), fileRel);
const raw = fs.readFileSync(filePath, "utf8");
const input = JSON.parse(raw) as Input;

function normalizeTeam(abbr: string) {
  return abbr.trim().toUpperCase();
}

async function main() {
  const season = await prisma.season.upsert({
    where: { year_sport: { year: input.season.year, sport: input.season.sport } },
    update: {},
    create: { year: input.season.year, sport: input.season.sport }
  });

  const slate = await prisma.slate.upsert({
    where: {
      seasonId_week_slateType: {
        seasonId: season.id,
        week: input.slate.week,
        slateType: input.slate.slateType
      }
    },
    update: { slateDate: new Date(input.slate.slateDate) },
    create: {
      seasonId: season.id,
      week: input.slate.week,
      slateType: input.slate.slateType,
      slateDate: new Date(input.slate.slateDate)
    }
  });

  const contest = await prisma.contest.create({
    data: {
      slateId: slate.id,
      site: input.contest.site,
      contestName: input.contest.contestName,
      entryFeeCents: input.contest.entryFeeCents ?? null,
      entries: input.contest.entries ?? null,
      topPrizeCents: input.contest.topPrizeCents ?? null
    }
  });

  const winner = await prisma.winner.create({
    data: {
      contestId: contest.id,
      username: input.winner.username,
      points: input.winner.points,
      maxEntries: input.winner.maxEntries ?? null
    }
  });

  const lineup = await prisma.lineup.create({
    data: {
      winnerId: winner.id,
      salaryUsed: input.lineup.salaryUsed ?? null,
      totalPoints: input.lineup.totalPoints ?? null
    }
  });

  for (const item of input.lineup.items) {
    const teamAbbr = normalizeTeam(item.team);

    const team = await prisma.team.upsert({
      where: { abbreviation: teamAbbr },
      update: {},
      create: { abbreviation: teamAbbr, name: teamAbbr }
    });

    const player = await prisma.player.upsert({
      where: {
        name_position_teamId: {
          name: item.playerName,
          position: item.position,
          teamId: team.id
        }
      },
      update: {},
      create: { name: item.playerName, position: item.position, teamId: team.id }
    });

    await prisma.lineupItem.create({
      data: {
        lineupId: lineup.id,
        playerId: player.id,
        rosterSpot: item.rosterSpot,
        salary: item.salary ?? null,
        points: item.points ?? null,
        ownership: item.ownership ?? null
      }
    });
  }

  console.log("Imported:", {
    season: `${input.season.sport} ${input.season.year}`,
    slate: `Week ${input.slate.week} ${input.slate.slateType}`,
    contest: input.contest.contestName,
    winner: input.winner.username
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
