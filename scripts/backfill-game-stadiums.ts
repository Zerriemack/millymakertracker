import fs from "node:fs";
import path from "node:path";

import { prisma } from "../src/lib/prisma";

type OverrideRow = {
  seasonYear: number;
  week?: number | null;
  kickoffTimeUtc: string;
  homeTeam: string;
  awayTeam: string;
  stadiumName: string;
  stadiumCity: string;
  stadiumState: string;
};

type StadiumRow = {
  id: string;
  name: string;
  city: string;
  state: string;
  teamAbbreviation: string | null;
  activeFromSeason: number | null;
  activeToSeason: number | null;
};

const DEFAULT_OVERRIDES = "data/seeds/nfl_game_stadium_overrides.json";
const DEFAULT_CHUNK_SIZE = 50;

type Args = {
  overridesPath: string;
  dryRun: boolean;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    overridesPath: DEFAULT_OVERRIDES,
    dryRun: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const v = argv[i];
    if (v === "--dry-run") {
      args.dryRun = true;
      continue;
    }
    if (v === "--overrides" || v === "-o") {
      const next = argv[i + 1];
      if (!next) throw new Error("Missing value for --overrides");
      args.overridesPath = next;
      i++;
      continue;
    }
  }

  return args;
}

function toOverrideKey(row: OverrideRow) {
  return [
    row.seasonYear,
    row.kickoffTimeUtc,
    row.homeTeam.toUpperCase(),
    row.awayTeam.toUpperCase(),
  ].join("|");
}

function toGameKey(game: {
  seasonYear: number;
  kickoffTimeUtc: Date;
  homeTeam: string;
  awayTeam: string;
}) {
  return [
    game.seasonYear,
    game.kickoffTimeUtc.toISOString(),
    game.homeTeam.toUpperCase(),
    game.awayTeam.toUpperCase(),
  ].join("|");
}

function readOverrides(filePath: string) {
  const abs = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
  if (!fs.existsSync(abs)) return [] as OverrideRow[];
  const rows = JSON.parse(fs.readFileSync(abs, "utf8")) as OverrideRow[];
  if (!Array.isArray(rows)) throw new Error("Overrides must be an array.");
  return rows;
}

function chunkArray<T>(items: T[], size: number) {
  if (size <= 0) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function isInternationalKickoff(kickoff: Date) {
  const h = kickoff.getUTCHours();
  const m = kickoff.getUTCMinutes();
  return m === 30 && (h === 13 || h === 14 || h === 15);
}

function stadiumKey(row: StadiumRow) {
  return [row.name.trim().toLowerCase(), row.city.trim().toLowerCase(), row.state.trim().toLowerCase()].join("|");
}

async function main() {
  const args = parseArgs(process.argv);
  const overrides = readOverrides(args.overridesPath);

  const stadiums = await prisma.stadium.findMany({
    select: {
      id: true,
      name: true,
      city: true,
      state: true,
      teamAbbreviation: true,
      activeFromSeason: true,
      activeToSeason: true,
    },
  });

  const stadiumByKey = new Map<string, StadiumRow>();
  for (const s of stadiums) {
    stadiumByKey.set(stadiumKey(s), s);
  }

  const overridesByGameKey = new Map<string, OverrideRow>();
  for (const row of overrides) {
    if (!row || typeof row !== "object") throw new Error("Override row is not an object.");
    if (!Number.isFinite(row.seasonYear)) throw new Error("Override missing seasonYear.");
    if (!row.kickoffTimeUtc) throw new Error("Override missing kickoffTimeUtc.");
    if (!row.homeTeam || !row.awayTeam) throw new Error("Override missing homeTeam/awayTeam.");
    if (!row.stadiumName || !row.stadiumCity || !row.stadiumState) {
      throw new Error("Override missing stadiumName/city/state.");
    }

    overridesByGameKey.set(toOverrideKey(row), row);
  }

  const stadiumsByTeam = new Map<string, StadiumRow[]>();
  for (const s of stadiums) {
    if (!s.teamAbbreviation) continue;
    const key = s.teamAbbreviation.toUpperCase();
    const list = stadiumsByTeam.get(key) ?? [];
    list.push(s);
    stadiumsByTeam.set(key, list);
  }

  const games = await prisma.game.findMany({
    where: { sport: "NFL", stadiumId: null },
    include: {
      season: { select: { year: true } },
      homeTeam: { select: { abbreviation: true } },
      awayTeam: { select: { abbreviation: true } },
    },
  });

  const unresolved: Array<{
    id: string;
    seasonYear: number;
    week: number | null;
    kickoffTimeUtc: string;
    homeTeam: string;
    awayTeam: string;
    reason: string;
  }> = [];

  const updates: Array<{ id: string; stadiumId: string }> = [];

  for (const game of games) {
    const seasonYear = game.season.year;
    const homeAbbr = game.homeTeam.abbreviation.toUpperCase();
    const awayAbbr = game.awayTeam.abbreviation.toUpperCase();
    const kickoff = game.kickoffTimeUtc;

    const gameKey = toGameKey({
      seasonYear,
      kickoffTimeUtc: kickoff,
      homeTeam: homeAbbr,
      awayTeam: awayAbbr,
    });

    const override = overridesByGameKey.get(gameKey);
    if (override) {
      const key = [
        override.stadiumName.trim().toLowerCase(),
        override.stadiumCity.trim().toLowerCase(),
        override.stadiumState.trim().toLowerCase(),
      ].join("|");
      const stadium = stadiumByKey.get(key);
      if (!stadium) {
        unresolved.push({
          id: game.id,
          seasonYear,
          week: game.week ?? null,
          kickoffTimeUtc: kickoff.toISOString(),
          homeTeam: homeAbbr,
          awayTeam: awayAbbr,
          reason: `override stadium not found: ${override.stadiumName} (${override.stadiumCity}, ${override.stadiumState})`,
        });
        continue;
      }

      updates.push({ id: game.id, stadiumId: stadium.id });
      continue;
    }

    if (isInternationalKickoff(kickoff)) {
      unresolved.push({
        id: game.id,
        seasonYear,
        week: game.week ?? null,
        kickoffTimeUtc: kickoff.toISOString(),
        homeTeam: homeAbbr,
        awayTeam: awayAbbr,
        reason: "international kickoff time without override",
      });
      continue;
    }

    const candidates = (stadiumsByTeam.get(homeAbbr) ?? []).filter((s) => {
      const from = s.activeFromSeason ?? -Infinity;
      const to = s.activeToSeason ?? Infinity;
      return seasonYear >= from && seasonYear <= to;
    });

    if (candidates.length === 1) {
      updates.push({ id: game.id, stadiumId: candidates[0].id });
      continue;
    }

    if (candidates.length === 0) {
      unresolved.push({
        id: game.id,
        seasonYear,
        week: game.week ?? null,
        kickoffTimeUtc: kickoff.toISOString(),
        homeTeam: homeAbbr,
        awayTeam: awayAbbr,
        reason: "no stadium match for home team/season",
      });
      continue;
    }

    unresolved.push({
      id: game.id,
      seasonYear,
      week: game.week ?? null,
      kickoffTimeUtc: kickoff.toISOString(),
      homeTeam: homeAbbr,
      awayTeam: awayAbbr,
      reason: "multiple stadium matches for home team/season",
    });
  }

  if (!args.dryRun && updates.length > 0) {
    const chunkSize = DEFAULT_CHUNK_SIZE;
    const chunks = chunkArray(updates, chunkSize);

    console.log(
      JSON.stringify(
        {
          ok: true,
          dryRun: args.dryRun,
          totalMatched: updates.length,
          chunkSize,
          totalChunks: chunks.length,
        },
        null,
        2
      )
    );

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      for (const u of chunk) {
        await prisma.game.update({
          where: { id: u.id },
          data: { stadiumId: u.stadiumId },
        });
      }
      console.log(`Completed chunk ${i + 1}/${chunks.length} (${chunk.length} updates)`);
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        dryRun: args.dryRun,
        overridesFile: args.overridesPath,
        totalGames: games.length,
        updatedGames: updates.length,
        chunkSize: DEFAULT_CHUNK_SIZE,
        unresolvedCount: unresolved.length,
        unresolvedGames: unresolved,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
