import "dotenv/config";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const contestId = process.env.CONTEST_ID;
if (!contestId) {
  console.error('Missing CONTEST_ID. Example: CONTEST_ID="xxxx" <run command>');
  process.exit(1);
}

(async () => {
  const safeScript = resolve(process.cwd(), "scripts/delete-contest.safe.ts");
  const result = spawnSync(
    process.execPath,
    ["--import", "dotenv/config", "--import", "tsx", safeScript],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        CONTEST_ID: contestId,
        CONFIRM: "YES",
      },
    }
  );
  process.exit(result.status ?? 1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
