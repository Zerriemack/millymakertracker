import type { APIRoute } from "astro";
import { stat, writeFile } from "fs/promises";
import path from "path";
import { resolveSlatePackagePath } from "../../../lib/simulator/paths";
import { loadJson } from "../../../lib/simulator/loadJson";
import type { SimulatorGame, SimulatorPlayerInput, SimulatorSlate } from "../../../lib/simulator/types";

function jsonResponse(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export const POST: APIRoute = async ({ request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, { error: "Invalid JSON body." });
  }

  if (!body || typeof body !== "object") {
    return jsonResponse(400, { error: "Payload must be an object." });
  }

  const { slate, playerInputs } = body as { slate?: string; playerInputs?: SimulatorPlayerInput[] };
  if (!slate) {
    return jsonResponse(400, { error: "Missing slate key." });
  }
  if (!Array.isArray(playerInputs)) {
    return jsonResponse(400, { error: "playerInputs must be an array." });
  }

  const slateDir = resolveSlatePackagePath(slate);
  const slatePath = path.join(slateDir, "slate.json");
  const gamesPath = path.join(slateDir, "games.json");
  const playerInputsPath = path.join(slateDir, "player-inputs.json");

  try {
    const stats = await stat(slateDir);
    if (!stats.isDirectory()) {
      return jsonResponse(400, { error: "Slate path is not a directory." });
    }
  } catch {
    return jsonResponse(404, { error: "Slate package not found." });
  }

  try {
    await stat(playerInputsPath);
  } catch {
    return jsonResponse(400, { error: "player-inputs.json is missing." });
  }

  let slateJson: SimulatorSlate;
  let gamesJson: SimulatorGame[];
  try {
    slateJson = await loadJson<SimulatorSlate>(slatePath);
    gamesJson = await loadJson<SimulatorGame[]>(gamesPath);
  } catch {
    return jsonResponse(400, { error: "Slate package files are invalid." });
  }

  if (!Array.isArray(gamesJson) || gamesJson.length === 0) {
    return jsonResponse(400, { error: "games.json must be a non-empty array." });
  }

  const errors: string[] = [];
  const gameMap = new Map<string, SimulatorGame>();
  const playerIdSet = new Set<string>();
  const allowedPositions = new Set(["QB", "RB", "WR", "TE", "DST", "K"]);
  const allowedStatuses = new Set(["active", "out", "questionable"]);

  for (const game of gamesJson) {
    gameMap.set(game.id, game);
  }

  for (const [index, player] of playerInputs.entries()) {
    const label = `playerInputs[${index}]`;
    if (!player.id) errors.push(`${label}.id is required`);
    if (!player.slateId) errors.push(`${label}.slateId is required`);
    if (!player.gameId) errors.push(`${label}.gameId is required`);
    if (!player.team) errors.push(`${label}.team is required`);
    if (!player.opponent) errors.push(`${label}.opponent is required`);
    if (!player.name) errors.push(`${label}.name is required`);
    if (!player.position) errors.push(`${label}.position is required`);
    if (!isNumber(player.salary)) errors.push(`${label}.salary must be numeric`);
    if (!isNumber(player.projection)) errors.push(`${label}.projection must be numeric`);
    if (!isNumber(player.ownership)) errors.push(`${label}.ownership must be numeric`);
    if (!isNumber(player.rushMarketShare)) errors.push(`${label}.rushMarketShare must be numeric`);
    if (!isNumber(player.rushTdMarketShare)) errors.push(`${label}.rushTdMarketShare must be numeric`);
    if (!isNumber(player.receivingMarketShare)) errors.push(`${label}.receivingMarketShare must be numeric`);
    if (!isNumber(player.receivingTdMarketShare)) errors.push(`${label}.receivingTdMarketShare must be numeric`);
    if (!isNumber(player.catchRate)) errors.push(`${label}.catchRate must be numeric`);
    if (!isNumber(player.passMarketShare)) errors.push(`${label}.passMarketShare must be numeric`);
    if (!isNumber(player.intRate)) errors.push(`${label}.intRate must be numeric`);
    if (!player.status || !allowedStatuses.has(player.status)) {
      errors.push(`${label}.status must be active, out, or questionable`);
    }
    if (player.slateId && player.slateId !== slateJson.id) {
      errors.push(`${label}.slateId does not match slate.id`);
    }
    if (player.position && !allowedPositions.has(player.position)) {
      errors.push(`${label}.position is not supported (${player.position})`);
    }
    if (player.id) {
      if (playerIdSet.has(player.id)) errors.push(`Duplicate player id: ${player.id}`);
      playerIdSet.add(player.id);
    }
    if (player.gameId && !gameMap.has(player.gameId)) {
      errors.push(`${label}.gameId does not exist in games.json`);
    }
    const game = player.gameId ? gameMap.get(player.gameId) : null;
    if (game && player.team && player.team !== game.awayTeam && player.team !== game.homeTeam) {
      errors.push(`${label}.team is not part of game ${player.gameId}`);
    }
    if (game && player.opponent && player.team) {
      const expectedOpponent = player.team === game.awayTeam ? game.homeTeam : game.awayTeam;
      if (player.opponent !== expectedOpponent) {
        errors.push(`${label}.opponent does not match game opponent (${expectedOpponent})`);
      }
    }
  }

  if (errors.length > 0) {
    return jsonResponse(400, { error: "Validation failed.", details: errors });
  }

  await writeFile(playerInputsPath, `${JSON.stringify(playerInputs, null, 2)}\n`, "utf8");

  return jsonResponse(200, { ok: true, slate: slateJson.id, count: playerInputs.length });
};

export const ALL: APIRoute = async () => {
  return jsonResponse(405, { error: "Method not allowed." });
};
