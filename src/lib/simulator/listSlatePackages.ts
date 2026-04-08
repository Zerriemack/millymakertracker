import { readdir } from "fs/promises";
import path from "path";
import { SLATES_ROOT } from "./paths";

const REQUIRED_FILES = [
  "slate.json",
  "games.json",
  "team-inputs.json",
  "player-inputs.json",
  "settings.json",
];

async function walk(dir: string, results: string[]) {
  const entries = await readdir(dir, { withFileTypes: true });
  const entryMap = new Map(entries.map((entry) => [entry.name, entry]));

  const hasPackage = REQUIRED_FILES.every((file) => {
    const entry = entryMap.get(file);
    return entry?.isFile();
  });

  if (hasPackage) {
    const key = path.relative(SLATES_ROOT, dir).split(path.sep).join("/");
    results.push(key);
  }

  await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => walk(path.join(dir, entry.name), results))
  );
}

export async function listSlatePackages(): Promise<string[]> {
  const results: string[] = [];
  try {
    await walk(SLATES_ROOT, results);
  } catch (error) {
    return [];
  }
  return results.sort();
}
