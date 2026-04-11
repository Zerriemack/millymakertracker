import type { APIRoute } from "astro";
import { stat, writeFile } from "fs/promises";
import path from "path";
import { resolveSlatePackagePath } from "../../../lib/simulator/paths";
import { loadJson } from "../../../lib/simulator/loadJson";
import type { SimulatorSettings, SimulatorSlate } from "../../../lib/simulator/types";

const allowFileWrites = import.meta.env.DEV;

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

  const { slate, settings } = body as { slate?: string; settings?: SimulatorSettings };
  if (!slate) return jsonResponse(400, { error: "Missing slate key." });
  if (!settings) return jsonResponse(400, { error: "Missing settings payload." });

  const slateDir = resolveSlatePackagePath(slate);
  const slatePath = path.join(slateDir, "slate.json");
  const settingsPath = path.join(slateDir, "settings.json");

  try {
    const stats = await stat(slateDir);
    if (!stats.isDirectory()) return jsonResponse(400, { error: "Slate path is not a directory." });
  } catch {
    return jsonResponse(404, { error: "Slate package not found." });
  }

  try {
    await stat(settingsPath);
  } catch {
    return jsonResponse(400, { error: "settings.json is missing." });
  }

  let slateJson: SimulatorSlate;
  try {
    slateJson = await loadJson<SimulatorSlate>(slatePath);
  } catch {
    return jsonResponse(400, { error: "slate.json is invalid." });
  }

  const errors: string[] = [];
  if (!settings.slateId) errors.push("settings.slateId is required");
  if (settings.slateId && settings.slateId !== slateJson.id) {
    errors.push("settings.slateId does not match slate.id");
  }
  if (!isNumber(settings.lineupCount)) errors.push("settings.lineupCount must be numeric");
  if (!isNumber(settings.fieldSize)) errors.push("settings.fieldSize must be numeric");
  if (!isNumber(settings.simulationCount)) errors.push("settings.simulationCount must be numeric");
  if (isNumber(settings.fieldSize) && settings.fieldSize > 500000) {
    errors.push("settings.fieldSize must be 500000 or smaller");
  }
  if (settings.payoutProfile && !["topHeavy", "standard", "cash"].includes(settings.payoutProfile)) {
    errors.push("settings.payoutProfile must be topHeavy, standard, or cash");
  }

  const normalized: SimulatorSettings = {
    slateId: slateJson.id,
    lineupCount: settings.lineupCount,
    fieldSize: settings.fieldSize,
    simulationCount: settings.simulationCount,
    payoutProfile: settings.payoutProfile ?? "standard",
  }

  if (errors.length > 0) {
    return jsonResponse(400, { error: "Validation failed.", details: errors });
  }

  if (allowFileWrites) {
    try {
      await writeFile(settingsPath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
    } catch (error) {
      return jsonResponse(500, {
        error: "Failed to write settings.json.",
        details: [error instanceof Error ? error.message : String(error)],
      });
    }
  }

  return jsonResponse(200, { ok: true, slate: slateJson.id, wroteSettings: allowFileWrites });
};

export const ALL: APIRoute = async () => {
  return jsonResponse(405, { error: "Method not allowed." });
};
