export type SimulatorSlate = {
  id: string;
  name: string;
  sport: string;
  site: string;
  gameType: string;
  games: number;
  salaryCap: number;
  startTime: string;
};

export const mockSlates: SimulatorSlate[] = [
  {
    id: "3-game-main",
    name: "3 Game Main",
    sport: "nfl",
    site: "draftkings",
    gameType: "Classic",
    games: 3,
    salaryCap: 50000,
    startTime: "2024-09-08T13:00:00-04:00",
  },
  {
    id: "lou-orl-showdown",
    name: "LOU@ORL Showdown",
    sport: "nfl",
    site: "draftkings",
    gameType: "Showdown",
    games: 1,
    salaryCap: 50000,
    startTime: "2024-09-08T16:05:00-04:00",
  },
  {
    id: "bir-hou-showdown",
    name: "BIR@HOU Showdown",
    sport: "nfl",
    site: "draftkings",
    gameType: "Showdown",
    games: 1,
    salaryCap: 50000,
    startTime: "2024-09-08T20:20:00-04:00",
  },
  {
    id: "fd-3-game-classic",
    name: "FD 3 Game Classic",
    sport: "nfl",
    site: "fanduel",
    gameType: "Classic",
    games: 3,
    salaryCap: 60000,
    startTime: "2024-09-08T13:00:00-04:00",
  },
  {
    id: "fd-nyj-buf-showdown",
    name: "NYJ@BUF Showdown",
    sport: "nfl",
    site: "fanduel",
    gameType: "Showdown",
    games: 1,
    salaryCap: 60000,
    startTime: "2024-09-08T20:20:00-04:00",
  },
];

export function getSlateById(slateId: string) {
  return mockSlates.find((slate) => slate.id === slateId);
}
