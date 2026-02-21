import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/prisma";

type MapRow = {
  sport: "NFL";
  nameNorm: string;
  position: string;
  gsisId: string;
};

function normName(s: any) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ");
}

function stripSuffix(parts: string[]) {
  const suffixes = new Set(["jr", "sr", "ii", "iii", "iv", "v"]);
  while (parts.length && suffixes.has(parts[parts.length - 1])) parts.pop();
  return parts;
}

function firstInitial(nameNorm: string) {
  const parts = stripSuffix(nameNorm.split(" ").filter(Boolean));
  return parts.length ? (parts[0][0] ?? "") : "";
}

function lastName(nameNorm: string) {
  const parts = stripSuffix(nameNorm.split(" ").filter(Boolean));
  return parts.length ? parts[parts.length - 1] : "";
}

async function main() {
  const mapPath = path.join(process.cwd(), "data/seeds/nfl_player_gsis_map.json");
  if (!fs.existsSync(mapPath)) {
    console.error(`Missing map file: ${mapPath}`);
    process.exit(1);
  }

  const mapRows = JSON.parse(fs.readFileSync(mapPath, "utf8")) as MapRow[];

  // index: POS|FI|LN -> list of candidates
  const idx = new Map<string, Array<{ gsisId: string; name: string }>>();
  for (const r of mapRows) {
    if (r.sport !== "NFL") continue;
    const pos = String(r.position).toUpperCase().trim();
    const n = String(r.nameNorm).trim();
    const fi = firstInitial(n);
    const ln = lastName(n);
    if (!pos || !fi || !ln || !r.gsisId) continue;

    const key = `${pos}|${fi}|${ln}`;
    if (!idx.has(key)) idx.set(key, []);
    idx.get(key)!.push({ gsisId: r.gsisId, name: n });
  }

  const missing = await prisma.player.findMany({
    where: { sport: "NFL", lineupItems: { some: {} }, gsisId: null, position: { not: "DST" } },
    select: { id: true, name: true, position: true, team: { select: { abbreviation: true } } },
    orderBy: { name: "asc" },
  });

  const out = missing.map((p) => {
    const pos = String(p.position).toUpperCase().trim();
    const n = normName(p.name);
    const fi = firstInitial(n);
    const ln = lastName(n);
    const key = `${pos}|${fi}|${ln}`;
    const candidates = (idx.get(key) ?? []).slice(0, 20); // cap
    return {
      id: p.id,
      team: p.team.abbreviation,
      position: pos,
      name: p.name,
      key,
      candidateCount: candidates.length,
      candidates,
    };
  });

  const outPath = path.join(process.cwd(), "data/seeds/nfl_players_used_missing_gsis_candidates.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ ok: true, missing: missing.length, outPath }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });
