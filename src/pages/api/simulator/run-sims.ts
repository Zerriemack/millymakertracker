import type { APIRoute } from "astro";
import { stat, writeFile } from "fs/promises";
import path from "path";
import { resolveSlatePackagePath } from "../../../lib/simulator/paths";
import { loadJson } from "../../../lib/simulator/loadJson";
import type {
  SimulatorGame,
  SimulatorPlayerInput,
  SimulatorSettings,
  SimulatorSlate,
  SimulatorTeamInput,
} from "../../../lib/simulator/types";

type SimPlayer = SimulatorPlayerInput & { simScore: number };
type SimLineup = {
  slots: SimPlayer[];
  salaryUsed: number;
  sumOwnership: number;
  simTotal: number;
};
type RankedSimLineup = SimLineup & { lineupKey: string };
type LineupAggregate = {
  slots: SimPlayer[];
  salaryUsed: number;
  sumOwnership: number;
  frequencyCount: number;
  totalSimTotal: number;
  maxSimTotal: number;
};

function jsonResponse(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function randomNormal() {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getVolatility(position: string) {
  switch (position) {
    case "QB":
      return 4.5;
    case "RB":
      return 6;
    case "WR":
      return 6.2;
    case "TE":
      return 5.2;
    case "DST":
      return 4;
    case "K":
      return 3.2;
    default:
      return 5;
  }
}

function computeTeamMultiplier(teamInputs: SimulatorTeamInput | undefined, position: string) {
  if (!teamInputs) return 1;
  const pointsMult = teamInputs.pointsScored ? teamInputs.pointsScored / 24 : 1;
  const paceMult = teamInputs.pace ? teamInputs.pace / 65 : 1;
  const rushAdj =
    position === "RB" || position === "QB" ? (teamInputs.rushRate - 0.45) * 0.25 : 0;
  return clamp(pointsMult * paceMult * (1 + rushAdj), 0.7, 1.3);
}

function buildLineupKey(players: Pick<SimPlayer, "id">[]) {
  return players
    .map((player) => player.id)
    .sort()
    .join("|");
}

function compareRankedLineups(a: RankedSimLineup, b: RankedSimLineup) {
  if (a.simTotal !== b.simTotal) return b.simTotal - a.simTotal;
  if (a.salaryUsed !== b.salaryUsed) return b.salaryUsed - a.salaryUsed;
  return a.lineupKey.localeCompare(b.lineupKey);
}

function isWorseRankedLineup(a: RankedSimLineup, b: RankedSimLineup) {
  if (a.simTotal !== b.simTotal) return a.simTotal < b.simTotal;
  if (a.salaryUsed !== b.salaryUsed) return a.salaryUsed < b.salaryUsed;
  return a.lineupKey > b.lineupKey;
}

function insertTopRankedLineup(
  lineups: RankedSimLineup[],
  lineup: RankedSimLineup,
  limit: number
) {
  if (limit <= 0) return;
  const existingIndex = lineups.findIndex((entry) => entry.lineupKey === lineup.lineupKey);
  if (existingIndex >= 0) {
    if (compareRankedLineups(lineup, lineups[existingIndex]) < 0) {
      lineups[existingIndex] = lineup;
    }
    return;
  }
  if (lineups.length < limit) {
    lineups.push(lineup);
    return;
  }

  let worstIndex = 0;
  for (let i = 1; i < lineups.length; i += 1) {
    if (isWorseRankedLineup(lineups[i], lineups[worstIndex])) {
      worstIndex = i;
    }
  }

  if (isWorseRankedLineup(lineups[worstIndex], lineup)) {
    lineups[worstIndex] = lineup;
  }
}

function buildTopLineups(players: SimPlayer[], salaryCap: number, limit: number): RankedSimLineup[] {
  const byPosition = (pos: string) => players.filter((p) => p.position === pos);
  const qbs = byPosition("QB");
  const rbs = byPosition("RB");
  const wrs = byPosition("WR");
  const tes = byPosition("TE");
  const dsts = byPosition("DST");

  if (qbs.length < 1 || rbs.length < 2 || wrs.length < 3 || tes.length < 1 || dsts.length < 1) {
    return [];
  }

  const rbPairs: Array<{ ids: Set<string>; salary: number; score: number; players: SimPlayer[] }> = [];
  for (let i = 0; i < rbs.length; i += 1) {
    for (let j = i + 1; j < rbs.length; j += 1) {
      const salary = rbs[i].salary + rbs[j].salary;
      const score = rbs[i].simScore + rbs[j].simScore;
      rbPairs.push({
        ids: new Set([rbs[i].id, rbs[j].id]),
        salary,
        score,
        players: [rbs[i], rbs[j]],
      });
    }
  }

  const wrTriples: Array<{ ids: Set<string>; salary: number; score: number; players: SimPlayer[] }> = [];
  for (let i = 0; i < wrs.length; i += 1) {
    for (let j = i + 1; j < wrs.length; j += 1) {
      for (let k = j + 1; k < wrs.length; k += 1) {
        const salary = wrs[i].salary + wrs[j].salary + wrs[k].salary;
        const score = wrs[i].simScore + wrs[j].simScore + wrs[k].simScore;
        wrTriples.push({
          ids: new Set([wrs[i].id, wrs[j].id, wrs[k].id]),
          salary,
          score,
          players: [wrs[i], wrs[j], wrs[k]],
        });
      }
    }
  }

  const flexPool = players.filter((p) => p.position === "RB" || p.position === "WR" || p.position === "TE");
  const flexCandidatesPerBuild = limit <= 1 ? 1 : limit <= 10 ? 2 : 3;
  const bestLineups: RankedSimLineup[] = [];

  for (const qb of qbs) {
    for (const dst of dsts) {
      for (const te of tes) {
        for (const rbPair of rbPairs) {
          if (rbPair.ids.has(te.id) || rbPair.ids.has(qb.id) || rbPair.ids.has(dst.id)) continue;
          for (const wrTriple of wrTriples) {
            if (wrTriple.ids.has(te.id) || wrTriple.ids.has(qb.id) || wrTriple.ids.has(dst.id)) continue;
            if ([...rbPair.ids].some((id) => wrTriple.ids.has(id))) continue;

            const baseSalary =
              qb.salary +
              dst.salary +
              te.salary +
              rbPair.salary +
              wrTriple.salary;
            if (baseSalary > salaryCap) continue;

            const remainingSalary = salaryCap - baseSalary;
            const flexOptions: SimPlayer[] = [];
            for (const flex of flexPool) {
              if (flex.id === qb.id || flex.id === dst.id || flex.id === te.id) continue;
              if (rbPair.ids.has(flex.id)) continue;
              if (wrTriple.ids.has(flex.id)) continue;
              if (flex.salary > remainingSalary) continue;
              if (flexOptions.length < flexCandidatesPerBuild) {
                flexOptions.push(flex);
                flexOptions.sort((a, b) => b.simScore - a.simScore || b.salary - a.salary || a.id.localeCompare(b.id));
                continue;
              }
              const worstFlex = flexOptions[flexOptions.length - 1];
              if (
                flex.simScore > worstFlex.simScore ||
                (flex.simScore === worstFlex.simScore &&
                  (flex.salary > worstFlex.salary ||
                    (flex.salary === worstFlex.salary && flex.id.localeCompare(worstFlex.id) < 0)))
              ) {
                flexOptions[flexOptions.length - 1] = flex;
                flexOptions.sort((a, b) => b.simScore - a.simScore || b.salary - a.salary || a.id.localeCompare(b.id));
              }
            }

            for (const flex of flexOptions) {
              const slots = [
                qb,
                ...rbPair.players,
                ...wrTriple.players,
                te,
                flex,
                dst,
              ];
              const salaryUsed = slots.reduce((sum, p) => sum + p.salary, 0);
              const sumOwnership = slots.reduce((sum, p) => sum + p.ownership, 0);
              insertTopRankedLineup(bestLineups, {
                lineupKey: buildLineupKey(slots),
                slots,
                salaryUsed,
                sumOwnership,
                simTotal:
                  qb.simScore +
                  dst.simScore +
                  te.simScore +
                  rbPair.score +
                  wrTriple.score +
                  flex.simScore,
              }, limit);
            }
          }
        }
      }
    }
  }

  return bestLineups.sort(compareRankedLineups);
}

function upsertLineupAggregate(
  lineupStats: Map<string, LineupAggregate>,
  lineup: RankedSimLineup
) {
  const existing = lineupStats.get(lineup.lineupKey);
  if (existing) {
    existing.frequencyCount += 1;
    existing.totalSimTotal += lineup.simTotal;
    if (lineup.simTotal > existing.maxSimTotal) existing.maxSimTotal = lineup.simTotal;
    return;
  }

  lineupStats.set(lineup.lineupKey, {
    slots: lineup.slots,
    salaryUsed: lineup.salaryUsed,
    sumOwnership: lineup.sumOwnership,
    frequencyCount: 1,
    totalSimTotal: lineup.simTotal,
    maxSimTotal: lineup.simTotal,
  });
}

function buildContestRank(rank: number, universeSize: number, fieldSize: number) {
  if (fieldSize <= universeSize) return rank;
  return Math.max(1, Math.ceil(((rank - 0.5) / universeSize) * fieldSize));
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

  const { slate } = body as { slate?: string };
  if (!slate) {
    return jsonResponse(400, { error: "Missing slate key." });
  }

  const slateDir = resolveSlatePackagePath(slate);
  const slatePath = path.join(slateDir, "slate.json");
  const gamesPath = path.join(slateDir, "games.json");
  const teamInputsPath = path.join(slateDir, "team-inputs.json");
  const playerInputsPath = path.join(slateDir, "player-inputs.json");
  const settingsPath = path.join(slateDir, "settings.json");
  const resultsPath = path.join(slateDir, "results.json");

  try {
    const stats = await stat(slateDir);
    if (!stats.isDirectory()) {
      return jsonResponse(400, { error: "Slate path is not a directory." });
    }
  } catch {
    return jsonResponse(404, { error: "Slate package not found." });
  }

  let slateJson: SimulatorSlate;
  let gamesJson: SimulatorGame[];
  let teamInputs: SimulatorTeamInput[];
  let playerInputs: SimulatorPlayerInput[];
  let settings: SimulatorSettings;
  try {
    slateJson = await loadJson<SimulatorSlate>(slatePath);
    gamesJson = await loadJson<SimulatorGame[]>(gamesPath);
    teamInputs = await loadJson<SimulatorTeamInput[]>(teamInputsPath);
    playerInputs = await loadJson<SimulatorPlayerInput[]>(playerInputsPath);
    settings = await loadJson<SimulatorSettings>(settingsPath);
  } catch {
    return jsonResponse(400, { error: "Slate package files are invalid." });
  }

  if (!Array.isArray(playerInputs) || playerInputs.length === 0) {
    return jsonResponse(400, { error: "player-inputs.json is empty." });
  }

  if (slateJson.site !== "draftkings" || slateJson.gameType !== "classic") {
    return jsonResponse(400, { error: "Version 1 supports DraftKings classic only." });
  }

  const salaryCap = settings.salaryCap || slateJson.salaryCap;
  if (!salaryCap) {
    return jsonResponse(400, { error: "Salary cap is missing from settings." });
  }
  if (slateJson.rosterSize && slateJson.rosterSize !== 9) {
    return jsonResponse(400, { error: "Version 1 supports 9-player DraftKings classic only." });
  }

  const requiredPositions = ["QB", "RB", "WR", "TE", "DST"];
  for (const pos of requiredPositions) {
    if (!playerInputs.some((p) => p.position === pos)) {
      return jsonResponse(400, { error: `Missing required position: ${pos}` });
    }
  }

  const teamInputMap = new Map<string, SimulatorTeamInput>();
  teamInputs.forEach((row) => teamInputMap.set(row.team, row));

  const simulationCount = settings.simulationCount || 0;
  if (!simulationCount || simulationCount <= 0) {
    return jsonResponse(400, { error: "simulationCount must be greater than 0." });
  }
  const lineupCount = settings.lineupCount || 0;
  const fieldSize = settings.fieldSize || 0;
  if (!fieldSize || fieldSize <= 0) {
    return jsonResponse(400, { error: "fieldSize must be greater than 0." });
  }
  const gradingFieldMode = settings.gradingFieldMode ?? "expandedField";
  if (!["retainedOnly", "expandedField"].includes(gradingFieldMode)) {
    return jsonResponse(400, { error: "gradingFieldMode must be retainedOnly or expandedField." });
  }
  const gradingFieldSize = settings.gradingFieldSize ?? fieldSize;
  if (!gradingFieldSize || gradingFieldSize <= 0) {
    return jsonResponse(400, { error: "gradingFieldSize must be greater than 0." });
  }
  const gradingFieldExtraLineupCount = settings.gradingFieldExtraLineupCount ?? Math.max(lineupCount, 300);
  if (!Number.isInteger(gradingFieldExtraLineupCount) || gradingFieldExtraLineupCount < 0) {
    return jsonResponse(400, { error: "gradingFieldExtraLineupCount must be an integer 0 or greater." });
  }
  const targetGradingUniverseSize = Math.max(lineupCount + gradingFieldExtraLineupCount, lineupCount, 1);
  const candidateLineupLimitPerSim =
    gradingFieldMode === "expandedField"
      ? Math.min(32, Math.max(4, Math.ceil(targetGradingUniverseSize / Math.max(1, Math.min(simulationCount, 50)))))
      : 1;

  const normalizeOptional = (value: unknown, label: string) => {
    if (value === null || value === undefined) return null;
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error(`${label} must be a number or null.`);
    }
    return value;
  };

  const playerStats = new Map<
    string,
    {
      optimalLineupCount: number;
      totalSimScore: number;
      maxSimScore: number;
    }
  >();
  const playerIds = playerInputs.map((player) => player.id);
  const playerIndexMap = new Map<string, number>();
  playerIds.forEach((id, index) => playerIndexMap.set(id, index));
  const scoreMatrix = playerIds.map(() => new Float64Array(simulationCount));
  playerInputs.forEach((player) => {
    playerStats.set(player.id, {
      optimalLineupCount: 0,
      totalSimScore: 0,
      maxSimScore: 0,
    });
  });

  const retainedLineupStats = new Map<string, LineupAggregate>();
  const gradingUniverseStats = new Map<string, LineupAggregate>();

  for (let sim = 0; sim < simulationCount; sim += 1) {
    const simPlayers: SimPlayer[] = playerInputs.map((player) => {
      const teamInput = teamInputMap.get(player.team);
      const multiplier = computeTeamMultiplier(teamInput, player.position);
      const mean = player.projection * multiplier;
      const variance = getVolatility(player.position);
      const simScore = Math.max(0, mean + randomNormal() * variance);
      const stats = playerStats.get(player.id);
      if (stats) {
        stats.totalSimScore += simScore;
        if (simScore > stats.maxSimScore) stats.maxSimScore = simScore;
      }
      const idx = playerIndexMap.get(player.id);
      if (idx !== undefined) {
        scoreMatrix[idx][sim] = simScore;
      }
      return { ...player, simScore };
    });

    const simLineups = buildTopLineups(simPlayers, salaryCap, candidateLineupLimitPerSim);
    const optimalLineup = simLineups[0];
    if (!optimalLineup) {
      return jsonResponse(400, { error: "Unable to build a legal lineup with current player pool." });
    }
    optimalLineup.slots.forEach((player) => {
      const stats = playerStats.get(player.id);
      if (stats) stats.optimalLineupCount += 1;
    });
    upsertLineupAggregate(retainedLineupStats, optimalLineup);

    for (const simLineup of simLineups) {
      upsertLineupAggregate(gradingUniverseStats, simLineup);
    }
  }

  const resultsPlayers = playerInputs.map((player) => {
    const stats = playerStats.get(player.id)!;
    return {
      id: player.id,
      name: player.name,
      team: player.team,
      position: player.position,
      salary: player.salary,
      projection: player.projection,
      ownership: player.ownership,
      optimalLineupCount: stats.optimalLineupCount,
      optimalSimRate: (stats.optimalLineupCount / simulationCount) * 100,
      optimalLeverage: (stats.optimalLineupCount / simulationCount) * 100 - player.ownership,
      averageSimScore: stats.totalSimScore / simulationCount,
      maxSimScore: stats.maxSimScore,
    };
  });

  const optimalRateMap = new Map<string, number>();
  resultsPlayers.forEach((player) => {
    optimalRateMap.set(player.id, player.optimalSimRate);
  });

  const toResultsLineups = (lineupEntries: Array<[string, LineupAggregate]>) =>
    lineupEntries.map(([lineupKey, lineup]) => {
      const avgOptimalRate =
        lineup.slots.reduce((sum, player) => sum + (optimalRateMap.get(player.id) || 0), 0) /
        lineup.slots.length;
      return {
        lineupKey,
        players: lineup.slots.map((player) => ({
          id: player.id,
          name: player.name,
          team: player.team,
          position: player.position,
          salary: player.salary,
          ownership: player.ownership,
        })),
        salaryUsed: lineup.salaryUsed,
        sumOwnership: lineup.sumOwnership,
        frequencyCount: lineup.frequencyCount,
        frequencyRate: (lineup.frequencyCount / simulationCount) * 100,
        averageSimTotal: lineup.totalSimTotal / lineup.frequencyCount,
        maxSimTotal: lineup.maxSimTotal,
        averageOptimalRate: avgOptimalRate,
        passedFilters: true,
      };
    });

  const allLineups = toResultsLineups(Array.from(retainedLineupStats.entries()));
  const allGradingCandidates = toResultsLineups(Array.from(gradingUniverseStats.entries()));

  const sortLineups = <
    T extends { frequencyCount: number; averageSimTotal: number; maxSimTotal: number; lineupKey: string }
  >(lineups: T[]) =>
    lineups
      .slice()
      .sort(
        (a, b) =>
          b.frequencyCount - a.frequencyCount ||
          b.averageSimTotal - a.averageSimTotal ||
          b.maxSimTotal - a.maxSimTotal ||
          a.lineupKey.localeCompare(b.lineupKey)
      );

  const sortedLineups = sortLineups(allLineups);
  const sortedGradingCandidates = sortLineups(allGradingCandidates);

  const retainedLineups = lineupCount > 0 ? sortedLineups.slice(0, lineupCount) : sortedLineups;

  let minSalary: number | null = null;
  let maxSalary: number | null = null;
  let minSumOwnership: number | null = null;
  let maxSumOwnership: number | null = null;
  let minAvgOptimalRate: number | null = null;
  let maxAvgOptimalRate: number | null = null;
  try {
    minSalary = normalizeOptional(settings.minSalary, "minSalary");
    maxSalary = normalizeOptional(settings.maxSalary, "maxSalary");
    minSumOwnership = normalizeOptional(settings.minSumOwnership, "minSumOwnership");
    maxSumOwnership = normalizeOptional(settings.maxSumOwnership, "maxSumOwnership");
    minAvgOptimalRate = normalizeOptional(settings.minAvgOptimalRate, "minAvgOptimalRate");
    maxAvgOptimalRate = normalizeOptional(settings.maxAvgOptimalRate, "maxAvgOptimalRate");
  } catch (error) {
    return jsonResponse(400, { error: error.message || "Invalid settings filters." });
  }
  if (minSalary !== null && maxSalary !== null && minSalary > maxSalary) {
    return jsonResponse(400, { error: "minSalary cannot exceed maxSalary." });
  }
  if (minSumOwnership !== null && maxSumOwnership !== null && minSumOwnership > maxSumOwnership) {
    return jsonResponse(400, { error: "minSumOwnership cannot exceed maxSumOwnership." });
  }
  if (minAvgOptimalRate !== null && maxAvgOptimalRate !== null && minAvgOptimalRate > maxAvgOptimalRate) {
    return jsonResponse(400, { error: "minAvgOptimalRate cannot exceed maxAvgOptimalRate." });
  }

  const filteredLineups = retainedLineups.map((lineup) => {
    const salaryPass =
      (minSalary === null || lineup.salaryUsed >= minSalary) &&
      (maxSalary === null || lineup.salaryUsed <= maxSalary);
    const ownershipPass =
      (minSumOwnership === null || lineup.sumOwnership >= minSumOwnership) &&
      (maxSumOwnership === null || lineup.sumOwnership <= maxSumOwnership);
    const optimalRatePass =
      (minAvgOptimalRate === null || lineup.averageOptimalRate >= minAvgOptimalRate) &&
      (maxAvgOptimalRate === null || lineup.averageOptimalRate <= maxAvgOptimalRate);

    return {
      ...lineup,
      passedFilters: salaryPass && ownershipPass && optimalRatePass,
    };
  });

  const filteredCount = filteredLineups.filter((lineup) => lineup.passedFilters).length;
  const retainedLineupKeySet = new Set(retainedLineups.map((lineup) => lineup.lineupKey));
  const extraGradingLineups =
    gradingFieldMode === "expandedField"
      ? sortedGradingCandidates
          .filter((lineup) => !retainedLineupKeySet.has(lineup.lineupKey))
          .slice(0, gradingFieldExtraLineupCount)
      : [];
  const gradingUniverseLineups =
    gradingFieldMode === "expandedField" ? [...retainedLineups, ...extraGradingLineups] : retainedLineups;

  const retainedLineupKeys = retainedLineups.map((lineup) => lineup.lineupKey);
  const gradingUniverseLineupIndices = gradingUniverseLineups.map((lineup) =>
    lineup.players.map((player) => playerIndexMap.get(player.id) ?? -1)
  );
  const gradingUniverseLineupKeys = gradingUniverseLineups.map((lineup) => lineup.lineupKey);

  const payoutProfile = settings.payoutProfile ?? "standard";
  const payoutWeights =
    payoutProfile === "topHeavy"
      ? { topPointOne: 10, topOne: 4, itm: 1 }
      : payoutProfile === "flat"
        ? { topPointOne: 2, topOne: 1.5, itm: 1 }
        : { topPointOne: 6, topOne: 3, itm: 1 };

  const contestFieldSize = gradingFieldMode === "expandedField" ? gradingFieldSize : fieldSize;
  const topPointOneCutoff = Math.max(1, Math.floor(contestFieldSize * 0.001));
  const topOneCutoff = Math.max(1, Math.floor(contestFieldSize * 0.01));
  const itmCutoff = Math.max(1, Math.floor(contestFieldSize * 0.2));

  const lineupGradeMap = new Map<
    string,
    {
      totalSimTotal: number;
      maxSimTotal: number;
      topPointOneCount: number;
      topOneCount: number;
      itmCount: number;
      evTotal: number;
    }
  >();

  retainedLineupKeys.forEach((key) =>
    lineupGradeMap.set(key, {
      totalSimTotal: 0,
      maxSimTotal: 0,
      topPointOneCount: 0,
      topOneCount: 0,
      itmCount: 0,
      evTotal: 0,
    })
  );

  for (let sim = 0; sim < simulationCount; sim += 1) {
    const totals: Array<{ key: string; total: number }> = [];
    gradingUniverseLineupIndices.forEach((indices, idx) => {
      let total = 0;
      for (const playerIdx of indices) {
        if (playerIdx >= 0) total += scoreMatrix[playerIdx][sim];
      }
      const key = gradingUniverseLineupKeys[idx];
      totals.push({ key, total });
      const grade = retainedLineupKeySet.has(key) ? lineupGradeMap.get(key) : null;
      if (grade) {
        grade.totalSimTotal += total;
        if (total > grade.maxSimTotal) grade.maxSimTotal = total;
      }
    });

    totals.sort((a, b) => b.total - a.total);
    const gradingUniverseSize = totals.length;
    const topPointOneRank = gradingFieldMode === "expandedField" ? topPointOneCutoff : Math.min(topPointOneCutoff, gradingUniverseSize);
    const topOneRank = gradingFieldMode === "expandedField" ? topOneCutoff : Math.min(topOneCutoff, gradingUniverseSize);
    const itmRank = gradingFieldMode === "expandedField" ? itmCutoff : Math.min(itmCutoff, gradingUniverseSize);

    totals.forEach((entry, index) => {
      const grade = retainedLineupKeySet.has(entry.key) ? lineupGradeMap.get(entry.key) : null;
      if (!grade) return;
      const rank = index + 1;
      const contestRank =
        gradingFieldMode === "expandedField"
          ? buildContestRank(rank, gradingUniverseSize, contestFieldSize)
          : rank;
      if (contestRank <= topPointOneRank) {
        grade.topPointOneCount += 1;
        grade.evTotal += payoutWeights.topPointOne;
      } else if (contestRank <= topOneRank) {
        grade.topOneCount += 1;
        grade.evTotal += payoutWeights.topOne;
      } else if (contestRank <= itmRank) {
        grade.itmCount += 1;
        grade.evTotal += payoutWeights.itm;
      }
    });
  }

  const gradedLineups = filteredLineups.map((lineup) => {
    const grade = lineupGradeMap.get(lineup.lineupKey);
    if (!grade) return lineup;
    return {
      ...lineup,
      averageSimTotal: grade.totalSimTotal / simulationCount,
      maxSimTotal: grade.maxSimTotal,
      topPointOnePctRate: (grade.topPointOneCount / simulationCount) * 100,
      topOnePctRate: (grade.topOneCount / simulationCount) * 100,
      itmRate: (grade.itmCount / simulationCount) * 100,
      evScore: grade.evTotal / simulationCount,
    };
  });

  const retainedCounts = new Map<string, number>();
  const filteredCounts = new Map<string, number>();
  retainedLineups.forEach((lineup) => {
    lineup.players.forEach((player) => {
      retainedCounts.set(player.id, (retainedCounts.get(player.id) || 0) + 1);
    });
  });
  filteredLineups.forEach((lineup) => {
    if (!lineup.passedFilters) return;
    lineup.players.forEach((player) => {
      filteredCounts.set(player.id, (filteredCounts.get(player.id) || 0) + 1);
    });
  });

  const retainedDenom = retainedLineups.length;
  const filteredDenom = filteredCount;

  const filteredPool = gradedLineups.filter((lineup) => lineup.passedFilters);
  const averageFilteredEv =
    filteredPool.length > 0
      ? filteredPool.reduce((sum, lineup) => sum + (lineup.evScore ?? 0), 0) / filteredPool.length
      : 0;

  const resultsPlayersWithExposure = resultsPlayers.map((player) => {
    const retainedLineupCount = retainedCounts.get(player.id) || 0;
    const filteredLineupCount = filteredCounts.get(player.id) || 0;
    const plusEvScore = filteredPool.reduce((sum, lineup) => {
      if (!lineup.players.some((p) => p.id === player.id)) return sum;
      const diff = (lineup.evScore ?? 0) - averageFilteredEv;
      const weight = lineup.frequencyRate / 100;
      return sum + (diff > 0 ? diff * weight : 0);
    }, 0);
    const minusEvScore = filteredPool.reduce((sum, lineup) => {
      if (!lineup.players.some((p) => p.id === player.id)) return sum;
      const diff = averageFilteredEv - (lineup.evScore ?? 0);
      const weight = lineup.frequencyRate / 100;
      return sum + (diff > 0 ? diff * weight : 0);
    }, 0);
    return {
      ...player,
      retainedLineupCount,
      retainedExposureRate: retainedDenom > 0 ? (retainedLineupCount / retainedDenom) * 100 : 0,
      filteredLineupCount,
      filteredExposureRate: filteredDenom > 0 ? (filteredLineupCount / filteredDenom) * 100 : 0,
      plusEvScore,
      minusEvScore,
    };
  });

  const resultsPayload = {
    slateId: slateJson.id,
    generatedAt: new Date().toISOString(),
    simulationCount,
    settingsSnapshot: {
      lineupCount: settings.lineupCount,
      fieldSize: settings.fieldSize,
      simulationCount: settings.simulationCount,
      salaryCap,
      payoutProfile,
      gradingFieldMode,
      gradingFieldSize,
      gradingFieldExtraLineupCount,
      minSalary,
      maxSalary,
      minSumOwnership,
      maxSumOwnership,
      minAvgOptimalRate,
      maxAvgOptimalRate,
    },
    players: resultsPlayersWithExposure,
    lineups: gradedLineups,
    poolSummary: {
      distinctLineupCount: allLineups.length,
      retainedLineupCount: retainedLineups.length,
      filteredLineupCount: filteredCount,
    },
    gradingSummary: {
      gradingFieldMode,
      gradingFieldSize: contestFieldSize,
      gradingUniverseSize: gradingUniverseLineups.length,
      retainedPoolSize: retainedLineups.length,
      filteredPoolSize: filteredCount,
      gradingFieldExtraLineupCount,
      payoutProfile,
      topPointOneCutoff,
      topOneCutoff,
      itmCutoff,
    },
  };

  await writeFile(resultsPath, `${JSON.stringify(resultsPayload, null, 2)}\n`, "utf8");

  return jsonResponse(200, {
    ok: true,
    slate,
    slateId: slateJson.id,
    simulationCount,
    resultsPath,
    supportedGameType: "draftkings-classic",
    playerCount: playerInputs.length,
  });
};

export const ALL: APIRoute = async () => {
  return jsonResponse(405, { error: "Method not allowed." });
};
