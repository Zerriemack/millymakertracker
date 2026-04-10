export type SimulatorSlate = {
  id: string;
  sport: string;
  season: number;
  week: number;
  site: "draftkings" | "fanduel";
  gameType: "classic" | "showdown";
  slateType: string;
  name: string;
  salaryCap: number;
  rosterSize: number;
  startTime: string;
};

export type SimulatorGame = {
  id: string;
  slateId: string;
  awayTeam: string;
  homeTeam: string;
  gameLabel: string;
  spread: string;
  total: number;
  startTime: string;
};

export type SimulatorTeamInput = {
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

export type SimulatorPlayerInput = {
  id: string;
  slateId: string;
  gameId: string;
  team: string;
  opponent: string;
  name: string;
  position: string;
  salary: number;
  projection: number;
  ownership: number;
  rushMarketShare: number;
  rushTdMarketShare: number;
  receivingMarketShare: number;
  receivingTdMarketShare: number;
  catchRate: number;
  passMarketShare: number;
  intRate: number;
  status: "active" | "out" | "questionable";
};

export type SimulatorSettings = {
  slateId: string;
  lineupCount: number;
  fieldSize: number;
  simulationCount: number;
  payoutProfile?: "topHeavy" | "standard" | "cash";
};

export type SimulatorSlatePackage = {
  slate: SimulatorSlate;
  games: SimulatorGame[];
  teamInputs: SimulatorTeamInput[];
  playerInputs: SimulatorPlayerInput[];
  settings: SimulatorSettings;
};
