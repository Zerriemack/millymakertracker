import "dotenv/config";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const a = process.env.CONTEST_ID_A ?? "";
const b = process.env.CONTEST_ID_B ?? "";
const idsToDelete = [a.trim(), b.trim()].filter(Boolean);

if (idsToDelete.length !== 2) {
  console.error(`Missing CONTEST_ID_A and CONTEST_ID_B.
Example:
  CONTEST_ID_A="cml8w1p390001whitgzypivob" CONTEST_ID_B="cml8wdyb7000nb1itrx6xfvnc" dotenv_config_path=.env.local node --import dotenv/config --import tsx scripts/delete-two-contests.ts
`);
  process.exit(1);
}

const safeScript = resolve(process.cwd(), "scripts/delete-contest.safe.ts");

async function main() {
  for (const id of idsToDelete) {
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
