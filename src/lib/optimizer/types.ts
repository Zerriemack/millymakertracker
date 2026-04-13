export type PlayerInput = {
  id: string;
  first_name: string;
  last_name: string;
  positions: string[];
  team: string;
  salary: number;
  fppg: number;
};

export type StackRule = {
  team?: string | null;
  positions?: string[];
  count: number;
};

export type OptimizeRequest = {
  players: PlayerInput[];
  lineup_count: number;
  min_salary: number | null;
  max_salary: number | null;
  max_repeating_players: number | null;
  locked_player_ids: string[];
  excluded_player_ids: string[];
  team_limit: number | null;
  randomness: number | null;
  stacks: StackRule[];
};

export type OptimizerPlayer = {
  id: string;
  name: string;
  team: string;
  positions: string[];
  salary: number;
  fppg: number;
};

export type OptimizerLineup = {
  players: OptimizerPlayer[];
  salary_costs: number;
  fantasy_points_projection: number;
};

export type OptimizerExposure = {
  id: string;
  name: string;
  team: string;
  primary_position: string;
  lineups: number;
  exposure: number;
};

export type OptimizerResponse = {
  settings: {
    lineup_count: number;
    min_salary: number | null;
    max_salary: number | null;
    max_repeating_players: number | null;
    locked_player_ids: string[];
    excluded_player_ids: string[];
    team_limit: number | null;
    randomness: number | null;
    stacks: StackRule[];
  };
  lineup_count_requested: number;
  lineup_count_returned: number;
  lineups: OptimizerLineup[];
  exposures: OptimizerExposure[];
};

export type ValidationError = {
  field: string;
  message: string;
};

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: ValidationError[] };
