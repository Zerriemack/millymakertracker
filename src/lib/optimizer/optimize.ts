import type {
  OptimizeRequest,
  OptimizerConstraints,
  OptimizerExposure,
  OptimizerLineup,
  OptimizerPlayer,
  OptimizerResponse,
  PlayerInput,
  StackRule,
  ValidationError,
  ValidationResult,
} from "./types";

const FLEX_POSITIONS = new Set(["RB", "WR", "TE"]);
const FLEX_NO_TE_POSITIONS = new Set(["RB", "WR"]);
const SKILL_POSITIONS = new Set(["RB", "WR", "TE"]);
const ROSTER_SLOTS = ["QB", "RB", "RB", "WR", "WR", "WR", "TE", "FLEX", "DST"] as const;
const DEFAULT_CONSTRAINTS: OptimizerConstraints = {
  qb_stack: false,
  game_stack: false,
  avoid_opposing_defense: false,
  avoid_te_in_flex: false,
  one_skill_player_per_team: false,
};

export class GenerateLineupError extends Error {
  code: string;

  constructor(message: string, code = "INFEASIBLE_LINEUP") {
    super(message);
    this.code = code;
  }
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const toNumberOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
};

const ensureNoExtraKeys = (
  data: Record<string, unknown>,
  allowed: string[],
  errors: ValidationError[],
  prefix: string
) => {
  const allowedSet = new Set(allowed);
  Object.keys(data).forEach((key) => {
    if (!allowedSet.has(key)) {
      errors.push({ field: `${prefix}.${key}`, message: "extra fields are not permitted" });
    }
  });
};

const validatePlayer = (value: unknown, index: number, errors: ValidationError[]): PlayerInput | null => {
  if (!isObject(value)) {
    errors.push({ field: `players[${index}]`, message: "must be an object" });
    return null;
  }

  ensureNoExtraKeys(
    value,
    ["id", "first_name", "last_name", "positions", "team", "opponent", "game_id", "salary", "fppg"],
    errors,
    `players[${index}]`
  );

  const id = isNonEmptyString(value.id) ? value.id.trim() : null;
  const firstName = isNonEmptyString(value.first_name) ? value.first_name.trim() : null;
  const lastName = isNonEmptyString(value.last_name) ? value.last_name.trim() : null;
  const team = isNonEmptyString(value.team) ? value.team.trim() : null;
  const opponent =
    value.opponent === undefined || value.opponent === null
      ? null
      : isNonEmptyString(value.opponent)
        ? value.opponent.trim()
        : null;
  const gameId =
    value.game_id === undefined || value.game_id === null
      ? null
      : isNonEmptyString(value.game_id)
        ? value.game_id.trim()
        : null;
  const positionsRaw = Array.isArray(value.positions) ? value.positions : null;
  const salary = typeof value.salary === "number" ? value.salary : null;
  const fppg = typeof value.fppg === "number" ? value.fppg : null;

  if (!id) errors.push({ field: `players[${index}].id`, message: "must be a non-empty string" });
  if (!firstName)
    errors.push({ field: `players[${index}].first_name`, message: "must be a non-empty string" });
  if (!lastName)
    errors.push({ field: `players[${index}].last_name`, message: "must be a non-empty string" });
  if (!team) errors.push({ field: `players[${index}].team`, message: "must be a non-empty string" });
  if (value.opponent !== undefined && value.opponent !== null && !opponent) {
    errors.push({ field: `players[${index}].opponent`, message: "must be a non-empty string" });
  }
  if (value.game_id !== undefined && value.game_id !== null && !gameId) {
    errors.push({ field: `players[${index}].game_id`, message: "must be a non-empty string" });
  }

  if (!positionsRaw) {
    errors.push({ field: `players[${index}].positions`, message: "must be a non-empty list" });
  }

  const positions = positionsRaw
    ? positionsRaw
        .filter((pos) => typeof pos === "string")
        .map((pos) => pos.trim())
        .filter((pos) => pos.length > 0)
    : [];

  if (!positions.length) {
    errors.push({ field: `players[${index}].positions`, message: "must contain at least one entry" });
  }

  if (salary === null || !Number.isFinite(salary) || salary < 0) {
    errors.push({ field: `players[${index}].salary`, message: "must be a number >= 0" });
  }

  if (fppg === null || !Number.isFinite(fppg) || fppg < 0) {
    errors.push({ field: `players[${index}].fppg`, message: "must be a number >= 0" });
  }

  if (!id || !firstName || !lastName || !team || !positions.length || salary === null || fppg === null) {
    return null;
  }

  return {
    id,
    first_name: firstName,
    last_name: lastName,
    positions,
    team,
    opponent,
    game_id: gameId,
    salary,
    fppg,
  };
};

const validateStack = (value: unknown, index: number, errors: ValidationError[]): StackRule | null => {
  if (!isObject(value)) {
    errors.push({ field: `stacks[${index}]`, message: "must be an object" });
    return null;
  }

  ensureNoExtraKeys(value, ["type", "team", "positions", "for_positions", "count"], errors, `stacks[${index}]`);

  const type =
    value.type === undefined
      ? "team"
      : value.type === "team" || value.type === "qb_stack" || value.type === "game_stack"
        ? value.type
        : null;
  const team = value.team === undefined || value.team === null ? null : isNonEmptyString(value.team) ? value.team.trim() : null;
  const positionsRaw = Array.isArray(value.positions) ? value.positions : [];
  const positions = positionsRaw
    .filter((pos) => typeof pos === "string")
    .map((pos) => pos.trim())
    .filter((pos) => pos.length > 0);
  const forPositionsRaw = Array.isArray(value.for_positions) ? value.for_positions : [];
  const forPositions = forPositionsRaw
    .filter((pos) => typeof pos === "string")
    .map((pos) => pos.trim())
    .filter((pos) => pos.length > 0);
  const count = typeof value.count === "number" && Number.isFinite(value.count) ? value.count : 0;

  if (value.type !== undefined && type === null) {
    errors.push({ field: `stacks[${index}].type`, message: "must be one of: team, qb_stack, game_stack" });
  }

  if (value.team !== undefined && value.team !== null && !team) {
    errors.push({ field: `stacks[${index}].team`, message: "must be a non-empty string" });
  }

  if (count < 0) {
    errors.push({ field: `stacks[${index}].count`, message: "must be >= 0" });
  }

  return { type: type ?? "team", team, positions, for_positions: forPositions, count };
};

const validateConstraints = (value: unknown, errors: ValidationError[]): OptimizerConstraints => {
  if (value === undefined) {
    return { ...DEFAULT_CONSTRAINTS };
  }

  if (!isObject(value)) {
    errors.push({ field: "constraints", message: "must be an object" });
    return { ...DEFAULT_CONSTRAINTS };
  }

  ensureNoExtraKeys(
    value,
    [
      "qb_stack",
      "game_stack",
      "avoid_opposing_defense",
      "avoid_te_in_flex",
      "one_skill_player_per_team",
    ],
    errors,
    "constraints"
  );

  const readBoolean = (key: keyof OptimizerConstraints): boolean => {
    const raw = value[key];
    if (raw === undefined) return DEFAULT_CONSTRAINTS[key];
    if (typeof raw !== "boolean") {
      errors.push({ field: `constraints.${key}`, message: "must be a boolean" });
      return DEFAULT_CONSTRAINTS[key];
    }
    return raw;
  };

  return {
    qb_stack: readBoolean("qb_stack"),
    game_stack: readBoolean("game_stack"),
    avoid_opposing_defense: readBoolean("avoid_opposing_defense"),
    avoid_te_in_flex: readBoolean("avoid_te_in_flex"),
    one_skill_player_per_team: readBoolean("one_skill_player_per_team"),
  };
};

export const validateOptimizeRequest = (input: unknown): ValidationResult<OptimizeRequest> => {
  const errors: ValidationError[] = [];

  if (!isObject(input)) {
    return { ok: false, errors: [{ field: "body", message: "must be an object" }] };
  }

  ensureNoExtraKeys(
    input,
    [
      "players",
      "lineup_count",
      "min_salary",
      "max_salary",
      "max_repeating_players",
      "locked_player_ids",
      "excluded_player_ids",
      "team_limit",
      "randomness",
      "stacks",
      "constraints",
    ],
    errors,
    "body"
  );

  if (!Array.isArray(input.players) || input.players.length === 0) {
    errors.push({ field: "players", message: "must contain at least one player" });
  }

  const players: PlayerInput[] = Array.isArray(input.players)
    ? input.players
        .map((player, index) => validatePlayer(player, index, errors))
        .filter((player): player is PlayerInput => !!player)
    : [];

  const lineupCount =
    typeof input.lineup_count === "number" && Number.isFinite(input.lineup_count)
      ? input.lineup_count
      : 1;

  if (lineupCount < 1) {
    errors.push({ field: "lineup_count", message: "must be >= 1" });
  }

  const minSalary = toNumberOrNull(input.min_salary);
  if (input.min_salary !== undefined && minSalary !== null && minSalary < 0) {
    errors.push({ field: "min_salary", message: "must be >= 0" });
  }

  const maxSalary = toNumberOrNull(input.max_salary);
  if (input.max_salary !== undefined && maxSalary !== null && maxSalary < 0) {
    errors.push({ field: "max_salary", message: "must be >= 0" });
  }

  if (minSalary !== null && maxSalary !== null && minSalary > maxSalary) {
    errors.push({ field: "min_salary", message: "min_salary cannot be greater than max_salary" });
  }

  const maxRepeatingPlayers = toNumberOrNull(input.max_repeating_players);
  if (input.max_repeating_players !== undefined && maxRepeatingPlayers !== null && maxRepeatingPlayers < 0) {
    errors.push({ field: "max_repeating_players", message: "must be >= 0" });
  }

  const teamLimit = toNumberOrNull(input.team_limit);
  if (input.team_limit !== undefined && teamLimit !== null && teamLimit < 0) {
    errors.push({ field: "team_limit", message: "must be >= 0" });
  }

  const randomness = toNumberOrNull(input.randomness);
  if (input.randomness !== undefined && randomness !== null && randomness < 0) {
    errors.push({ field: "randomness", message: "must be >= 0" });
  }

  const lockedPlayerIds = Array.isArray(input.locked_player_ids)
    ? input.locked_player_ids.filter((id) => isNonEmptyString(id)).map((id) => id.trim())
    : [];
  const excludedPlayerIds = Array.isArray(input.excluded_player_ids)
    ? input.excluded_player_ids.filter((id) => isNonEmptyString(id)).map((id) => id.trim())
    : [];

  if (input.locked_player_ids !== undefined && !Array.isArray(input.locked_player_ids)) {
    errors.push({ field: "locked_player_ids", message: "must be a list" });
  }

  if (input.excluded_player_ids !== undefined && !Array.isArray(input.excluded_player_ids)) {
    errors.push({ field: "excluded_player_ids", message: "must be a list" });
  }

  const stacksRaw = Array.isArray(input.stacks) ? input.stacks : [];
  if (input.stacks !== undefined && !Array.isArray(input.stacks)) {
    errors.push({ field: "stacks", message: "must be a list" });
  }

  const stacks: StackRule[] = stacksRaw
    .map((stack, index) => validateStack(stack, index, errors))
    .filter((stack): stack is StackRule => !!stack);
  const constraints = validateConstraints(input.constraints, errors);

  const playerIds = new Set(players.map((player) => player.id));
  if (playerIds.size !== players.length) {
    errors.push({ field: "players", message: "player ids must be unique" });
  }

  const lockedSet = new Set(lockedPlayerIds);
  const excludedSet = new Set(excludedPlayerIds);
  const overlap = [...lockedSet].filter((id) => excludedSet.has(id));
  if (overlap.length) {
    errors.push({ field: "locked_player_ids", message: "locked_player_ids and excluded_player_ids cannot overlap" });
  }

  const missingLocked = lockedPlayerIds.filter((id) => !playerIds.has(id));
  const missingExcluded = excludedPlayerIds.filter((id) => !playerIds.has(id));
  if (missingLocked.length || missingExcluded.length) {
    const missing = [...new Set([...missingLocked, ...missingExcluded])];
    errors.push({ field: "locked_player_ids", message: `locked/excluded player ids not found: ${missing.join(", ")}` });
  }

  if (errors.length) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      players,
      lineup_count: lineupCount,
      min_salary: minSalary,
      max_salary: maxSalary,
      max_repeating_players: maxRepeatingPlayers,
      locked_player_ids: lockedPlayerIds,
      excluded_player_ids: excludedPlayerIds,
      team_limit: teamLimit,
      randomness,
      stacks,
      constraints,
    },
  };
};

type InternalPlayer = PlayerInput & {
  name: string;
  score: number;
};

type AssignedPlayer = {
  player: InternalPlayer;
  slot: string;
};

const assignLockedPlayers = (
  lockedPlayers: InternalPlayer[],
  slots: string[],
  constraints: OptimizerConstraints
): { locked: AssignedPlayer[]; remainingSlots: string[] } => {
  if (!lockedPlayers.length) {
    return { locked: [], remainingSlots: [...slots] };
  }

  const sortedLocked = [...lockedPlayers].sort(
    (a, b) => a.positions.length - b.positions.length
  );

  const backtrack = (
    index: number,
    availableSlots: string[],
    assigned: AssignedPlayer[]
  ): { locked: AssignedPlayer[]; remainingSlots: string[] } | null => {
    if (index >= sortedLocked.length) {
      return { locked: assigned, remainingSlots: availableSlots };
    }

    const player = sortedLocked[index];
    const possibleSlots = availableSlots.filter((slot) => isPlayerEligibleForSlot(player, slot, constraints));

    for (const slot of possibleSlots) {
      const nextSlots = [...availableSlots];
      const slotIndex = nextSlots.indexOf(slot);
      nextSlots.splice(slotIndex, 1);
      const result = backtrack(index + 1, nextSlots, [...assigned, { player, slot }]);
      if (result) {
        return result;
      }
    }

    return null;
  };

  const result = backtrack(0, [...slots], []);
  if (!result) {
    throw new GenerateLineupError("Locked players cannot fit into the roster configuration.");
  }

  return result;
};

const buildLineupPlayers = (players: InternalPlayer[]): OptimizerPlayer[] =>
  players.map((player) => ({
    id: player.id,
    name: player.name,
    team: player.team,
    positions: player.positions,
    salary: player.salary,
    fppg: player.fppg,
  }));

const isPlayerEligibleForSlot = (
  player: InternalPlayer,
  slot: string,
  constraints: OptimizerConstraints
): boolean => {
  if (slot === "FLEX") {
    const allowed = constraints.avoid_te_in_flex ? FLEX_NO_TE_POSITIONS : FLEX_POSITIONS;
    return player.positions.some((pos) => allowed.has(pos));
  }
  return player.positions.includes(slot);
};

const isSkillPlayer = (player: InternalPlayer): boolean =>
  player.positions.some((pos) => SKILL_POSITIONS.has(pos));

const matchesAnyPosition = (player: InternalPlayer, positions?: string[]): boolean => {
  if (!positions?.length) return true;
  return player.positions.some((pos) => positions.includes(pos));
};

const getPlayersFromAssignments = (assigned: AssignedPlayer[]): InternalPlayer[] =>
  assigned.map(({ player }) => player);

const normalizeStacks = (
  stacks: StackRule[],
  constraints: OptimizerConstraints
): StackRule[] => {
  const normalized = [...stacks];
  const hasType = (type: StackRule["type"]) => normalized.some((stack) => stack.type === type);

  if (constraints.qb_stack && !hasType("qb_stack")) {
    normalized.push({
      type: "qb_stack",
      for_positions: ["QB"],
      positions: ["RB", "WR", "TE"],
      count: 1,
    });
  }

  if (constraints.game_stack && !hasType("game_stack")) {
    normalized.push({
      type: "game_stack",
      for_positions: ["QB"],
      positions: ["RB", "WR", "TE"],
      count: 1,
    });
  }

  return normalized;
};

const satisfiesStacks = (players: InternalPlayer[], stacks: StackRule[]): boolean => {
  if (!stacks.length) return true;
  for (const stack of stacks) {
    if (stack.count <= 0) continue;

    if (stack.type === "qb_stack") {
      const keyPositions = stack.for_positions?.length ? stack.for_positions : ["QB"];
      const qbs = players.filter((player) => matchesAnyPosition(player, keyPositions));
      if (
        qbs.some((qb) =>
          players.filter(
            (player) =>
              player.id !== qb.id &&
              player.team === qb.team &&
              matchesAnyPosition(player, stack.positions)
          ).length < stack.count
        )
      ) {
        return false;
      }
      continue;
    }

    if (stack.type === "game_stack") {
      const keyPositions = stack.for_positions?.length ? stack.for_positions : ["QB"];
      const qbs = players.filter((player) => matchesAnyPosition(player, keyPositions));
      if (
        qbs.some((qb) => {
          if (!qb.opponent) return true;
          return (
            players.filter(
              (player) =>
                player.team === qb.opponent &&
                matchesAnyPosition(player, stack.positions)
            ).length < stack.count
          );
        })
      ) {
        return false;
      }
      continue;
    }

    if (!stack.team) continue;
    const count = players.filter(
      (player) => player.team === stack.team && matchesAnyPosition(player, stack.positions)
    ).length;
    if (count < stack.count) {
      return false;
    }
  }
  return true;
};

const satisfiesConstraints = (
  assigned: AssignedPlayer[],
  constraints: OptimizerConstraints
): boolean => {
  const players = getPlayersFromAssignments(assigned);

  if (constraints.avoid_opposing_defense) {
    const dstTeams = new Set(players.filter((player) => player.positions.includes("DST")).map((player) => player.team));
    if (
      players.some(
        (player) =>
          !player.positions.includes("DST") &&
          !!player.opponent &&
          dstTeams.has(player.opponent)
      )
    ) {
      return false;
    }
  }

  if (constraints.one_skill_player_per_team) {
    const qbTeams = new Set(players.filter((player) => player.positions.includes("QB")).map((player) => player.team));
    const skillCounts = new Map<string, number>();
    players.forEach((player) => {
      if (isSkillPlayer(player)) {
        skillCounts.set(player.team, (skillCounts.get(player.team) || 0) + 1);
      }
    });

    for (const [team, count] of skillCounts.entries()) {
      const allowed = qbTeams.has(team) ? 2 : 1;
      if (count > allowed) {
        return false;
      }
    }
  }

  if (constraints.avoid_te_in_flex) {
    const flexEntry = assigned.find(({ slot }) => slot === "FLEX");
    if (flexEntry && flexEntry.player.positions.every((pos) => !FLEX_NO_TE_POSITIONS.has(pos))) {
      return false;
    }
  }

  return true;
};

const canAddPlayerToLineup = (
  assigned: AssignedPlayer[],
  candidate: InternalPlayer,
  constraints: OptimizerConstraints
): boolean => {
  if (constraints.one_skill_player_per_team && isSkillPlayer(candidate)) {
    const players = getPlayersFromAssignments(assigned);
    const qbTeams = new Set(players.filter((player) => player.positions.includes("QB")).map((player) => player.team));
    const existingCount = players.filter(
      (player) => player.team === candidate.team && isSkillPlayer(player)
    ).length;
    const allowed = qbTeams.has(candidate.team) ? 2 : 1;
    if (existingCount + 1 > allowed) {
      return false;
    }
  }

  if (constraints.avoid_opposing_defense) {
    const players = getPlayersFromAssignments(assigned);
    if (
      candidate.positions.includes("DST") &&
      players.some(
        (player) =>
          !player.positions.includes("DST") &&
          player.opponent === candidate.team
      )
    ) {
      return false;
    }

    if (
      !candidate.positions.includes("DST") &&
      candidate.opponent &&
      players.some(
        (player) =>
          player.positions.includes("DST") &&
          player.team === candidate.opponent
      )
    ) {
      return false;
    }
  }

  return true;
};

const isOverlapValid = (
  lineupPlayers: InternalPlayer[],
  previousLineups: OptimizerLineup[],
  maxRepeatingPlayers: number | null
): boolean => {
  if (maxRepeatingPlayers === null) return true;
  const ids = new Set(lineupPlayers.map((player) => player.id));
  return previousLineups.every((lineup) => {
    const overlap = lineup.players.filter((player) => ids.has(player.id)).length;
    return overlap <= maxRepeatingPlayers;
  });
};

const getCandidatePlayers = (
  players: InternalPlayer[],
  usedIds: Set<string>,
  slot: string,
  constraints: OptimizerConstraints
): InternalPlayer[] => {
  return players.filter((player) => {
    if (usedIds.has(player.id)) return false;
    return isPlayerEligibleForSlot(player, slot, constraints);
  });
};

const getRemainingSalaryBounds = (
  players: InternalPlayer[],
  usedIds: Set<string>,
  remainingSlots: string[],
  constraints: OptimizerConstraints
): { min: number; max: number; feasible: boolean } => {
  let min = 0;
  let max = 0;

  for (const slot of remainingSlots) {
    const candidates = getCandidatePlayers(players, usedIds, slot, constraints);
    if (!candidates.length) {
      return { min: 0, max: 0, feasible: false };
    }
    const salaries = candidates.map((player) => player.salary);
    min += Math.min(...salaries);
    max += Math.max(...salaries);
  }

  return { min, max, feasible: true };
};

const findBestLineup = (
  players: InternalPlayer[],
  remainingSlots: string[],
  lockedPlayers: AssignedPlayer[],
  minSalary: number | null,
  maxSalary: number | null,
  teamLimit: number | null,
  stacks: StackRule[],
  constraints: OptimizerConstraints,
  previousLineups: OptimizerLineup[],
  maxRepeatingPlayers: number | null
): OptimizerLineup | null => {
  let best: { score: number; lineup: AssignedPlayer[] } | null = null;

  const usedIds = new Set(lockedPlayers.map(({ player }) => player.id));
  const initialSalary = lockedPlayers.reduce((sum, { player }) => sum + player.salary, 0);
  const initialScore = lockedPlayers.reduce((sum, { player }) => sum + player.score, 0);

  const teamCounts = new Map<string, number>();
  lockedPlayers.forEach(({ player }) => {
    teamCounts.set(player.team, (teamCounts.get(player.team) || 0) + 1);
  });

  // TS optimizer uses a deterministic DFS search; this differs from the Python solver's MILP approach.
  const sortedPlayers = [...players].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.id.localeCompare(b.id);
  });

  const search = (
    chosen: AssignedPlayer[],
    slots: string[],
    totalSalary: number,
    totalScore: number
  ) => {
    if (!slots.length) {
      if (minSalary !== null && totalSalary < minSalary) return;
      if (maxSalary !== null && totalSalary > maxSalary) return;
      const chosenPlayers = getPlayersFromAssignments(chosen);
      if (!satisfiesStacks(chosenPlayers, stacks)) return;
      if (!satisfiesConstraints(chosen, constraints)) return;
      if (!isOverlapValid(chosenPlayers, previousLineups, maxRepeatingPlayers)) return;

      if (!best || totalScore > best.score) {
        best = { score: totalScore, lineup: [...chosen] };
      }
      return;
    }

    if (maxSalary !== null && totalSalary > maxSalary) {
      return;
    }

    const bounds = getRemainingSalaryBounds(
      sortedPlayers,
      new Set(chosen.map(({ player }) => player.id)),
      slots,
      constraints
    );
    if (!bounds.feasible) return;
    if (maxSalary !== null && totalSalary + bounds.min > maxSalary) return;
    if (minSalary !== null && totalSalary + bounds.max < minSalary) return;

    let slotIndex = 0;
    let candidates: InternalPlayer[] = [];
    let smallestCount = Number.POSITIVE_INFINITY;

    slots.forEach((slot, index) => {
      const slotCandidates = getCandidatePlayers(
        sortedPlayers,
        new Set(chosen.map(({ player }) => player.id)),
        slot,
        constraints
      );
      if (slotCandidates.length < smallestCount) {
        smallestCount = slotCandidates.length;
        slotIndex = index;
        candidates = slotCandidates;
      }
    });

    const slot = slots[slotIndex];
    const nextSlots = [...slots];
    nextSlots.splice(slotIndex, 1);

    for (const candidate of candidates) {
      if (usedIds.has(candidate.id)) continue;

      const currentTeamCount = teamCounts.get(candidate.team) || 0;
      if (teamLimit !== null && currentTeamCount + 1 > teamLimit) {
        continue;
      }
      if (!canAddPlayerToLineup(chosen, candidate, constraints)) {
        continue;
      }

      usedIds.add(candidate.id);
      teamCounts.set(candidate.team, currentTeamCount + 1);
      chosen.push({ player: candidate, slot });

      search(chosen, nextSlots, totalSalary + candidate.salary, totalScore + candidate.score);

      chosen.pop();
      usedIds.delete(candidate.id);
      teamCounts.set(candidate.team, currentTeamCount);
    }
  };

  search([...lockedPlayers], [...remainingSlots], initialSalary, initialScore);

  if (!best) return null;

  const lineupPlayers = getPlayersFromAssignments(best!.lineup);
  const salary = lineupPlayers.reduce((sum, player) => sum + player.salary, 0);
  const projection = lineupPlayers.reduce((sum, player) => sum + player.fppg, 0);

  return {
    players: buildLineupPlayers(lineupPlayers),
    salary_costs: salary,
    fantasy_points_projection: projection,
  };
};

const buildExposures = (lineups: OptimizerLineup[]): OptimizerExposure[] => {
  const counts = new Map<
    string,
    { count: number; player: OptimizerPlayer }
  >();
  lineups.forEach((lineup) => {
    lineup.players.forEach((player) => {
      const existing = counts.get(player.id);
      if (existing) {
        existing.count += 1;
      } else {
        counts.set(player.id, { count: 1, player });
      }
    });
  });

  const total = lineups.length;
  return [...counts.values()]
    .sort((a, b) =>
      b.count !== a.count ? b.count - a.count : a.player.name.localeCompare(b.player.name)
    )
    .map(({ count, player }) => ({
      id: player.id,
      name: player.name,
      team: player.team,
      primary_position: player.positions[0] || "-",
      lineups: count,
      exposure: total ? Math.round((count / total) * 10000) / 100 : 0,
    }));
};

export const buildOptimizerResponse = (request: OptimizeRequest): OptimizerResponse => {
  const effectiveStacks = normalizeStacks(request.stacks, request.constraints);
  const excluded = new Set(request.excluded_player_ids);
  const lockedIds = new Set(request.locked_player_ids);

  const playerPool: InternalPlayer[] = request.players
    .filter((player) => !excluded.has(player.id))
    .map((player) => {
      const randomness = request.randomness ?? 0;
      const randomFactor = randomness > 0 ? (Math.random() * 2 - 1) * (randomness / 100) : 0;
      return {
        ...player,
        name: `${player.first_name} ${player.last_name}`.trim(),
        score: player.fppg * (1 + randomFactor),
      };
    });

  const lockedPlayers = playerPool.filter((player) => lockedIds.has(player.id));
  const { locked, remainingSlots } = assignLockedPlayers(
    lockedPlayers,
    [...ROSTER_SLOTS],
    request.constraints
  );

  const lineups: OptimizerLineup[] = [];
  for (let i = 0; i < request.lineup_count; i += 1) {
    const lineup = findBestLineup(
      playerPool,
      remainingSlots,
      locked,
      request.min_salary,
      request.max_salary,
      request.team_limit,
      effectiveStacks,
      request.constraints,
      lineups,
      request.max_repeating_players
    );

    if (!lineup) {
      break;
    }

    lineups.push(lineup);
  }

  if (!lineups.length) {
    throw new GenerateLineupError("No valid lineups could be generated.");
  }

  return {
    settings: {
      lineup_count: request.lineup_count,
      min_salary: request.min_salary,
      max_salary: request.max_salary,
      max_repeating_players: request.max_repeating_players,
      locked_player_ids: request.locked_player_ids,
      excluded_player_ids: request.excluded_player_ids,
      team_limit: request.team_limit,
      randomness: request.randomness,
      stacks: effectiveStacks,
      constraints: request.constraints,
    },
    lineup_count_requested: request.lineup_count,
    lineup_count_returned: lineups.length,
    lineups,
    exposures: buildExposures(lineups),
  };
};
