import "dotenv/config";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

function parseIdsFromEnv(): string[] {
  const raw =
    process.env.CONTEST_ID ??
    process.env.CONTEST_IDS ??
    "";

  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return Array.from(new Set(ids));
}

async function main() {
  const ids = parseIdsFromEnv();

  if (!ids.length) {
    console.error(`Missing CONTEST_ID or CONTEST_IDS.
Examples:
  CONTEST_ID="cmm..." dotenv_config_path=.env.local node --import dotenv/config --import tsx scripts/delete-contests.ts
  CONTEST_IDS="cmm1...,cmm2..." dotenv_config_path=.env.local node --import dotenv/config --import tsx scripts/delete-contests.ts
`);
    process.exit(1);
  }

  const safeScript = resolve(process.cwd(), "scripts/delete-contest.safe.ts");

  for (const id of ids) {
    const result = spawnSync(
      process.execPath,
      ["--import", "dotenv/config", "--import", "tsx", safeScript],
      {
        stdio: "inherit",
        env: {
          ...process.env,
          CONTEST_ID: id,
          CONFIRM: "YES",
        },
      }
    );

    if (result.status !== 0) {
      process.exit(result.status ?? 1);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
