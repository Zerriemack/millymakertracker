import type { APIRoute } from "astro";
import { stat, writeFile } from "fs/promises";
import path from "path";
import { resolveSlatePackagePath } from "../../../lib/simulator/paths";
import { loadJson } from "../../../lib/simulator/loadJson";
import type { SimulatorGame, SimulatorSlate, SimulatorTeamInput } from "../../../lib/simulator/types";

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

  const { slate, teamInputs } = body as { slate?: string; teamInputs?: SimulatorTeamInput[] };
  if (!slate) {
    return jsonResponse(400, { error: "Missing slate key." });
  }
  if (!Array.isArray(teamInputs)) {
    return jsonResponse(400, { error: "teamInputs must be an array." });
  }

  const slateDir = resolveSlatePackagePath(slate);
  const slatePath = path.join(slateDir, "slate.json");
  const gamesPath = path.join(slateDir, "games.json");
  const teamInputsPath = path.join(slateDir, "team-inputs.json");

  try {
    const stats = await stat(slateDir);
    if (!stats.isDirectory()) {
      return jsonResponse(400, { error: "Slate path is not a directory." });
    }
  } catch {
    return jsonResponse(404, { error: "Slate package not found." });
  }

  try {
    await stat(teamInputsPath);
  } catch {
    return jsonResponse(400, { error: "team-inputs.json is missing." });
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
  const teamSet = new Set<string>();
  for (const game of gamesJson) {
    gameMap.set(game.id, game);
    if (game.awayTeam) teamSet.add(game.awayTeam);
    if (game.homeTeam) teamSet.add(game.homeTeam);
  }

  const keySet = new Set<string>();
  for (const [index, row] of teamInputs.entries()) {
    const label = `teamInputs[${index}]`;
    if (!row.slateId) errors.push(`${label}.slateId is required`);
    if (!row.gameId) errors.push(`${label}.gameId is required`);
    if (!row.team) errors.push(`${label}.team is required`);
    if (!isNumber(row.pointsScored)) errors.push(`${label}.pointsScored must be numeric`);
    if (!isNumber(row.pace)) errors.push(`${label}.pace must be numeric`);
    if (!isNumber(row.rushRate)) errors.push(`${label}.rushRate must be numeric`);
    if (!isNumber(row.rushTdRatio)) errors.push(`${label}.rushTdRatio must be numeric`);
    if (!isNumber(row.dstSalary)) errors.push(`${label}.dstSalary must be numeric`);
    if (!isNumber(row.sackRate)) errors.push(`${label}.sackRate must be numeric`);
    if (row.slateId && row.slateId !== slateJson.id) {
      errors.push(`${label}.slateId does not match slate.id`);
    }

    if (row.gameId && !gameMap.has(row.gameId)) {
      errors.push(`${label}.gameId does not exist in games.json`);
    }

    const game = row.gameId ? gameMap.get(row.gameId) : null;
    if (game && row.team && row.team !== game.awayTeam && row.team !== game.homeTeam) {
      errors.push(`${label}.team is not part of game ${row.gameId}`);
    }

    if (row.gameId && row.team) {
      const key = `${row.gameId}-${row.team}`;
      if (keySet.has(key)) {
        errors.push(`Duplicate team input for game/team: ${key}`);
      }
      keySet.add(key);
    }
  }

  for (const game of gamesJson) {
    if (!keySet.has(`${game.id}-${game.awayTeam}`)) {
      errors.push(`Missing team input for ${game.awayTeam} in game ${game.id}`);
    }
    if (!keySet.has(`${game.id}-${game.homeTeam}`)) {
      errors.push(`Missing team input for ${game.homeTeam} in game ${game.id}`);
    }
  }

  if (errors.length > 0) {
    return jsonResponse(400, { error: "Validation failed.", details: errors });
  }

  await writeFile(teamInputsPath, `${JSON.stringify(teamInputs, null, 2)}\n`, "utf8");

  return jsonResponse(200, { ok: true, slate: slateJson.id, count: teamInputs.length });
};

export const ALL: APIRoute = async () => {
  return jsonResponse(405, { error: "Method not allowed." });
};
