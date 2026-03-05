import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";

type WeeklyRow = {
  season: string;
  week: string;
  playerId: string;
  playerName: string;
  team: string;
  position: string;
  passYds: string;
  passTd: string;
  rushYds: string;
  rushTd: string;
  rec: string;
  recYds: string;
  recTd: string;
  fumblesLost: string;
};

function normName(s: string): string {
  return s
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function key(season: number, week: number, team: string, name: string): string {
  return `${season}|${week}|${team}|${normName(name)}`;
}

function toInt(x: string | undefined): number {
  if (x == null || x === "") return 0;
  const n = Number(x);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function patchLineupItem(item: any, wk: WeeklyRow) {
  const pos = item.position;

  if (pos === "QB") {
    item.passTd = toInt(wk.passTd);
    item.passYds = toInt(wk.passYds);
    item.rushYds = toInt(wk.rushYds);
    item.fumblesLost = toInt(wk.fumblesLost);
    return;
  }

  if (pos === "RB") {
    item.rushYdsRb = toInt(wk.rushYds);
    item.rushTdRb = toInt(wk.rushTd);
    item.recRb = toInt(wk.rec);
    item.recYdsRb = toInt(wk.recYds);
    item.fumblesLost = toInt(wk.fumblesLost);
    return;
  }

  if (pos === "WR" || pos === "TE") {
    item.rec = toInt(wk.rec);
    item.recYds = toInt(wk.recYds);
    item.recTd = toInt(wk.recTd);
    item.rushYds = toInt(wk.rushYds);
    item.fumblesLost = toInt(wk.fumblesLost);
    return;
  }
}

function main() {
  const season = 2022;
  const weeklyCsvPath = `data/stats/nfl/${season}/weekly_player_normalized.csv`;
  const weeklyCsv = fs.readFileSync(weeklyCsvPath, "utf8");

  const rows = parse(weeklyCsv, {
    columns: true,
    skip_empty_lines: true
  }) as WeeklyRow[];

  const weeklyMap = new Map<string, WeeklyRow>();
  for (const r of rows) {
    const k = key(Number(r.season), Number(r.week), r.team, r.playerName);
    weeklyMap.set(k, r);
  }

  const importDir = `data/import/nfl/${season}`;
  const files = fs
    .readdirSync(importDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => path.join(importDir, f));

  const failures: Array<{ file: string; missing: string[] }> = [];

  for (const file of files) {
    const obj = JSON.parse(fs.readFileSync(file, "utf8"));
    const week = Number(obj.week);

    const missing: string[] = [];

    for (const item of obj.lineup.items) {
      if (item.position === "DST") continue;

      const k = key(season, week, item.team, item.name);
      const wk = weeklyMap.get(k);

      if (!wk) {
        missing.push(`${item.team} ${item.name}`);
        continue;
      }

      patchLineupItem(item, wk);
    }

    if (missing.length > 0) {
      failures.push({ file, missing });
      continue;
    }

    fs.writeFileSync(file, JSON.stringify(obj, null, 2) + "\n", "utf8");
  }

  if (failures.length > 0) {
    console.error("Backfill failures. No partial writes.");
    for (const f of failures) {
      console.error(f.file);
      for (const m of f.missing) console.error("  " + m);
    }
    process.exit(1);
  }

  console.log("Patched all 2022 import json files for QB RB WR TE statlines.");
}

main();