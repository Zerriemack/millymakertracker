import fs from "node:fs";

const SEED_PATH = "data/seeds/nfl_players_seed.json";

const TEAM_MAP: Record<string, string> = {
  BLT: "BAL",
  JAC: "JAX",
  ARZ: "ARI",
  SD: "LAC",
  HST: "HOU",
  OAK: "LV",
  CLV: "CLE",
  WSH: "WAS",
  LA: "LAR",
};

type SeedRow = {
  sport: string;
  name: string;
  position: string;
  teamAbbreviation: string;
};

function main() {
  const raw = fs.readFileSync(SEED_PATH, "utf8");
  const data = JSON.parse(raw) as SeedRow[];
  if (!Array.isArray(data)) throw new Error("Seed file is not a JSON array.");

  let changed = 0;
  for (const row of data) {
    const team = String(row.teamAbbreviation ?? "").trim().toUpperCase();
    if (!team) continue;
    const mapped = TEAM_MAP[team];
    if (mapped && mapped !== team) {
      row.teamAbbreviation = mapped;
      changed += 1;
    }
  }

  const out = JSON.stringify(data, null, 2) + "\n";
  fs.writeFileSync(SEED_PATH, out);

  console.log(JSON.stringify({ changed }, null, 2));
}

main();
