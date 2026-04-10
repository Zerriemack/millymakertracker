import { mkdir, stat, writeFile } from "fs/promises";
import path from "path";

type Site = "draftkings" | "fanduel";
type GameType = "classic" | "showdown";

type RawGameInput = {
  awayTeam?: unknown;
  homeTeam?: unknown;
  spread?: unknown;
  total?: unknown;
  startTime?: unknown;
};

type NormalizedGameInput = {
  awayTeam: string;
  homeTeam: string;
  spread: string;
  total: number;
  startTime: string;
};

type GeneratedGame = {
  id: string;
  slateId: string;
  awayTeam: string;
  homeTeam: string;
  gameLabel: string;
  spread: string;
  total: number;
  startTime: string;
};

type TeamInput = {
  slateId: string;
  gameId: string;
  team: string;
  pointsScored: number;
  pace: number;
  rushRate: number;
  rushTdRatio: number;
  dstSalary: number;
  sackRate: number;
};

type Slate = {
  id: string;
  sport: string;
  season: number;
  week: number;
  site: Site;
  gameType: GameType;
  slateType: string;
  name: string;
  salaryCap: number;
  rosterSize: number;
  startTime: string;
};

type Settings = {
  slateId: string;
  lineupCount: number;
  fieldSize: number;
  simulationCount: number;
  payoutProfile: "topHeavy" | "standard" | "cash";
};

const argv = process.argv.slice(2);

function parseArgs(tokens: string[]): Map<string, string> {
  const parsed = new Map<string, string>();

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (!token.startsWith("--")) continue;

    const key = token.slice(2);
    const next = tokens[i + 1];

    if (next && !next.startsWith("--")) {
      parsed.set(key, next);
      i += 1;
    } else {
      parsed.set(key, "true");
    }
  }

  return parsed;
}

const args = parseArgs(argv);

function fail(message: string): never {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function requireArg(name: string): string {
  const value = args.get(name);
  if (!value) {
    fail(`Missing required argument: --${name}`);
  }
  return value;
}

function parseIntegerArg(name: string): number {
  const raw = requireArg(name);
  const value = Number(raw);

  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    fail(`--${name} must be a valid integer. Received: ${raw}`);
  }

  return value;
}

function parseBooleanArg(name: string): boolean {
  const raw = (args.get(name) ?? "false").trim().toLowerCase();

  if (raw === "true") return true;
  if (raw === "false") return false;

  fail(`--${name} must be true or false. Received: ${raw}`);
}

function normalizeSlug(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  if (!slug) {
    fail(`Invalid slug value: ${value}`);
  }

  return slug;
}

function isValidDateString(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

function validateDateString(name: string, value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    fail(`Missing required value for ${name}`);
  }

  if (!isValidDateString(normalized)) {
    fail(`Invalid date string for ${name}: ${value}`);
  }

  return normalized;
}

function toUpperTeamCode(value: unknown, fieldName: string, gameIndex: number): string {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (!normalized) {
    fail(`Game ${gameIndex} is missing ${fieldName}`);
  }
  return normalized;
}

function toTrimmedString(value: unknown, fieldName: string, gameIndex: number): string {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    fail(`Game ${gameIndex} is missing ${fieldName}`);
  }
  return normalized;
}

function toFiniteNumber(value: unknown, fieldName: string, gameIndex: number): number {
  const normalized = Number(value);
  if (!Number.isFinite(normalized)) {
    fail(`Game ${gameIndex} has invalid ${fieldName}`);
  }
  return normalized;
}

function buildGameId(
  awayTeam: string,
  homeTeam: string,
  season: number,
  weekPadded: string,
  occurrence: number,
  duplicateCount: number
): string {
  const awayKey = normalizeSlug(awayTeam);
  const homeKey = normalizeSlug(homeTeam);
  const base = `${awayKey}-${homeKey}-${season}-${weekPadded}`;

  if (duplicateCount === 1 || occurrence === 1) {
    return base;
  }

  return `${base}-${occurrence}`;
}

async function ensureDirectory(targetDir: string, force: boolean): Promise<void> {
  try {
    const existing = await stat(targetDir);

    if (!existing.isDirectory()) {
      fail(`Path exists but is not a directory: ${targetDir}`);
    }

    if (!force) {
      fail(`Slate package already exists at ${targetDir}. Use --force true to overwrite.`);
    }
  } catch (error) {
    const code =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof (error as { code?: unknown }).code === "string"
        ? (error as { code: string }).code
        : null;

    if (code === "ENOENT") {
      await mkdir(targetDir, { recursive: true });
      return;
    }

    throw error;
  }

  await mkdir(targetDir, { recursive: true });
}

async function writePrettyJson(filePath: string, data: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function run(): Promise<void> {
  const sport = normalizeSlug(requireArg("sport"));
  const season = parseIntegerArg("season");
  const week = parseIntegerArg("week");
  const siteRaw = normalizeSlug(requireArg("site"));
  const gameTypeRaw = requireArg("gameType").trim().toLowerCase();
  const slateType = normalizeSlug(requireArg("slateType"));
  const name = requireArg("name").trim();
  const startTime = validateDateString("--startTime", requireArg("startTime"));
  const salaryCap = parseIntegerArg("salaryCap");
  const rosterSize = parseIntegerArg("rosterSize");
  const lineupCount = parseIntegerArg("lineupCount");
  const fieldSize = parseIntegerArg("fieldSize");
  const simulationCount = parseIntegerArg("simulationCount");
  const gamesRaw = requireArg("games");
  const force = parseBooleanArg("force");

  if (week < 1 || week > 99) {
    fail("--week must be between 1 and 99");
  }

  if (!name) {
    fail("--name is required");
  }

  if (salaryCap <= 0) fail("--salaryCap must be greater than 0");
  if (rosterSize <= 0) fail("--rosterSize must be greater than 0");
  if (lineupCount <= 0) fail("--lineupCount must be greater than 0");
  if (fieldSize <= 0) fail("--fieldSize must be greater than 0");
  if (simulationCount <= 0) fail("--simulationCount must be greater than 0");

  if (siteRaw !== "draftkings" && siteRaw !== "fanduel") {
    fail("--site must be either draftkings or fanduel");
  }
  const site = siteRaw as Site;

  if (gameTypeRaw !== "classic" && gameTypeRaw !== "showdown") {
    fail("--gameType must be either classic or showdown");
  }
  const gameType = gameTypeRaw as GameType;

  let parsedGames: unknown;
  try {
    parsedGames = JSON.parse(gamesRaw);
  } catch {
    fail("--games must be valid JSON");
  }

  if (!Array.isArray(parsedGames)) {
    fail("--games must be a JSON array");
  }

  if (parsedGames.length === 0) {
    fail("--games must contain at least one game");
  }

  const normalizedGames: NormalizedGameInput[] = parsedGames.map((rawGame, index) => {
    const gameIndex = index + 1;
    const game = rawGame as RawGameInput;

    const awayTeam = toUpperTeamCode(game.awayTeam, "awayTeam", gameIndex);
    const homeTeam = toUpperTeamCode(game.homeTeam, "homeTeam", gameIndex);
    const spread = toTrimmedString(game.spread, "spread", gameIndex);
    const total = toFiniteNumber(game.total, "total", gameIndex);
    const gameStartTime = validateDateString(
      `game ${gameIndex} startTime`,
      toTrimmedString(game.startTime, "startTime", gameIndex)
    );

    if (awayTeam === homeTeam) {
      fail(`Game ${gameIndex} has identical awayTeam and homeTeam`);
    }

    return {
      awayTeam,
      homeTeam,
      spread,
      total,
      startTime: gameStartTime,
    };
  });

  const weekPadded = String(week).padStart(2, "0");
  const slateId = `${sport}-${season}-week-${weekPadded}-${site}-${gameType}-${slateType}`;
  const slateKey = `${sport}/${season}/week-${weekPadded}/${site}-${gameType}-${slateType}`;
  const slateDir = path.resolve(
    process.cwd(),
    "src",
    "data",
    "simulator",
    "slates",
    sport,
    String(season),
    `week-${weekPadded}`,
    `${site}-${gameType}-${slateType}`
  );

  await ensureDirectory(slateDir, force);

  const duplicateMap = new Map<string, number>();
  for (const game of normalizedGames) {
    const key = `${game.awayTeam}-${game.homeTeam}`;
    duplicateMap.set(key, (duplicateMap.get(key) ?? 0) + 1);
  }

  const occurrenceMap = new Map<string, number>();
  const games: GeneratedGame[] = normalizedGames.map((game) => {
    const duplicateKey = `${game.awayTeam}-${game.homeTeam}`;
    const occurrence = (occurrenceMap.get(duplicateKey) ?? 0) + 1;
    occurrenceMap.set(duplicateKey, occurrence);

    return {
      id: buildGameId(
        game.awayTeam,
        game.homeTeam,
        season,
        weekPadded,
        occurrence,
        duplicateMap.get(duplicateKey) ?? 1
      ),
      slateId,
      awayTeam: game.awayTeam,
      homeTeam: game.homeTeam,
      gameLabel: `${game.awayTeam} @ ${game.homeTeam}`,
      spread: game.spread,
      total: game.total,
      startTime: game.startTime,
    };
  });

  const basePoints = gameType === "showdown" ? 22.5 : 24.0;
  const basePace = gameType === "showdown" ? 64.5 : 65.5;
  const baseRushRate = 45;
  const baseRushTdRatio = 52;
  const baseDstSalary = gameType === "showdown" ? 2600 : 2800;
  const baseSackRate = 6.5;

  const teamInputs: TeamInput[] = games.flatMap((game) => {
    const away: TeamInput = {
      slateId,
      gameId: game.id,
      team: game.awayTeam,
      pointsScored: Number((basePoints - 0.4).toFixed(1)),
      pace: Number((basePace - 0.5).toFixed(1)),
      rushRate: baseRushRate,
      rushTdRatio: baseRushTdRatio,
      dstSalary: baseDstSalary,
      sackRate: baseSackRate,
    };

    const home: TeamInput = {
      slateId,
      gameId: game.id,
      team: game.homeTeam,
      pointsScored: Number((basePoints + 0.4).toFixed(1)),
      pace: Number((basePace + 0.5).toFixed(1)),
      rushRate: baseRushRate,
      rushTdRatio: baseRushTdRatio,
      dstSalary: baseDstSalary,
      sackRate: baseSackRate,
    };

    return [away, home];
  });

  const slate: Slate = {
    id: slateId,
    sport,
    season,
    week,
    site,
    gameType,
    slateType,
    name,
    salaryCap,
    rosterSize,
    startTime,
  };

  const settings: Settings = {
    slateId,
    lineupCount,
    fieldSize,
    simulationCount,
    payoutProfile: "standard",
  };

  const files: Array<{ name: string; data: unknown }> = [
    { name: "slate.json", data: slate },
    { name: "games.json", data: games },
    { name: "team-inputs.json", data: teamInputs },
    { name: "player-inputs.json", data: [] },
    { name: "settings.json", data: settings },
  ];

  await Promise.all(
    files.map((file) => writePrettyJson(path.join(slateDir, file.name), file.data))
  );

  console.log("Simulator slate package created.");
  console.log(`Slate ID: ${slateId}`);
  console.log(`Folder: ${slateDir}`);
  console.log("Files:");
  for (const file of files) {
    console.log(`- ${file.name}`);
  }
  console.log(`Example URL: /simulator?slate=${slateKey}&tab=inputs`);
}

run().catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});
