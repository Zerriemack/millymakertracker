import type { APIRoute } from "astro";
import { stat, writeFile } from "fs/promises";
import path from "path";
import { resolveSlatePackagePath } from "../../../lib/simulator/paths";
import { loadJson } from "../../../lib/simulator/loadJson";
import type { SimulatorSettings, SimulatorSlate } from "../../../lib/simulator/types";

function jsonResponse(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeOptionalNumber(value: unknown) {
  if (value === null || value === undefined) return null;
  if (value === "") return null;
  if (!isNumber(value)) return null;
  return value;
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
  if (!isNumber(settings.salaryCap)) errors.push("settings.salaryCap must be numeric");
  if (isNumber(settings.salaryCap) && settings.salaryCap !== slateJson.salaryCap) {
    errors.push("settings.salaryCap must match slate.salaryCap");
  }
  if (settings.payoutProfile && !["topHeavy", "standard", "flat"].includes(settings.payoutProfile)) {
    errors.push("settings.payoutProfile must be topHeavy, standard, or flat");
  }
  if (
    settings.gradingFieldMode &&
    !["retainedOnly", "expandedField"].includes(settings.gradingFieldMode)
  ) {
    errors.push("settings.gradingFieldMode must be retainedOnly or expandedField");
  }
  if (
    settings.gradingFieldSize !== undefined &&
    settings.gradingFieldSize !== null &&
    !isNumber(settings.gradingFieldSize)
  ) {
    errors.push("settings.gradingFieldSize must be numeric");
  }
  if (
    settings.gradingFieldExtraLineupCount !== undefined &&
    settings.gradingFieldExtraLineupCount !== null &&
    !isNumber(settings.gradingFieldExtraLineupCount)
  ) {
    errors.push("settings.gradingFieldExtraLineupCount must be numeric");
  }

  const normalized: SimulatorSettings = {
    slateId: slateJson.id,
    lineupCount: settings.lineupCount,
    fieldSize: settings.fieldSize,
    simulationCount: settings.simulationCount,
    salaryCap: settings.salaryCap,
    payoutProfile: settings.payoutProfile ?? "standard",
    gradingFieldMode: settings.gradingFieldMode ?? "expandedField",
    gradingFieldSize: settings.gradingFieldSize ?? settings.fieldSize,
    gradingFieldExtraLineupCount: settings.gradingFieldExtraLineupCount ?? Math.max(settings.lineupCount, 300),
    minSalary: normalizeOptionalNumber(settings.minSalary),
    maxSalary: normalizeOptionalNumber(settings.maxSalary),
    minSumOwnership: normalizeOptionalNumber(settings.minSumOwnership),
    maxSumOwnership: normalizeOptionalNumber(settings.maxSumOwnership),
    minAvgOptimalRate: normalizeOptionalNumber(settings.minAvgOptimalRate),
    maxAvgOptimalRate: normalizeOptionalNumber(settings.maxAvgOptimalRate),
  };

  if (
    isNumber(normalized.minSalary) &&
    isNumber(normalized.maxSalary) &&
    normalized.minSalary > normalized.maxSalary
  ) {
    errors.push("minSalary cannot exceed maxSalary");
  }
  if (
    isNumber(normalized.minSumOwnership) &&
    isNumber(normalized.maxSumOwnership) &&
    normalized.minSumOwnership > normalized.maxSumOwnership
  ) {
    errors.push("minSumOwnership cannot exceed maxSumOwnership");
  }
  if (
    isNumber(normalized.minAvgOptimalRate) &&
    isNumber(normalized.maxAvgOptimalRate) &&
    normalized.minAvgOptimalRate > normalized.maxAvgOptimalRate
  ) {
    errors.push("minAvgOptimalRate cannot exceed maxAvgOptimalRate");
  }
  if (!isNumber(normalized.gradingFieldSize) || normalized.gradingFieldSize <= 0) {
    errors.push("gradingFieldSize must be greater than 0");
  }
  if (
    !isNumber(normalized.gradingFieldExtraLineupCount) ||
    !Number.isInteger(normalized.gradingFieldExtraLineupCount) ||
    normalized.gradingFieldExtraLineupCount < 0
  ) {
    errors.push("gradingFieldExtraLineupCount must be an integer 0 or greater");
  }

  if (errors.length > 0) {
    return jsonResponse(400, { error: "Validation failed.", details: errors });
  }

  await writeFile(settingsPath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");

  return jsonResponse(200, { ok: true, slate: slateJson.id });
};

export const ALL: APIRoute = async () => {
  return jsonResponse(405, { error: "Method not allowed." });
};
