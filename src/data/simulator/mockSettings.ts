export type SimulatorSettings = {
  slateId: string;
  lineupCount: number;
  fieldSize: number;
  simulationCount: number;
  salaryCap: number;
};

export const mockSettings: SimulatorSettings[] = [
  {
    slateId: "3-game-main",
    lineupCount: 150,
    fieldSize: 23456,
    simulationCount: 2000,
    salaryCap: 50000,
  },
  {
    slateId: "lou-orl-showdown",
    lineupCount: 150,
    fieldSize: 14321,
    simulationCount: 1500,
    salaryCap: 50000,
  },
  {
    slateId: "bir-hou-showdown",
    lineupCount: 150,
    fieldSize: 11890,
    simulationCount: 1500,
    salaryCap: 50000,
  },
];

export function getSettingsBySlate(slateId: string) {
  return mockSettings.find((settings) => settings.slateId === slateId);
}
