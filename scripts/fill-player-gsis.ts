import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/prisma";

type MapRow = {
  sport: "NFL";
  nameNorm: string;
  position: string;
  gsisId: string;
};

function die(msg: string): never {
  console.error(msg);
  process.exit(1);
}

function normName(s: any) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ");
}

function firstInitial(nameNorm: string) {
  const parts = nameNorm.split(" ").filter(Boolean);
  return parts.length ? (parts[0][0] ?? "") : "";
}

function lastName(nameNorm: string) {
  const parts = nameNorm.split(" ").filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "";
}

function requireSeedPath(argv: string[]) {
  const p = String(argv[2] ?? "").trim();
  if (!p) die("Usage: scripts/fill-player-gsis.ts <mapfile.json>");
  return p;
}

function readJson(p: string) {
  const abs = path.isAbsolute(p) ? p : path.join(process.cwd(), p);
  if (!fs.existsSync(abs)) die(`File not found: ${abs}`);
  const data = JSON.parse(fs.readFileSync(abs, "utf8"));
  if (!Array.isArray(data)) die("Map JSON must be an array.");
  return data as MapRow[];
}

async function main() {
  const mapPath = requireSeedPath(process.argv);
  const mapRows = readJson(mapPath).filter((r) => String(r.sport).trim() === "NFL");

  // 1) full name key: POS|fullName (only keep unique)
  const fullBuckets = new Map<string, Set<string>>();
  // 2) initial+last key: POS|F|LAST (only keep unique)
  const ilBuckets = new Map<string, Set<string>>();

  for (const r of mapRows) {
    const pos = String(r.position).toUpperCase().trim();
    const name = String(r.nameNorm ?? "").trim();
    const gsisId = String(r.gsisId ?? "").trim();

    if (!pos || !name || !gsisId) continue;

    const fullKey = `${pos}|${name}`;
    if (!fullBuckets.has(fullKey)) fullBuckets.set(fullKey, new Set());
    fullBuckets.get(fullKey)!.add(gsisId);

    const fi = firstInitial(name);
    const ln = lastName(name);
    if (fi && ln) {
      const ilKey = `${pos}|${fi}|${ln}`;
      if (!ilBuckets.has(ilKey)) ilBuckets.set(ilKey, new Set());
      ilBuckets.get(ilKey)!.add(gsisId);
    }
  }

  const gsisByFull = new Map<string, string>();
  for (const [k, set] of fullBuckets.entries()) {
    if (set.size === 1) gsisByFull.set(k, Array.from(set)[0]);
  }

  const gsisByIL = new Map<string, string>();
  for (const [k, set] of ilBuckets.entries()) {
    if (set.size === 1) gsisByIL.set(k, Array.from(set)[0]);
  }

  // IMPORTANT: only fill players actually referenced by lineup items
  const players = await prisma.player.findMany({
    where: {
      sport: "NFL",
      gsisId: null,
      lineupItems: { some: {} },
    },
    select: { id: true, name: true, position: true },
  });

  let updated = 0;
  let missing = 0;
  let collision = 0;
  let hitFull = 0;
  let hitIL = 0;

  for (const p of players) {
    const pos = String(p.position).toUpperCase().trim();
    const n = normName(p.name);

    let gsisId: string | undefined;

    const fullKey = `${pos}|${n}`;
    gsisId = gsisByFull.get(fullKey);
    if (gsisId) hitFull++;

    if (!gsisId) {
      const fi = firstInitial(n);
      const ln = lastName(n);
      if (fi && ln) {
        const ilKey = `${pos}|${fi}|${ln}`;
        gsisId = gsisByIL.get(ilKey);
        if (gsisId) hitIL++;
      }
    }

    if (!gsisId) {
      missing++;
      continue;
    }

    // guard against @@unique([sport, gsisId])
    const exists = await prisma.player.findFirst({
      where: { sport: "NFL", gsisId },
      select: { id: true },
    });
    if (exists) {
      collision++;
      continue;
    }

    await prisma.player.update({
      where: { id: p.id },
      data: { gsisId },
    });

    updated++;
    if (updated % 50 === 0) console.log(JSON.stringify({ updated }));
  }

  console.log(
    JSON.stringify(
      { ok: true, updated, missing, collision, checked: players.length, hitFull, hitIL },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });
