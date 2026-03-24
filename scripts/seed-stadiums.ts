import fs from "node:fs";
import path from "node:path";

import { prisma } from "../src/lib/prisma";

type StadiumSeed = {
  name: string;
  city: string;
  state: string;
  isIndoor: boolean;
  teamAbbreviation?: string | null;
  activeFromSeason?: number | null;
  activeToSeason?: number | null;
  aliases?: string[] | null;
};

function requireSeedPath() {
  const p = process.argv[2];
  if (!p) {
    throw new Error(
      [
        "Missing seed file path.",
        "Example:",
        "dotenv_config_path=.env.local node --import dotenv/config --import tsx scripts/seed-stadiums.ts data/seeds/nfl_stadiums_seed.json",
      ].join("\n")
    );
  }
  return p;
}

function keyFor(row: StadiumSeed) {
  const parts = [
    row.name.trim().toLowerCase(),
    row.city.trim().toLowerCase(),
    row.state.trim().toLowerCase(),
    String(row.teamAbbreviation ?? "").trim().toUpperCase(),
    String(row.activeFromSeason ?? ""),
    String(row.activeToSeason ?? ""),
  ];
  return parts.join("|");
}

function validateRow(row: StadiumSeed, idx: number) {
  if (!row || typeof row !== "object") throw new Error(`Row ${idx} is not an object.`);
  if (!row.name) throw new Error(`Row ${idx} missing name.`);
  if (!row.city) throw new Error(`Row ${idx} missing city.`);
  if (!row.state) throw new Error(`Row ${idx} missing state.`);
  if (typeof row.isIndoor !== "boolean") throw new Error(`Row ${idx} missing isIndoor.`);
  if (row.activeFromSeason != null && !Number.isFinite(row.activeFromSeason)) {
    throw new Error(`Row ${idx} activeFromSeason must be a number or null.`);
  }
  if (row.activeToSeason != null && !Number.isFinite(row.activeToSeason)) {
    throw new Error(`Row ${idx} activeToSeason must be a number or null.`);
  }
  if (row.aliases != null && !Array.isArray(row.aliases)) {
    throw new Error(`Row ${idx} aliases must be an array or null.`);
  }
}

async function main() {
  const seedPath = requireSeedPath();
  const file = path.join(process.cwd(), seedPath);
  const rows = JSON.parse(fs.readFileSync(file, "utf8")) as StadiumSeed[];

  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("Seed file must be a non-empty array.");
  }

  rows.forEach((row, i) => validateRow(row, i + 1));

  const existing = await prisma.stadium.findMany({
    select: {
      name: true,
      city: true,
      state: true,
      teamAbbreviation: true,
      activeFromSeason: true,
      activeToSeason: true,
    },
  });

  const existingKeys = new Set(existing.map((row) => keyFor(row)));

  const data = rows
    .filter((row) => !existingKeys.has(keyFor(row)))
    .map((row) => ({
      name: row.name.trim(),
      city: row.city.trim(),
      state: row.state.trim(),
      isIndoor: !!row.isIndoor,
      teamAbbreviation: row.teamAbbreviation ? String(row.teamAbbreviation).trim().toUpperCase() : null,
      activeFromSeason: row.activeFromSeason ?? null,
      activeToSeason: row.activeToSeason ?? null,
      aliases: row.aliases ?? null,
    }));

  if (data.length === 0) {
    console.log(JSON.stringify({ ok: true, created: 0, file: seedPath }, null, 2));
    return;
  }

  const result = await prisma.stadium.createMany({
    data,
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        created: result.count,
        file: seedPath,
        inputRows: rows.length,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
