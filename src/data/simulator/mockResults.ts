export type PlusEvPlayer = {
  id: string;
  name: string;
  team: string;
  position: string;
  ev: number;
};

export type PlayerExposure = {
  id: string;
  name: string;
  exposure: number;
};

export type GradedLineup = {
  id: string;
  lineup: string;
  projected: number;
  grade: string;
};

export type LineupSlot = {
  rosterSlot: string;
  playerName: string;
  team: string;
  position: string;
  salary: number;
  projection: number;
};

export type SimulatorLineup = {
  lineupId: string;
  slateId: string;
  slots: LineupSlot[];
  salaryUsed: number;
  projectedPoints: number;
};

export type SimulatorResults = {
  slateId: string;
  plusEv: PlusEvPlayer[];
  exposures: PlayerExposure[];
  gradedLineups: GradedLineup[];
  lineups: SimulatorLineup[];
};

export const mockResults: SimulatorResults[] = [
  {
    slateId: "3-game-main",
    plusEv: [
      { id: "p-allen", name: "Josh Allen", team: "BUF", position: "QB", ev: 8.4 },
      { id: "p-hall", name: "Breece Hall", team: "NYJ", position: "RB", ev: 6.1 },
      { id: "p-olave", name: "Chris Olave", team: "NO", position: "WR", ev: 5.2 },
    ],
    exposures: [
      { id: "p-allen", name: "Josh Allen", exposure: 32 },
      { id: "p-diggs", name: "Stefon Diggs", exposure: 28 },
      { id: "p-hall", name: "Breece Hall", exposure: 25 },
      { id: "p-ryan", name: "Bijan Robinson", exposure: 21 },
    ],
    gradedLineups: [
      { id: "l1", lineup: "Allen / Hall / Diggs / Olave / Hockenson", projected: 152.4, grade: "A" },
      { id: "l2", lineup: "Lawrence / Etienne / Kirk / Addison / Pitts", projected: 141.8, grade: "B+" },
      { id: "l3", lineup: "Allen / Robinson / Diggs / Wilson / Olave", projected: 148.9, grade: "A-" },
    ],
    lineups: [
      {
        lineupId: "l-3gm-1",
        slateId: "3-game-main",
        salaryUsed: 49700,
        projectedPoints: 151.2,
        slots: [
          { rosterSlot: "QB", playerName: "Josh Allen", team: "BUF", position: "QB", salary: 8200, projection: 24.6 },
          { rosterSlot: "RB", playerName: "Breece Hall", team: "NYJ", position: "RB", salary: 7100, projection: 18.3 },
          { rosterSlot: "RB", playerName: "Bijan Robinson", team: "ATL", position: "RB", salary: 7800, projection: 19.5 },
          { rosterSlot: "WR", playerName: "Stefon Diggs", team: "BUF", position: "WR", salary: 7600, projection: 20.1 },
          { rosterSlot: "WR", playerName: "Chris Olave", team: "NO", position: "WR", salary: 6700, projection: 16.4 },
          { rosterSlot: "WR", playerName: "Garrett Wilson", team: "NYJ", position: "WR", salary: 6900, projection: 17.2 },
          { rosterSlot: "TE", playerName: "T.J. Hockenson", team: "MIN", position: "TE", salary: 5200, projection: 12.4 },
        ],
      },
    ],
  },
  {
    slateId: "lou-orl-showdown",
    plusEv: [
      { id: "p-lou-qb", name: "Tyler Brooks", team: "LOU", position: "QB", ev: 5.3 },
      { id: "p-orl-qb", name: "Evan Pierce", team: "ORL", position: "QB", ev: 4.7 },
    ],
    exposures: [
      { id: "p-lou-wr1", name: "Marcus Hale", exposure: 42 },
      { id: "p-orl-wr1", name: "Jalen Knox", exposure: 36 },
    ],
    gradedLineups: [
      { id: "l1", lineup: "Brooks / Hale / Cole / Pierce / Knox", projected: 96.4, grade: "A-" },
      { id: "l2", lineup: "Pierce / Knox / Rhodes / Willis / Sanders", projected: 89.7, grade: "B" },
    ],
    lineups: [
      {
        lineupId: "l-lou-1",
        slateId: "lou-orl-showdown",
        salaryUsed: 49600,
        projectedPoints: 96.4,
        slots: [
          { rosterSlot: "CPT", playerName: "Tyler Brooks", team: "LOU", position: "QB", salary: 16800, projection: 27.6 },
          { rosterSlot: "FLEX", playerName: "Marcus Hale", team: "LOU", position: "WR", salary: 9400, projection: 16.1 },
          { rosterSlot: "FLEX", playerName: "Darius Cole", team: "LOU", position: "RB", salary: 8800, projection: 15.6 },
          { rosterSlot: "FLEX", playerName: "Evan Pierce", team: "ORL", position: "QB", salary: 10600, projection: 17.2 },
          { rosterSlot: "FLEX", playerName: "Jalen Knox", team: "ORL", position: "WR", salary: 9200, projection: 14.9 },
        ],
      },
    ],
  },
  {
    slateId: "bir-hou-showdown",
    plusEv: [
      { id: "p-bir-qb", name: "Jordan Miles", team: "BIR", position: "QB", ev: 4.9 },
      { id: "p-hou-wr1", name: "Noah Blake", team: "HOU", position: "WR", ev: 4.4 },
    ],
    exposures: [
      { id: "p-bir-wr1", name: "Zay Carter", exposure: 38 },
      { id: "p-hou-qb", name: "Chris Dalton", exposure: 34 },
    ],
    gradedLineups: [
      { id: "l1", lineup: "Miles / Carter / Price / Dalton / Blake", projected: 94.1, grade: "B+" },
      { id: "l2", lineup: "Dalton / Blake / Foster / Miles / Hart", projected: 91.3, grade: "B" },
    ],
    lineups: [
      {
        lineupId: "l-bir-1",
        slateId: "bir-hou-showdown",
        salaryUsed: 49200,
        projectedPoints: 94.1,
        slots: [
          { rosterSlot: "CPT", playerName: "Jordan Miles", team: "BIR", position: "QB", salary: 16350, projection: 26.7 },
          { rosterSlot: "FLEX", playerName: "Zay Carter", team: "BIR", position: "WR", salary: 9100, projection: 15.3 },
          { rosterSlot: "FLEX", playerName: "Damien Price", team: "BIR", position: "RB", salary: 8800, projection: 14.7 },
          { rosterSlot: "FLEX", playerName: "Chris Dalton", team: "HOU", position: "QB", salary: 10400, projection: 16.5 },
          { rosterSlot: "FLEX", playerName: "Noah Blake", team: "HOU", position: "WR", salary: 9000, projection: 15.1 },
        ],
      },
    ],
  },
];

export function getResultsBySlate(slateId: string) {
  return mockResults.find((results) => results.slateId === slateId);
}
