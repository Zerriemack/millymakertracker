import path from "path";
import { loadJson } from "./loadJson";
import { resolveSlatePackagePath } from "./paths";
import type {
  SimulatorGame,
  SimulatorPlayerInput,
  SimulatorSettings,
  SimulatorSlate,
  SimulatorSlatePackage,
  SimulatorTeamInput,
} from "./types";

export async function loadSlatePackage(slateKey: string): Promise<SimulatorSlatePackage> {
  const slateDir = resolveSlatePackagePath(slateKey);

  const slate = await loadJson<SimulatorSlate>(path.join(slateDir, "slate.json"));
  const games = await loadJson<SimulatorGame[]>(path.join(slateDir, "games.json"));
  const teamInputs = await loadJson<SimulatorTeamInput[]>(path.join(slateDir, "team-inputs.json"));
  const playerInputs = await loadJson<SimulatorPlayerInput[]>(path.join(slateDir, "player-inputs.json"));
  const settings = await loadJson<SimulatorSettings>(path.join(slateDir, "settings.json"));

  return {
    slate,
    games,
    teamInputs,
    playerInputs,
    settings,
  };
}
