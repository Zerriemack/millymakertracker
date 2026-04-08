import { stat } from "fs/promises";
import path from "path";
import { resolveSlatePackagePath } from "../src/lib/simulator/paths";
import { loadJson } from "../src/lib/simulator/loadJson";
import type {
  SimulatorGame,
  SimulatorPlayerInput,
  SimulatorSettings,
  SimulatorSlate,
  SimulatorTeamInput,
} from "../src/lib/simulator/types";

const argv = process.argv.slice(2);
const args = new Map<string, string>();
for (let i = 0; i < argv.length; i += 1) {
  const token = argv[i];
  if (!token.startsWith("--")) continue;
  const key = token.slice(2);
  const next = argv[i + 1];
  if (next && !next.startsWith("--")) {
    args.set(key, next);
    i += 1;
  } else {
    args.set(key, "true");
  }
}

function fail(message: string): never {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function requireArg(name: string): string {
  const value = args.get(name);
  if (!value) fail(`Missing required argument: --${name}`);
  return value;
}

function isValidDate(value: string) {
  return Number.isFinite(Date.parse(value));
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

const slateKey = requireArg("slate");
const slateDir = resolveSlatePackagePath(slateKey);

const slateJsonPath = path.join(slateDir, "slate.json");
const gamesJsonPath = path.join(slateDir, "games.json");
const teamInputsPath = path.join(slateDir, "team-inputs.json");
const playerInputsPath = path.join(slateDir, "player-inputs.json");
const settingsPath = path.join(slateDir, "settings.json");

const errors: string[] = [];
const warnings: string[] = [];

function addError(message: string) {
  errors.push(message);
}

function addWarning(message: string) {
  warnings.push(message);
}

async function ensureFiles() {
  try {
    const stats = await stat(slateDir);
    if (!stats.isDirectory()) {
      addError(`Slate path is not a directory: ${slateDir}`);
    }
  } catch (error) {
    addError(`Slate package not found at ${slateDir}`);
  }

  await Promise.all([
    stat(slateJsonPath).catch(() => addError("Missing slate.json")),
    stat(gamesJsonPath).catch(() => addError("Missing games.json")),
    stat(teamInputsPath).catch(() => addError("Missing team-inputs.json")),
    stat(playerInputsPath).catch(() => addError("Missing player-inputs.json")),
    stat(settingsPath).catch(() => addError("Missing settings.json")),
  ]);
}

function parseSlatePath(key: string) {
  const parts = key.split("/");
  if (parts.length < 4) return null;
  const [sport, season, weekPart] = parts;
  const weekMatch = /^week-(\d{2})$/.exec(weekPart);
  if (!weekMatch) return null;
  return {
    sport,
    season: Number(season),
    week: Number(weekMatch[1]),
  };
}

async function run() {
  await ensureFiles();
  if (errors.length > 0) {
    errors.forEach((error) => console.error(`Error: ${error}`));
    process.exit(1);
  }

  const slate = await loadJson<SimulatorSlate>(slateJsonPath).catch(() => {
    addError("slate.json is invalid JSON");
    return null;
  });
  const games = await loadJson<SimulatorGame[]>(gamesJsonPath).catch(() => {
    addError("games.json is invalid JSON");
    return null;
  });
  const teamInputs = await loadJson<SimulatorTeamInput[]>(teamInputsPath).catch(() => {
    addError("team-inputs.json is invalid JSON");
    return null;
  });
  const playerInputs = await loadJson<SimulatorPlayerInput[]>(playerInputsPath).catch(() => {
    addError("player-inputs.json is invalid JSON");
    return null;
  });
  const settings = await loadJson<SimulatorSettings>(settingsPath).catch(() => {
    addError("settings.json is invalid JSON");
    return null;
  });

  if (!slate || !games || !teamInputs || !playerInputs || !settings) {
    errors.forEach((error) => console.error(`Error: ${error}`));
    process.exit(1);
  }

  if (!slate.id) addError("slate.id is required");
  if (!slate.sport) addError("slate.sport is required");
  if (!isNumber(slate.season)) addError("slate.season must be a number");
  if (!isNumber(slate.week)) addError("slate.week must be a number");
  if (!slate.site) addError("slate.site is required");
  if (slate.gameType !== "classic" && slate.gameType !== "showdown") {
    addError("slate.gameType must be classic or showdown");
  }
  if (!slate.slateType) addError("slate.slateType is required");
  if (!slate.name) addError("slate.name is required");
  if (!isNumber(slate.salaryCap)) addError("slate.salaryCap must be a number");
  if (!isNumber(slate.rosterSize)) addError("slate.rosterSize must be a number");
  if (!slate.startTime || !isValidDate(slate.startTime)) {
    addError("slate.startTime must be a valid date string");
  }

  if (!Array.isArray(games) || games.length === 0) {
    addError("games.json must be a non-empty array");
  }

  const gameIdSet = new Set<string>();
  const gameMap = new Map<string, SimulatorGame>();
  const teamSet = new Set<string>();
  for (const [index, game] of games.entries()) {
    const label = `games[${index}]`;
    if (!game.id) addError(`${label}.id is required`);
    if (!game.slateId) addError(`${label}.slateId is required`);
    if (!game.awayTeam) addError(`${label}.awayTeam is required`);
    if (!game.homeTeam) addError(`${label}.homeTeam is required`);
    if (!game.gameLabel) addError(`${label}.gameLabel is required`);
    if (!game.spread) addError(`${label}.spread is required`);
    if (!isNumber(game.total)) addError(`${label}.total must be a number`);
    if (!game.startTime || !isValidDate(game.startTime)) {
      addError(`${label}.startTime must be a valid date string`);
    }
    if (game.slateId !== slate.id) {
      addError(`${label}.slateId does not match slate.id`);
    }
    if (game.awayTeam && game.homeTeam && game.awayTeam === game.homeTeam) {
      addError(`${label} awayTeam and homeTeam must differ`);
    }
    if (game.id) {
      if (gameIdSet.has(game.id)) addError(`Duplicate game id: ${game.id}`);
      gameIdSet.add(game.id);
      gameMap.set(game.id, game);
    }
    if (game.awayTeam) teamSet.add(game.awayTeam);
    if (game.homeTeam) teamSet.add(game.homeTeam);
  }

  if (!Array.isArray(teamInputs)) {
    addError("team-inputs.json must be an array");
  }

  const teamInputKeySet = new Set<string>();
  for (const [index, row] of teamInputs.entries()) {
    const label = `teamInputs[${index}]`;
    if (!row.slateId) addError(`${label}.slateId is required`);
    if (!row.gameId) addError(`${label}.gameId is required`);
    if (!row.team) addError(`${label}.team is required`);
    if (!isNumber(row.pointsScored)) addError(`${label}.pointsScored must be a number`);
    if (!isNumber(row.pace)) addError(`${label}.pace must be a number`);
    if (!isNumber(row.rushRate)) addError(`${label}.rushRate must be a number`);
    if (!isNumber(row.rushTdRatio)) addError(`${label}.rushTdRatio must be a number`);
    if (!isNumber(row.dstSalary)) addError(`${label}.dstSalary must be a number`);
    if (!isNumber(row.sackRate)) addError(`${label}.sackRate must be a number`);
    if (row.slateId !== slate.id) addError(`${label}.slateId does not match slate.id`);
    if (row.gameId && !gameMap.has(row.gameId)) {
      addError(`${label}.gameId does not exist in games.json`);
    }
    const game = row.gameId ? gameMap.get(row.gameId) : null;
    if (game && row.team && row.team !== game.awayTeam && row.team !== game.homeTeam) {
      addError(`${label}.team is not part of game ${row.gameId}`);
    }
    if (row.gameId && row.team) {
      const key = `${row.gameId}-${row.team}`;
      if (teamInputKeySet.has(key)) {
        addError(`Duplicate team input for game/team: ${key}`);
      }
      teamInputKeySet.add(key);
    }
    if (row.pace > 80 || row.pace < 40) {
      addWarning(`${label}.pace value looks unusual (${row.pace})`);
    }
  }

  for (const game of games) {
    if (!teamInputKeySet.has(`${game.id}-${game.awayTeam}`)) {
      addError(`Missing team input for ${game.awayTeam} in game ${game.id}`);
    }
    if (!teamInputKeySet.has(`${game.id}-${game.homeTeam}`)) {
      addError(`Missing team input for ${game.homeTeam} in game ${game.id}`);
    }
  }

  if (!Array.isArray(playerInputs)) {
    addError("player-inputs.json must be an array");
  }

  if (Array.isArray(playerInputs) && playerInputs.length === 0) {
    addWarning("player-inputs.json is empty");
  }

  const playerIdSet = new Set<string>();
  const allowedPositions = new Set(["QB", "RB", "WR", "TE", "DST", "K"]);
  const allowedStatuses = new Set(["active", "out", "questionable"]);

  for (const [index, player] of playerInputs.entries()) {
    const label = `playerInputs[${index}]`;
    if (!player.id) addError(`${label}.id is required`);
    if (!player.slateId) addError(`${label}.slateId is required`);
    if (!player.gameId) addError(`${label}.gameId is required`);
    if (!player.team) addError(`${label}.team is required`);
    if (!player.opponent) addError(`${label}.opponent is required`);
    if (!player.name) addError(`${label}.name is required`);
    if (!player.position) addError(`${label}.position is required`);
    if (!isNumber(player.salary)) addError(`${label}.salary must be a number`);
    if (!isNumber(player.projection)) addError(`${label}.projection must be a number`);
    if (!isNumber(player.ownership)) addError(`${label}.ownership must be a number`);
    if (!isNumber(player.rushMarketShare)) addError(`${label}.rushMarketShare must be a number`);
    if (!isNumber(player.rushTdMarketShare)) addError(`${label}.rushTdMarketShare must be a number`);
    if (!isNumber(player.receivingMarketShare)) addError(`${label}.receivingMarketShare must be a number`);
    if (!isNumber(player.receivingTdMarketShare)) addError(`${label}.receivingTdMarketShare must be a number`);
    if (!isNumber(player.catchRate)) addError(`${label}.catchRate must be a number`);
    if (!isNumber(player.passMarketShare)) addError(`${label}.passMarketShare must be a number`);
    if (!isNumber(player.intRate)) addError(`${label}.intRate must be a number`);
    if (!player.status || !allowedStatuses.has(player.status)) {
      addError(`${label}.status must be active, out, or questionable`);
    }
    if (player.slateId !== slate.id) addError(`${label}.slateId does not match slate.id`);
    if (player.position && !allowedPositions.has(player.position)) {
      addError(`${label}.position is not supported (${player.position})`);
    }
    if (player.id) {
      if (playerIdSet.has(player.id)) addError(`Duplicate player id: ${player.id}`);
      playerIdSet.add(player.id);
    }
    if (player.gameId && !gameMap.has(player.gameId)) {
      addError(`${label}.gameId does not exist in games.json`);
    }
    const game = player.gameId ? gameMap.get(player.gameId) : null;
    if (game && player.team && player.team !== game.awayTeam && player.team !== game.homeTeam) {
      addError(`${label}.team is not part of game ${player.gameId}`);
    }
    if (game && player.opponent) {
      const expectedOpponent = player.team === game.awayTeam ? game.homeTeam : game.awayTeam;
      if (player.opponent !== expectedOpponent) {
        addError(`${label}.opponent does not match game opponent (${expectedOpponent})`);
      }
    }
  }

  if (!settings.slateId) addError("settings.slateId is required");
  if (!isNumber(settings.lineupCount)) addError("settings.lineupCount must be a number");
  if (!isNumber(settings.fieldSize)) addError("settings.fieldSize must be a number");
  if (!isNumber(settings.simulationCount)) addError("settings.simulationCount must be a number");
  if (!isNumber(settings.salaryCap)) addError("settings.salaryCap must be a number");
  if (
    settings.payoutProfile &&
    !["topHeavy", "standard", "flat"].includes(settings.payoutProfile)
  ) {
    addError("settings.payoutProfile must be topHeavy, standard, or flat");
  }
  if (
    settings.gradingFieldMode &&
    !["retainedOnly", "expandedField"].includes(settings.gradingFieldMode)
  ) {
    addError("settings.gradingFieldMode must be retainedOnly or expandedField");
  }
  if (
    settings.gradingFieldSize !== null &&
    settings.gradingFieldSize !== undefined &&
    !isNumber(settings.gradingFieldSize)
  ) {
    addError("settings.gradingFieldSize must be a number");
  }
  if (
    settings.gradingFieldExtraLineupCount !== null &&
    settings.gradingFieldExtraLineupCount !== undefined &&
    !isNumber(settings.gradingFieldExtraLineupCount)
  ) {
    addError("settings.gradingFieldExtraLineupCount must be a number");
  }
  if (settings.minSalary !== null && settings.minSalary !== undefined && !isNumber(settings.minSalary)) {
    addError("settings.minSalary must be a number or null");
  }
  if (settings.maxSalary !== null && settings.maxSalary !== undefined && !isNumber(settings.maxSalary)) {
    addError("settings.maxSalary must be a number or null");
  }
  if (
    settings.minSumOwnership !== null &&
    settings.minSumOwnership !== undefined &&
    !isNumber(settings.minSumOwnership)
  ) {
    addError("settings.minSumOwnership must be a number or null");
  }
  if (
    settings.maxSumOwnership !== null &&
    settings.maxSumOwnership !== undefined &&
    !isNumber(settings.maxSumOwnership)
  ) {
    addError("settings.maxSumOwnership must be a number or null");
  }
  if (
    settings.minAvgOptimalRate !== null &&
    settings.minAvgOptimalRate !== undefined &&
    !isNumber(settings.minAvgOptimalRate)
  ) {
    addError("settings.minAvgOptimalRate must be a number or null");
  }
  if (
    settings.maxAvgOptimalRate !== null &&
    settings.maxAvgOptimalRate !== undefined &&
    !isNumber(settings.maxAvgOptimalRate)
  ) {
    addError("settings.maxAvgOptimalRate must be a number or null");
  }

  if (
    isNumber(settings.minSalary) &&
    isNumber(settings.maxSalary) &&
    settings.minSalary > settings.maxSalary
  ) {
    addError("settings.minSalary cannot exceed settings.maxSalary");
  }
  if (
    isNumber(settings.minSumOwnership) &&
    isNumber(settings.maxSumOwnership) &&
    settings.minSumOwnership > settings.maxSumOwnership
  ) {
    addError("settings.minSumOwnership cannot exceed settings.maxSumOwnership");
  }
  if (
    isNumber(settings.minAvgOptimalRate) &&
    isNumber(settings.maxAvgOptimalRate) &&
    settings.minAvgOptimalRate > settings.maxAvgOptimalRate
  ) {
    addError("settings.minAvgOptimalRate cannot exceed settings.maxAvgOptimalRate");
  }
  if (settings.slateId !== slate.id) addError("settings.slateId does not match slate.id");
  if (isNumber(settings.salaryCap) && isNumber(slate.salaryCap) && settings.salaryCap !== slate.salaryCap) {
    addError("settings.salaryCap does not match slate.salaryCap");
  }
  if (isNumber(settings.gradingFieldSize) && settings.gradingFieldSize <= 0) {
    addError("settings.gradingFieldSize must be greater than 0");
  }
  if (
    isNumber(settings.gradingFieldExtraLineupCount) &&
    (!Number.isInteger(settings.gradingFieldExtraLineupCount) || settings.gradingFieldExtraLineupCount < 0)
  ) {
    addError("settings.gradingFieldExtraLineupCount must be an integer 0 or greater");
  }

  const pathParts = parseSlatePath(slateKey);
  if (pathParts) {
    if (slate.sport && pathParts.sport !== slate.sport) {
      addError("Slate folder sport does not match slate.sport");
    }
    if (isNumber(slate.season) && pathParts.season !== slate.season) {
      addError("Slate folder season does not match slate.season");
    }
    if (isNumber(slate.week) && pathParts.week !== slate.week) {
      addError("Slate folder week does not match slate.week");
    }
  }

  for (const team of teamSet) {
    const exists = teamInputs.some((row) => row.team === team);
    if (!exists) {
      addError(`Team ${team} is missing a team-inputs row`);
    }
  }

  for (const player of playerInputs) {
    if (!teamSet.has(player.team)) {
      addError(`Player team ${player.team} is not in games.json`);
    }
    if (!teamSet.has(player.opponent)) {
      addError(`Player opponent ${player.opponent} is not in games.json`);
    }
  }

  if (errors.length > 0) {
    errors.forEach((error) => console.error(`Error: ${error}`));
    process.exit(1);
  }

  if (warnings.length > 0) {
    warnings.forEach((warning) => console.warn(`Warning: ${warning}`));
  }

  const positionBreakdown = playerInputs.reduce<Record<string, number>>((acc, player) => {
    acc[player.position] = (acc[player.position] || 0) + 1;
    return acc;
  }, {});

  console.log("Simulator slate validation passed.");
  console.log(`Slate ID: ${slate.id}`);
  console.log(`Slate key: ${slateKey}`);
  console.log(`Games: ${games.length}`);
  console.log(`Teams: ${teamSet.size}`);
  console.log(`Players: ${playerInputs.length}`);
  console.log("Position breakdown:");
  ["QB", "RB", "WR", "TE", "DST", "K"].forEach((pos) => {
    if (positionBreakdown[pos]) {
      console.log(`- ${pos}: ${positionBreakdown[pos]}`);
    }
  });
}

run().catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});
