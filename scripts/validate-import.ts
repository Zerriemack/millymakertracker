// scripts/validate-import.ts
import * as fs from "node:fs";
import * as path from "node:path";
import { z } from "zod";

const ItemSchema = z.object({
  rosterSpot: z.any(),
  name: z.string().min(1),
  position: z.string().min(1),
  team: z.string().min(1),
  salary: z.any().optional(),
  points: z.any().optional(),

  ownership: z.any().optional(),
  ownershipPct: z.any().optional(),
  ownershipPercent: z.any().optional(),

  captain: z.any().optional(),
  captainPct: z.any().optional(),
  captainPercent: z.any().optional(),
  captainOwnership: z.any().optional(),
  ownershipCaptain: z.any().optional(),
  ownershipCaptainPct: z.any().optional(),
  ownershipCaptainPercent: z.any().optional(),

  flex: z.any().optional(),
  flexPct: z.any().optional(),
  flexPercent: z.any().optional(),
  flexOwnership: z.any().optional(),
  ownershipFlex: z.any().optional(),
  ownershipFlexPct: z.any().optional(),
  ownershipFlexPercent: z.any().optional(),

  draft: z.any().optional(),
  draftPct: z.any().optional(),
  draftPercent: z.any().optional(),
});

const InputSchema = z.object({
  sport: z.string().min(1),
  year: z.number().int(),
  week: z.number().int(),
  slateType: z.string().min(1),
  slateDate: z.string().min(4),

  contest: z.object({
    site: z.string().min(1),
    contestName: z.string().min(1),
    siteContestId: z.string().min(1),
    entryFeeCents: z.number().int().nullable().optional(),
    topPrizeCents: z.number().int().nullable().optional(),
  }),

  winner: z.object({
    username: z.string().min(1),
    points: z.number(),
    maxEntries: z.number().int().nullable().optional(),
  }),

  lineup: z.object({
    salaryUsed: z.number().int().nullable().optional(),
    totalPoints: z.number(),
    items: z.array(ItemSchema).min(1),
  }),
});

function parseArgs() {
  const argv = process.argv.slice(2);
  const idx = argv.indexOf("--path");
  const p = idx >= 0 ? argv[idx + 1] : null;
  if (!p) throw new Error("Missing --path");
  return { targetPath: p };
}

function isDirectory(p: string) {
  return fs.existsSync(p) && fs.statSync(p).isDirectory();
}

function walkJsonFiles(root: string) {
  const out: string[] = [];
  const stack = [root];

  while (stack.length) {
    const cur = stack.pop()!;
    const entries = fs.readdirSync(cur, { withFileTypes: true });

    for (const e of entries) {
      const full = path.join(cur, e.name);
      if (e.isDirectory()) stack.push(full);
      else if (e.isFile() && full.endsWith(".json")) out.push(full);
    }
  }

  out.sort();
  return out;
}

function normalizeRosterSpot(v: any) {
  const s = String(v ?? "").toUpperCase().trim();
  if (s === "CPT" || s === "CAP") return "CAPTAIN";
  return s;
}

function validateOne(filePath: string): "ok" | "skip" {
  const raw = fs.readFileSync(filePath, "utf8");

  if (!raw.trim()) {
    console.log("SKIP (empty):", filePath);
    return "skip";
  }

  let json: any;
  try {
    json = JSON.parse(raw);
  } catch (e: any) {
    throw new Error(`${filePath}: JSON parse failed (${e?.message ?? e})`);
  }

  const parsed = InputSchema.parse(json);

  const items = parsed.lineup.items.map((it) => ({
    ...it,
    rosterSpot: normalizeRosterSpot(it.rosterSpot),
  }));

  const captainCount = items.filter((x) => String(x.rosterSpot).toUpperCase() === "CAPTAIN").length;
  if (captainCount !== 1) {
    throw new Error(`${path.basename(filePath)}: expected exactly 1 captain, got ${captainCount}`);
  }

  if (items.length !== 6) {
    throw new Error(`${path.basename(filePath)}: expected 6 lineup items for showdown, got ${items.length}`);
  }

  return "ok";
}

async function run() {
  const { targetPath } = parseArgs();
  const abs = path.isAbsolute(targetPath) ? targetPath : path.join(process.cwd(), targetPath);
  const files = isDirectory(abs) ? walkJsonFiles(abs) : [abs];

  let ok = 0;
  let skipped = 0;

  for (const f of files) {
    const res = validateOne(f);
    if (res === "ok") ok++;
    else skipped++;
  }

  console.log(`OK: validated ${ok} file(s), skipped ${skipped} empty file(s)`);
}

run().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
