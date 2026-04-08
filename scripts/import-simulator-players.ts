import { readFile, stat, writeFile } from "fs/promises";
import path from "path";
import { resolveSlatePackagePath } from "../src/lib/simulator/paths";
import { loadJson } from "../src/lib/simulator/loadJson";
import type { SimulatorGame, SimulatorPlayerInput, SimulatorSettings, SimulatorSlate, SimulatorTeamInput } from "../src/lib/simulator/types";

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

function parseNumber(value: string, label: string): number {
  const cleaned = value.replace(/%$/g, "").replace(/,/g, "").trim();
  const num = Number(cleaned);
  if (!Number.isFinite(num)) {
    fail(`Invalid number for ${label}: ${value}`);
  }
  return num;
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const slateKey = requireArg("slate");
const inputPath = requireArg("input");
const format = requireArg("format").toLowerCase();
const force = (args.get("force") || "false").toLowerCase() === "true";

if (format !== "csv" && format !== "json") {
  fail("--format must be either csv or json");
}

const inputAbsolutePath = path.isAbsolute(inputPath)
  ? inputPath
  : path.resolve(process.cwd(), inputPath);

const slateDir = resolveSlatePackagePath(slateKey);
const slateJsonPath = path.join(slateDir, "slate.json");
const gamesJsonPath = path.join(slateDir, "games.json");
const teamInputsPath = path.join(slateDir, "team-inputs.json");
const settingsPath = path.join(slateDir, "settings.json");
const playerInputsPath = path.join(slateDir, "player-inputs.json");

async function ensureSlatePackage() {
  try {
    const stats = await stat(slateDir);
    if (!stats.isDirectory()) {
      fail(`Slate path is not a directory: ${slateDir}`);
    }
  } catch (error) {
    fail(`Slate package not found at ${slateDir}`);
  }

  await Promise.all([
    stat(slateJsonPath).catch(() => fail("Missing slate.json")),
    stat(gamesJsonPath).catch(() => fail("Missing games.json")),
    stat(teamInputsPath).catch(() => fail("Missing team-inputs.json")),
    stat(settingsPath).catch(() => fail("Missing settings.json")),
  ]);

  try {
    await stat(playerInputsPath);
  } catch (error) {
    await writeFile(playerInputsPath, "[]\n", "utf8");
  }
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  result.push(current.trim());
  return result;
}

function parseCsv(content: string): Array<Record<string, string>> {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    fail("CSV file is empty");
  }

  const headers = parseCsvLine(lines[0]).map((header) =>
    header.trim().replace(/^\uFEFF/, "").toLowerCase()
  );
  if (headers.length === 0) {
    fail("CSV header row is missing or invalid");
  }

  return lines.slice(1).map((line, index) => {
    const values = parseCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, colIndex) => {
      row[header] = values[colIndex] ?? "";
    });
    return row;
  });
}

function parseJson(content: string): Array<Record<string, unknown>> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    fail("Invalid JSON input file");
  }

  if (Array.isArray(parsed)) {
    return parsed as Array<Record<string, unknown>>;
  }

  if (parsed && typeof parsed === "object" && Array.isArray((parsed as { players?: unknown }).players)) {
    return (parsed as { players: Array<Record<string, unknown>> }).players;
  }

  fail("JSON input must be an array or an object with a players array");
}

type RawPlayer = Record<string, unknown>;

function getString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function getRowValue(row: RawPlayer, keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return "";
}

function getOptionalNumber(value: unknown, defaultValue: number): number {
  if (value === null || value === undefined || value === "") return defaultValue;
  return parseNumber(String(value), "optional numeric field");
}

function normalizeStatus(value: string): SimulatorPlayerInput["status"] {
  const raw = value.trim().toLowerCase();
  if (!raw) return "active";
  if (["out", "o", "inactive"].includes(raw)) return "out";
  if (["questionable", "q", "doubtful", "injured"].includes(raw)) return "questionable";
  if (["active", "a", "probable", "healthy"].includes(raw)) return "active";
  return "active";
}

const positionDefaults: Record<string, Omit<SimulatorPlayerInput, "id" | "slateId" | "gameId" | "team" | "opponent" | "name" | "position" | "salary" | "projection" | "ownership" | "status">> = {
  QB: {
    rushMarketShare: 0,
    rushTdMarketShare: 0,
    receivingMarketShare: 0,
    receivingTdMarketShare: 0,
    catchRate: 0,
    passMarketShare: 100,
    intRate: 2.5,
  },
  RB: {
    rushMarketShare: 35,
    rushTdMarketShare: 40,
    receivingMarketShare: 8,
    receivingTdMarketShare: 8,
    catchRate: 78,
    passMarketShare: 0,
    intRate: 0,
  },
  WR: {
    rushMarketShare: 0,
    rushTdMarketShare: 0,
    receivingMarketShare: 18,
    receivingTdMarketShare: 18,
    catchRate: 65,
    passMarketShare: 0,
    intRate: 0,
  },
  TE: {
    rushMarketShare: 0,
    rushTdMarketShare: 0,
    receivingMarketShare: 14,
    receivingTdMarketShare: 14,
    catchRate: 72,
    passMarketShare: 0,
    intRate: 0,
  },
  DST: {
    rushMarketShare: 0,
    rushTdMarketShare: 0,
    receivingMarketShare: 0,
    receivingTdMarketShare: 0,
    catchRate: 0,
    passMarketShare: 0,
    intRate: 0,
  },
  K: {
    rushMarketShare: 0,
    rushTdMarketShare: 0,
    receivingMarketShare: 0,
    receivingTdMarketShare: 0,
    catchRate: 0,
    passMarketShare: 0,
    intRate: 0,
  },
};

function normalizePosition(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (!normalized) fail("Position is required");
  if (!positionDefaults[normalized]) {
    fail(`Unsupported position: ${normalized}`);
  }
  return normalized;
}

function buildPlayerId(slateId: string, name: string, counts: Map<string, number>) {
  const base = `${slateId}-${slugify(name)}`;
  const count = (counts.get(base) || 0) + 1;
  counts.set(base, count);
  if (count === 1) return base;
  return `${base}-${count}`;
}

function mapGameByTeam(
  team: string,
  opponent: string | null,
  games: SimulatorGame[]
) {
  const teamUpper = team.toUpperCase();
  const possible = games.filter(
    (game) => game.awayTeam === teamUpper || game.homeTeam === teamUpper
  );

  if (possible.length === 0) {
    fail(`Team ${teamUpper} does not exist in this slate`);
  }

  if (possible.length === 1) {
    const game = possible[0];
    const expectedOpponent = game.awayTeam === teamUpper ? game.homeTeam : game.awayTeam;
    if (opponent && opponent.toUpperCase() !== expectedOpponent) {
      fail(`Opponent ${opponent} does not match game for team ${teamUpper}`);
    }
    return { game, opponent: opponent?.toUpperCase() ?? expectedOpponent };
  }

  if (!opponent) {
    fail(`Team ${teamUpper} appears in multiple games; opponent is required.`);
  }

  const opponentUpper = opponent.toUpperCase();
  const match = possible.find(
    (game) =>
      (game.awayTeam === teamUpper && game.homeTeam === opponentUpper) ||
      (game.homeTeam === teamUpper && game.awayTeam === opponentUpper)
  );

  if (!match) {
    fail(`Opponent ${opponentUpper} does not match any game for team ${teamUpper}`);
  }

  return { game: match, opponent: opponentUpper };
}

async function run() {
  await ensureSlatePackage();

  const slate = await loadJson<SimulatorSlate>(slateJsonPath);
  const games = await loadJson<SimulatorGame[]>(gamesJsonPath);
  await loadJson<SimulatorTeamInput[]>(teamInputsPath);
  await loadJson<SimulatorSettings>(settingsPath);

  if (!Array.isArray(games) || games.length === 0) {
    fail("games.json is empty or invalid");
  }

  const existingPlayers = await loadJson<SimulatorPlayerInput[]>(playerInputsPath).catch(() => []);
  if (!Array.isArray(existingPlayers)) {
    fail("player-inputs.json is invalid");
  }
  if (existingPlayers.length > 0 && !force) {
    fail("player-inputs.json already has data. Use --force true to overwrite.");
  }

  const rawContent = await readFile(inputAbsolutePath, "utf8");
  const rawPlayers = format === "csv" ? parseCsv(rawContent) : parseJson(rawContent);

  if (rawPlayers.length === 0) {
    fail("Input file contains no player rows");
  }

  const idCounts = new Map<string, number>();
  const normalizedPlayers: SimulatorPlayerInput[] = rawPlayers.map((row, index) => {
    const name = getRowValue(row, ["name", "Name"]);
    const team = getRowValue(row, ["team", "Team"]);
    const positionRaw = getRowValue(row, ["position", "Position", "pos", "Pos"]);
    const salaryRaw = getRowValue(row, ["salary", "Salary", "sal", "Sal"]);
    const projectionRaw = getRowValue(row, ["projection", "Projection", "proj", "Proj"]);
    const ownershipRaw = getRowValue(row, [
      "ownership",
      "Ownership",
      "own",
      "ownpct",
      "own_pct",
      "ownpercent",
      "own_percent",
      "own%",
      "ownpct%",
    ]);
    const opponentRaw = getRowValue(row, ["opponent", "Opponent", "opp", "Opp"]);
    const statusRaw = getRowValue(row, ["status", "Status"]);

    if (!name) fail(`Row ${index + 1} is missing name`);
    if (!team) fail(`Row ${index + 1} is missing team`);
    if (!positionRaw) fail(`Row ${index + 1} is missing position`);
    if (!salaryRaw) fail(`Row ${index + 1} is missing salary`);
    if (!projectionRaw) fail(`Row ${index + 1} is missing projection`);
    if (!ownershipRaw) fail(`Row ${index + 1} is missing ownership`);

    const position = normalizePosition(positionRaw);
    const salary = parseNumber(salaryRaw, `salary for ${name}`);
    const projection = parseNumber(projectionRaw, `projection for ${name}`);
    const ownership = parseNumber(ownershipRaw, `ownership for ${name}`);

    const { game, opponent } = mapGameByTeam(team, opponentRaw || null, games);
    const defaults = positionDefaults[position];

    return {
      id: buildPlayerId(slate.id, name, idCounts),
      slateId: slate.id,
      gameId: game.id,
      team: team.toUpperCase(),
      opponent: opponent.toUpperCase(),
      name,
      position,
      salary,
      projection,
      ownership,
      rushMarketShare: getOptionalNumber(
        getRowValue(row, ["rushMarketShare", "rush_market_share"]),
        defaults.rushMarketShare
      ),
      rushTdMarketShare: getOptionalNumber(
        getRowValue(row, ["rushTdMarketShare", "rush_td_market_share"]),
        defaults.rushTdMarketShare
      ),
      receivingMarketShare: getOptionalNumber(
        getRowValue(row, ["receivingMarketShare", "receiving_market_share"]),
        defaults.receivingMarketShare
      ),
      receivingTdMarketShare: getOptionalNumber(
        getRowValue(row, ["receivingTdMarketShare", "receiving_td_market_share"]),
        defaults.receivingTdMarketShare
      ),
      catchRate: getOptionalNumber(getRowValue(row, ["catchRate", "catch_rate"]), defaults.catchRate),
      passMarketShare: getOptionalNumber(
        getRowValue(row, ["passMarketShare", "pass_market_share"]),
        defaults.passMarketShare
      ),
      intRate: getOptionalNumber(getRowValue(row, ["intRate", "int_rate"]), defaults.intRate),
      status: normalizeStatus(statusRaw),
    };
  });

  const idSet = new Set<string>();
  for (const player of normalizedPlayers) {
    if (idSet.has(player.id)) {
      fail(`Duplicate player id generated: ${player.id}`);
    }
    idSet.add(player.id);
  }

  await writeFile(playerInputsPath, `${JSON.stringify(normalizedPlayers, null, 2)}\n`, "utf8");

  const breakdown = normalizedPlayers.reduce<Record<string, number>>((acc, player) => {
    acc[player.position] = (acc[player.position] || 0) + 1;
    return acc;
  }, {});

  console.log("Simulator player import complete.");
  console.log(`Slate key: ${slateKey}`);
  console.log(`Slate ID: ${slate.id}`);
  console.log(`Input file: ${inputAbsolutePath}`);
  console.log(`Players imported: ${normalizedPlayers.length}`);
  console.log(`Written: ${playerInputsPath}`);
  console.log(`Example URL: /simulator?slate=${slateKey}&tab=inputs`);
  console.log("Position breakdown:");
  ["QB", "RB", "WR", "TE", "DST", "K"].forEach((pos) => {
    if (breakdown[pos]) {
      console.log(`- ${pos}: ${breakdown[pos]}`);
    }
  });
}

run().catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});
