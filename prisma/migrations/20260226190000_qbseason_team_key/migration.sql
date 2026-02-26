-- Add teamId to QbSeason with backfill
ALTER TABLE "QbSeason" ADD COLUMN "teamId" TEXT;

UPDATE "QbSeason" qs
SET "teamId" = p."teamId"
FROM "Player" p
WHERE qs."playerId" = p."id"
  AND qs."teamId" IS NULL;

ALTER TABLE "QbSeason" ALTER COLUMN "teamId" SET NOT NULL;

-- Replace unique constraint to include teamId
DROP INDEX "QbSeason_sport_seasonId_playerId_key";
CREATE UNIQUE INDEX "QbSeason_sport_seasonId_playerId_teamId_key"
  ON "QbSeason"("sport", "seasonId", "playerId", "teamId");

-- Add index + FK for teamId
CREATE INDEX "QbSeason_teamId_idx" ON "QbSeason"("teamId");
ALTER TABLE "QbSeason"
  ADD CONSTRAINT "QbSeason_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
