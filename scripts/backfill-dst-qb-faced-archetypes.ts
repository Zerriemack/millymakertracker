import fs from "node:fs";
import path from "node:path";

type ImportLineupItem = {
  rosterSpot?: string | null;
  qbFaced?: string | null;
  qbFacedArchetype?: string | null;
};

type ImportFile = {
  lineup?: {
    items?: ImportLineupItem[];
  };
};

function readJsonFile<T>(filePath: string): T {
  const raw = fs.readFileSync(filePath, "utf8");
  try {
    return JSON.parse(raw) as T;
  } catch (e: any) {
    throw new Error(`Failed to parse JSON: ${filePath}\n${e?.message ?? e}`);
  }
}

function hasValue(v: any): boolean {
  return String(v ?? "").trim().length > 0;
}

function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  if (!args.length) {
    throw new Error(
      "Provide one or more JSON files.\nExample:\n  node node_modules/.bin/tsx scripts/backfill-dst-qb-faced-archetypes.ts data/import/nfl/2024/week01_main_1.json"
    );
  }

  const filePaths = args.map((p) => (path.isAbsolute(p) ? p : path.join(process.cwd(), p)));
  const summaries: { filePath: string; updatedCount: number }[] = [];

  for (const filePath of filePaths) {
    const data = readJsonFile<ImportFile>(filePath);
    const items = data.lineup?.items ?? [];
    let updatedCount = 0;

    for (const it of items) {
      const rosterSpot = String(it?.rosterSpot ?? "").toUpperCase().trim();
      if (rosterSpot !== "DST") continue;
      if (!hasValue(it?.qbFaced)) continue;
      if (hasValue(it?.qbFacedArchetype)) continue;

      it.qbFacedArchetype = "";
      updatedCount++;
    }

    if (updatedCount > 0) {
      const next = JSON.stringify(data, null, 2) + "\n";
      fs.writeFileSync(filePath, next);
    }

    summaries.push({ filePath, updatedCount });
  }

  for (const { filePath, updatedCount } of summaries) {
    console.log(`${filePath}: ${updatedCount} DST item(s) updated`);
  }
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exitCode = 1;
});
